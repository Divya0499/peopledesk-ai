import {
  AIMessage,
  AIMessageChunk,
  ToolMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import { GraphRecursionError, INTERRUPT } from "@langchain/langgraph";

import type { RagSource } from "./langchain-rag";

// The events the browser gets while the agent runs. Kept separate from
// LangGraph's own stream format so the frontend doesn't depend on it: the
// graph can change as long as it still produces these.
// id ties a tool_result to its tool_start (the agent's tool call id), so two
// tools running at once don't get mixed up.
// sources comes once per document-search result; the agent may search more
// than once, so the frontend merges them by id.
export type AgentStreamEvent =
  | { type: "tool_start"; id?: string; tool: string; args: unknown }
  | { type: "tool_result"; id: string; tool?: string; result: unknown }
  | { type: "text"; content: string }
  | { type: "sources"; sources: RagSource[] }
  | {
      type: "approval";
      message: string;
      // The action waiting for the person's decision, e.g. applyLeave with
      // { days: 1 }. No userId: tools take the employee from the session.
      toolCall: { name: string; args: Record<string, unknown> };
      // Added by /api/chat once it has recorded who owns the paused run;
      // the client sends it back to approve or reject
      threadId?: string;
    }
  | { type: "error"; message: string };

// What approvalNode passes to interrupt()
type ApprovalRequest = {
  message?: unknown;
  toolCall?: { name?: unknown; args?: unknown };
};

export type ApprovalEvent = Extract<AgentStreamEvent, { type: "approval" }>;

// What approvalNode passed to interrupt(), as an approval event; undefined
// for a pause that doesn't name a tool call. Shared by the stream and by
// restoring a pending approval from a saved run.
export function approvalFromInterrupt(value: unknown): ApprovalEvent | undefined {
  const request = (value ?? {}) as ApprovalRequest;

  if (typeof request.toolCall?.name !== "string") {
    return undefined;
  }

  return {
    type: "approval",
    message:
      typeof request.message === "string"
        ? request.message
        : "Please approve this action.",
    toolCall: {
      name: request.toolCall.name,
      args: (request.toolCall.args ?? {}) as Record<string, unknown>,
    },
  };
}

// The [mode, data] pairs graph.stream() yields with
// streamMode: ["updates", "messages"]
type StreamPart =
  | [mode: "updates", data: Record<string, unknown>]
  | [mode: "messages", data: [BaseMessage, Record<string, unknown>]];

// The node that calls the model: "agent" in hrGraph, "model_request" in
// agents built with createAgent (the supervisor)
const MODEL_NODES = new Set(["agent", "model_request"]);

// Tools whose ToolMessage artifact holds the document chunks the answer was
// based on (content_and_artifact)
const SOURCE_TOOLS = new Set(["askRagAgent", "searchCompanyDocs"]);

// Tool results are JSON strings from our tools; pass the object on when
// they parse, and the raw text when they don't
function parseResult(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// The supervisor's specialists are agents too, run inside its tools, and
// their model output streams through "messages" as well. Their namespace is
// nested under the tool call ("tools:<id>|model_request:<id>"), while the
// top-level graph's own is a single part ("model_request:<id>").
function isTopLevel(metadata: Record<string, unknown>) {
  const namespace = metadata.langgraph_checkpoint_ns;

  return typeof namespace !== "string" || !namespace.includes("|");
}

// Turns one raw LangGraph stream part into zero or more frontend events.
// - text: the model's words, from "messages". Only top-level chunks from the
//   model node count: tool results, the RAG chain's own model call (inside
//   the tools node) and a specialist's answer also come through "messages".
// - tool_start: a model update whose message has tool_calls (Gemini's
//   streamed chunks don't include them, so "updates" is the only source).
// - tool_result: a ToolMessage in a tools node update.
// - sources: the artifact of a document-search ToolMessage.
// - approval: the run paused at interrupt(), with what it wants approved.
// "updates" only carries the top-level graph's own nodes, so nested
// specialist steps never reach these. The model's final update repeats the
// whole answer already streamed as text, so it's skipped.
export function toAgentStreamEvents([mode, data]: StreamPart): AgentStreamEvent[] {
  if (mode === "messages") {
    const [chunk, metadata] = data;

    // .text rather than .content: Gemini's content can be an array of parts
    if (
      MODEL_NODES.has(String(metadata.langgraph_node)) &&
      isTopLevel(metadata) &&
      AIMessageChunk.isInstance(chunk) &&
      chunk.text
    ) {
      return [{ type: "text", content: chunk.text }];
    }

    return [];
  }

  const events: AgentStreamEvent[] = [];

  // The run paused at interrupt() and is waiting for a decision. It arrives
  // as its own "updates" entry, also when the pause happened in a nested
  // graph (hrGraph inside the supervisor's askHrAgent tool).
  for (const { value } of (data[INTERRUPT] ?? []) as { value?: unknown }[]) {
    const approval = approvalFromInterrupt(value);

    if (approval) {
      events.push(approval);
    }
  }

  for (const [node, update] of Object.entries(data)) {
    if (node === INTERRUPT) {
      continue;
    }

    const messages = (update as { messages?: BaseMessage[] })?.messages ?? [];

    for (const message of messages) {
      if (MODEL_NODES.has(node) && AIMessage.isInstance(message)) {
        for (const toolCall of message.tool_calls ?? []) {
          events.push({
            type: "tool_start",
            id: toolCall.id,
            tool: toolCall.name,
            args: toolCall.args,
          });
        }
      }

      if (node === "tools" && ToolMessage.isInstance(message)) {
        events.push({
          type: "tool_result",
          id: message.tool_call_id,
          tool: message.name,
          result: parseResult(message.text),
        });

        if (
          SOURCE_TOOLS.has(message.name ?? "") &&
          Array.isArray(message.artifact)
        ) {
          events.push({
            type: "sources",
            sources: message.artifact as RagSource[],
          });
        }
      }
    }
  }

  return events;
}

// The user-facing message for a failure that happens mid-stream, once the
// 200 and headers are already sent
export function streamErrorMessage(error: unknown) {
  if (error instanceof GraphRecursionError) {
    return "The assistant took too many steps to answer";
  }

  const { status, name } = (error ?? {}) as { status?: unknown; name?: unknown };

  // Gemini is overloaded
  if (status === 503) {
    return "The AI model is busy right now. Please try again in a moment.";
  }

  // Over the Gemini quota (requests per minute). LangChain's Google client
  // throws RateLimitQuotaExhaustedError, which may not carry a status.
  if (status === 429 || (typeof name === "string" && name.includes("RateLimit"))) {
    return "Too many requests to the AI model right now. Please wait a minute and try again.";
  }

  return "Internal server error";
}
