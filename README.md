# PeopleDesk

An internal assistant for employees. You can ask it questions about company documents (leave policy, carry-over rules, etc.), check your own leave balance, and apply for leave from the chat.

I built this to learn how RAG and multi-agent setups work in a real app, not just in a notebook. It started as a simple "chat with a PDF" app and grew from there.

## What it does

- **Ask about company docs** – admins upload PDFs, they get chunked and embedded into Pinecone, and answers come back with the source chunks they were based on.
- **HR questions** – department, leave balance, leave applications. This data lives in PostgreSQL.
- **Apply for leave** – the assistant never applies leave on its own. It shows an Approve / Reject card in the chat and only writes to the DB after you approve.
- **Streaming answers** – responses stream to the UI as they're generated.
- **Chat history** – conversations, messages and sources are saved, so you can come back to an old chat.

## Tech stack

- Next.js 16 (App Router), React 19, Tailwind CSS 4
- LangChain / LangGraph (JS)
- Gemini (`gemini-3.1-flash-lite` for chat, `gemini-embedding-001` for embeddings)
- Pinecone (vector DB)
- PostgreSQL + Prisma 7
- Model Context Protocol (MCP) SDK

## How it works

There is one **supervisor agent** that reads the question and passes it to the right specialist:

| Agent | Handles | Uses |
|---|---|---|
| RAG agent | company policy questions | Pinecone + Gemini |
| HR agent | employee details, leave applications | LangGraph graph + PostgreSQL |
| MCP HR agent | "how many leaves do I have left?" | MCP server (`getLeaveBalance`) |

```
Browser (/chat)
   │  { conversationId, question }
   ▼
POST /api/chat  →  session check  →  load last 20 messages
   │
   ▼
Supervisor agent
   ├── askRagAgent     → Pinecone → rerank → Gemini
   ├── askHrAgent      → hrGraph → applyLeave (waits for approval)
   └── askMcpHrAgent   → MCP client → MCP server
```

The specialist does its work and sends its answer back to the supervisor, which writes the final reply.

### RAG

1. Upload (admin only): PDF → text → chunks → embeddings → Pinecone
2. Search: top 5 matches, anything below 0.5 similarity is dropped
3. Rerank with Gemini. If it takes more than 8s, I just keep Pinecone's order so the answer isn't stuck.
4. Gemini answers only from those chunks, or says it couldn't find it.

### Leave approval (human-in-the-loop)

When someone says "apply 1 day of leave":

1. The HR graph checks the balance and prepares the leave request.
2. Before saving anything, it pauses with LangGraph's `interrupt()`.
3. The UI shows an Approve / Reject card.
4. On approve, `POST /api/chat/resume` continues the graph and the leave is applied. On reject, nothing changes in the DB.

A few things I had to handle here:
- **Double clicks** – the paused run is claimed by deleting its row atomically, so only one request can continue it.
- **Applying leave twice** – `applyLeave` uses a request id, so running it again on resume doesn't apply the leave twice. Balance check + deduction happen in one transaction.
- **Page reload** – a pending approval card shows up again after reload.
- Only one pending approval per user at a time.

### MCP

`lib/mcp-server.ts` exposes a `getLeaveBalance` tool. It's tied to the logged-in user and takes no arguments, so it can't be used to read someone else's balance. It runs over stdio (`npm run mcp:server`) and HTTP (`/api/mcp`).

## Security notes

- The user id always comes from the session cookie (signed, HttpOnly), never from the request body or the model.
- Chat history is loaded from the DB on the server – the client only sends the new question.
- You can only open your own conversations / paused runs; anything else returns 404.
- Only admins can upload or delete documents.
- Text from documents is wrapped as untrusted data in the prompt so instructions inside a PDF are not followed.

## Running locally

```bash
npm install
npx prisma migrate deploy
npx prisma generate
npm run dev
```

Open http://localhost:3000/login and log in with an employee id (e.g. `user-123`). This is a dev-only login, there are no passwords yet.

Create a `.env` file:

| Variable | Used for |
|---|---|
| `DATABASE_URL` | PostgreSQL |
| `GEMINI_API_KEY` | chat + embeddings |
| `PINECONE_API_KEY`, `PINECONE_INDEX` | document vectors |
| `SESSION_SECRET` | signing the session cookie (min 32 chars) |
| `MCP_USER_ID` | user the standalone MCP server runs as |

## Project structure

```
app/api/chat/route.ts          main chat endpoint
app/api/chat/resume/route.ts   continues a run after approve/reject
app/chat/_components/          chat UI (ChatWindow, ApprovalCard, ...)
lib/supervisor-agent.ts        supervisor + routing
lib/hr-graph.ts                HR graph with the approval step
lib/tools.ts                   HR logic (applyLeave, balances)
lib/mcp-server.ts              MCP server
prisma/                        schema + migrations
```

The `*-test` routes under `app/api/` are the smaller experiments I did while learning (tool calling, LangGraph, MCP, supervisor). I've kept them for reference, they aren't used by the main chat.

## Known issues / TODO

- Selecting a document in the UI doesn't filter the search yet – it still searches all documents.
- Gemini free tier is 15 requests/min and one answer takes 4–6 model calls, so you hit the limit quickly.
- The MCP agent starts a new server process on every call, which adds a few seconds.
- Answers can take 10–45s because of multiple model calls.
- Add real login (credentials / SSO).
