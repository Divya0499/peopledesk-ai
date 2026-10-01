import {
  AIMessage,
  ToolMessage,
  type BaseMessage,
} from "@langchain/core/messages";

// The events the browser gets while the agent runs. Kept separate from
// LangGraph's own stream format so the frontend doesn't depend on it: the
// graph can change as long as it still produces these.
// id ties a tool_result to its tool_start (the agent's tool call id), so two
// tools running at once don't get mixed up.
export type AgentStreamEvent =
  | { type: "tool_start"; id?: string; tool: string; args: unknown }
  | { type: "tool_result"; id: string; tool?: string; result: unknown }
  | { type: "text"; content: string }
  | { type: "error"; message: string };

// The [mode, data] pairs hrGraph.stream() yields with
// streamMode: ["updates", "messages"]
type StreamPart =
  | [mode: "updates", data: Record<string, unknown>]
  | [mode: "messages", data: [BaseMessage, Record<string, unknown>]];

// Tool results are JSON strings from our tools; pass the object on when
// they parse, and the raw text when they don't
function parseResult(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// Turns one raw LangGraph stream part into zero or more frontend events.
// - text: the agent's words, from "messages". Tool results also come through
//   "messages", so only chunks from the agent node count.
// - tool_start: an agent update whose message has tool_calls (Gemini's
//   streamed chunks don't include them, so "updates" is the only source).
// - tool_result: a ToolMessage in a tools node update.
// The agent's final update repeats the whole answer already streamed as
// text, so it's skipped.
export function toAgentStreamEvents([mode, data]: StreamPart): AgentStreamEvent[] {
  if (mode === "messages") {
    const [chunk, metadata] = data;

    // .text rather than .content: Gemini's content can be an array of parts
    if (metadata.langgraph_node === "agent" && chunk.text) {
      return [{ type: "text", content: chunk.text }];
    }

    return [];
  }

  const events: AgentStreamEvent[] = [];

  for (const [node, update] of Object.entries(data)) {
    const messages = (update as { messages?: BaseMessage[] })?.messages ?? [];

    for (const message of messages) {
      if (node === "agent" && AIMessage.isInstance(message)) {
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
      }
    }
  }

  return events;
}
