import {
  AIMessage,
  AIMessageChunk,
  ToolMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import { GraphRecursionError, INTERRUPT } from "@langchain/langgraph";

import type { RagSource } from "./langchain-rag";

// events sent to the browser. own format so the UI doesn't depend on langgraph's
export type AgentStreamEvent =
  | { type: "tool_start"; id?: string; tool: string; args: unknown }
  | { type: "tool_result"; id: string; tool?: string; result: unknown }
  | { type: "text"; content: string }
  | { type: "sources"; sources: RagSource[] }
  | {
      type: "approval";
      message: string;
      toolCall: { name: string; args: Record<string, unknown> };
      threadId?: string;
    }
  | { type: "error"; message: string };

type ApprovalRequest = {
  message?: unknown;
  toolCall?: { name?: unknown; args?: unknown };
};

export type ApprovalEvent = Extract<AgentStreamEvent, { type: "approval" }>;

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

type StreamPart =
  | [mode: "updates", data: Record<string, unknown>]
  | [mode: "messages", data: [BaseMessage, Record<string, unknown>]];

// "agent" in hrGraph, "model_request" in createAgent agents
const MODEL_NODES = new Set(["agent", "model_request"]);

const SOURCE_TOOLS = new Set(["askRagAgent", "searchCompanyDocs"]);

function parseResult(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// sub-agents stream through "messages" too, their namespace has a "|" in it
function isTopLevel(metadata: Record<string, unknown>) {
  const namespace = metadata.langgraph_checkpoint_ns;

  return typeof namespace !== "string" || !namespace.includes("|");
}

export function toAgentStreamEvents([mode, data]: StreamPart): AgentStreamEvent[] {
  if (mode === "messages") {
    const [chunk, metadata] = data;

    // .text not .content, gemini can return content as an array
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
      // gemini's streamed chunks don't have tool_calls, so get them from updates
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

export function streamErrorMessage(error: unknown) {
  if (error instanceof GraphRecursionError) {
    return "The assistant took too many steps to answer";
  }

  const { status, name } = (error ?? {}) as { status?: unknown; name?: unknown };

  if (status === 503) {
    return "The AI model is busy right now. Please try again in a moment.";
  }

  // RateLimitQuotaExhaustedError doesn't always have a status
  if (status === 429 || (typeof name === "string" && name.includes("RateLimit"))) {
    return "Too many requests to the AI model right now. Please wait a minute and try again.";
  }

  return "Internal server error";
}
