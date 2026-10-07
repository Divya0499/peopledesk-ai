# learn-ai: Company Knowledge & HR Assistant

## Project Overview

A Next.js chat app where an employee can ask about company documents and
their own HR data, and apply for leave. A **supervisor agent** decides which
specialist answers each request:

- **RAG agent**: answers from the uploaded company documents (Pinecone + Gemini).
- **HR agent**: a LangGraph graph with the employee's data in PostgreSQL. It can
  apply for leave, but only after the employee approves it in the chat
  (human-in-the-loop).
- **MCP HR agent**: reads the leave balance through an MCP server.

Answers stream to the browser as they are generated, with the document
chunks they were based on. Conversations, approvals and long-term user
memories are stored in PostgreSQL.

**Stack:** Next.js 16 (App Router) · React 19 · Tailwind 4 · LangChain /
LangGraph (JS) · Gemini (`gemini-3.1-flash-lite`, `gemini-embedding-001`) ·
Pinecone · PostgreSQL + Prisma 7 · Model Context Protocol SDK

### Running it

```bash
npm install
npx prisma migrate deploy   # create the tables
npx prisma generate         # generate the Prisma client into lib/generated
npm run dev                 # http://localhost:3000, then log in at /login
```

Environment variables (`.env` / `.env.local`):

| Variable | Used for |
|---|---|
| `DATABASE_URL` | PostgreSQL (Prisma, and the LangGraph checkpointer) |
| `GEMINI_API_KEY` | chat and embedding models |
| `PINECONE_API_KEY`, `PINECONE_INDEX` | document vectors |
| `SESSION_SECRET` | signs the session cookie (at least 32 characters) |
| `MCP_USER_ID` | the employee the standalone stdio MCP server acts for |

Login is a development login by employee ID (e.g. `user-123`); there are no
passwords yet, and it is disabled in production.

## Architecture

```text
Browser (/chat, ChatWindow)
   │  { conversationId, question }            NDJSON events ▲
   ▼                                                        │
POST /api/chat ── session check ── conversation ownership ── last 20 messages (PostgreSQL)
   │
   ▼
Supervisor agent (createAgent + PostgresSaver checkpointer, fresh thread per request)
   ├── askRagAgent ──── RAG agent ── searchCompanyDocs ── Pinecone → rerank → Gemini
   ├── askHrAgent ───── hrGraph (StateGraph) ── HR tools, applyLeave ── PostgreSQL
   │                        └── approval node: interrupt() ──► approval card in the chat
   └── askMcpHrAgent ── MCP agent ── MCP client (stdio) ── MCP server ── getLeaveBalance
   │
   ▼
lib/agent-stream-events.ts: LangGraph stream → tool_start / tool_result / text /
sources / approval / error events
```

| Path | What it is |
|---|---|
| `app/api/chat/route.ts` | the chat endpoint: runs the supervisor, streams events, saves the turn |
| `app/api/chat/resume/route.ts` | continues a run paused for approval |
| `lib/supervisor-agent.ts` | supervisor, routing prompt, checkpointer, run cleanup |
| `lib/supervisor-tools.ts` | the specialists wrapped as supervisor tools |
| `lib/hr-graph.ts`, `lib/approval-node.ts` | the HR graph and its approval pause |
| `lib/tools.ts` | HR business logic (`applyLeave`, balances), called by the tools |
| `lib/agent-stream-events.ts` | the one adapter from LangGraph streams to frontend events |
| `app/chat/_components/` | the chat UI (`ChatWindow`, `ApprovalCard`, …) |

The `*-test` routes under `app/api/` are the step-by-step exercises the app
was built from (tool calling, LangChain, LangGraph, MCP, supervisor). They
are kept for reference and are not part of the main chat flow.

## Agent Flow

1. The browser sends only `{ conversationId, question }`. The server checks
   the session and that the conversation belongs to the user, and loads the
   last 20 messages from PostgreSQL. The client never supplies the history,
   so it can't put words in the assistant's mouth.
2. The supervisor routes the request:
   - company policy, entitlement, carry-over → `askRagAgent`
   - the employee's own leave balance → `askMcpHrAgent`
   - department, other employee details, leave applications → `askHrAgent`

   It uses the conversation history to resolve follow-ups like "how many of
   those days do I have left?".
3. Each specialist runs its own tool loop; only its final answer returns to
   the supervisor, which writes the reply.
4. The stream adapter forwards only the supervisor's own text. Specialists
   are nested agents, and their output arrives with a nested checkpoint
   namespace (`tools:<id>|…`), so it is filtered out instead of leaking into
   the answer.
5. The question and answer are saved together once there is an answer, so a
   failed run never leaves an unanswered question in the history.

## RAG Flow

- **Ingest** (`/api/upload`, admins only): PDF → text → chunks → Gemini
  embeddings → Pinecone, with a `Document` row in PostgreSQL.
- **Retrieve**: embed the question, query Pinecone (top 5), drop matches
  below a similarity of 0.5.
- **Rerank**: Gemini scores each chunk's relevance. It gives up after 8 s and
  keeps Pinecone's order, so a slow reranker can't hold up the answer.
- **Answer**: Gemini answers only from the chunks, or says it couldn't find
  the information.
- **Sources**: `searchCompanyDocs` and `askRagAgent` return their chunks as
  the tool's *artifact* (`content_and_artifact`). The models see only the
  answer text; the app gets the chunks, streams them as a `sources` event and
  saves them with the answer.

## HITL / Approval Flow

```text
"Apply 1 day of leave"
  → supervisor → askHrAgent → hrGraph: getLeaveBalance → applyLeave requested
  → approval node: interrupt()  (nothing written yet)
  → pause saved by the supervisor's checkpointer; AgentThread row records the owner
  → approval event → Approve / Reject card
  → POST /api/chat/resume { threadId, approved }
  → Command({ resume: { approved } }) → hrGraph continues
  → approved: applyLeave() once · rejected: reply, no database change
```

- **Where the pause lives**: `hrGraph` runs nested inside the supervisor's
  `askHrAgent` tool, so its `interrupt()` propagates up to the supervisor and
  is saved by the supervisor's checkpointer. Resuming the supervisor runs
  `askHrAgent` again, and `hrGraph` continues from where it paused.
- **Exactly once**: `applyLeave` is idempotent on a `requestId`. The id is
  `<supervisor thread_id>:<askHrAgent tool call id>`; both are saved in the
  checkpoint, so it is the same when the tool runs again on resume. The same
  id is `hrGraph`'s thread, so its saved pause is found again.
  `applyLeave` checks and deducts the balance in one transaction.
- **Ownership**: `AgentThread { id, userId, conversationId }` is created only
  when a run pauses. Resume accepts only `{ threadId, approved }`; who may
  resume and where the outcome is saved come from that row.
- **Double clicks**: resume claims the run by atomically deleting its
  `AgentThread` row, so only one request continues it. If the resume fails,
  the row is restored, and a retry is safe because of the `requestId`.
- **One pending approval per user**: a new pause while another is waiting is
  dropped with "Please approve or reject it first", under a per-user Postgres
  advisory lock so two requests can't both pass the check.
- **Rejection is final for that request**: the supervisor is told the
  employee rejected it and not to resubmit; the user can start a new request.
- **After reload or conversation switch**: `GET /api/conversations` reads any
  pending approval from the saved run (no model call, nothing runs) and the
  chat shows its card again.

## Memory & Persistence

| Data | Where |
|---|---|
| Conversations and messages (with sources) | PostgreSQL `Conversation`, `Message` |
| Paused supervisor runs | PostgreSQL, `langgraph` schema (`PostgresSaver`), kept apart from Prisma's `public` schema so Prisma never sees them as drift |
| Who owns a paused run | `AgentThread` |
| Long-term user memories (e.g. `response_style`) | `UserMemory`, loaded into the HR agent's prompt; saved only when the user asks |
| Leave balance and applications | `Employee`, `LeaveApplication` |
| Document chunks | Pinecone, linked by `Document.id` |

Each `/api/chat` request uses a fresh LangGraph thread: the database holds the
conversation, and a thread only matters if that run pauses. A finished run's
saved state, including its nested `hrGraph` thread, is deleted when it ends.

## MCP

- `lib/mcp-server.ts` builds an MCP server with a `getLeaveBalance` tool and
  a resource. It is bound to an already-authenticated user and takes no
  arguments, so no MCP client can ask about another employee.
- It is served over **stdio** (`npm run mcp:server`, `lib/mcp-server-stdio.ts`)
  and **HTTP** (`app/api/mcp`, with the user from the session).
- `askMcpHrAgent` starts the stdio server through the MCP client, loads its
  tools as LangChain tools, answers, and closes the process.

## Security

- **Identity from the session only**: a signed, HttpOnly, SameSite cookie
  holding just the user id (HS256, algorithm pinned); the role is read from
  the database on each request. A `userId` in a body, query or tool argument
  is never trusted. `/chat` and `/langgraph-stream` check the session on the
  server before rendering.
- **Tools are bound to the user**: HR and MCP tools are built per request
  with the session's `userId`; the model chooses only arguments like `days`.
- **Ownership checks**: conversations and paused runs match on id *and* owner,
  so another user's id looks the same as one that doesn't exist (404).
- **Admin-only document changes**: upload and delete require the `admin` role.
- **Prompt injection**: document text and document-derived tool results are
  wrapped in marked untrusted-data blocks, with rules never to follow
  instructions inside them (`lib/untrusted-content.ts`).
- **Server-owned history**: the model's context comes from the database, never
  from the client.
- **No internal ids in answers**: `applyLeave`'s result is stripped of
  `requestId` before the model sees it, and the prompts forbid repeating ids.
- **Exactly-once writes**: idempotent `applyLeave`, transactional balance
  update, atomic claim on resume.

## Production Considerations

- **Errors mid-stream** travel as an `error` event (the 200 is already sent),
  with readable messages for a Gemini 503, rate limits and runaway agent
  loops. Transient database errors are retried (`lib/retry.ts`).
- **Empty replies**: Gemini sometimes ends a run without streaming its final
  text; the routes fall back to the final message in the saved state.
- **Cost and latency**: a supervisor answer takes several model calls
  (supervisor → specialist → supervisor), roughly 10–45 s.
  `lib/usage-tracker.ts` counts tokens and calls per request.
- **Login** is a development login; a real deployment needs credentials or
  SSO before `createSession`.
- **Shared state**: the checkpointer and Prisma client are kept on
  `globalThis` so dev hot reloads don't open new connection pools.

## Known Limitations

- **The document selector doesn't affect retrieval.** In Documents mode the
  supervisor's RAG agent always searches all documents.
- **Gemini free tier (15 requests/minute) is easy to hit.** A supervisor answer
  uses about 4–6 model calls, so about 3 questions a minute. Reranking is
  skipped (falling back to Pinecone's order) when it hits the limit.
- **`askMcpHrAgent` starts a new MCP server process for every call**, which
  adds a few seconds each time.
- **HR assistant mode** (`/api/langgraph-test`) still keeps its paused runs in
  memory, so a server restart loses them; only `/api/chat` approvals are
  restart-safe.
