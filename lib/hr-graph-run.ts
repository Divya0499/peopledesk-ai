import type { RunnableConfig } from "@langchain/core/runnables";
import { isAIMessage } from "@langchain/core/messages";
import { GraphRecursionError, INTERRUPT } from "@langchain/langgraph";
import { NextResponse } from "next/server";

import { hrGraph } from "./hr-graph";

// Shared by the start and resume routes of /api/langgraph-test

const MAX_GRAPH_STEPS = 10;

export function graphConfig(threadId: string): RunnableConfig {
  return {
    // The checkpointer saves the run under this ID; resuming needs the same one
    configurable: { thread_id: threadId },
    // Safety guard, not a business rule: each node run is one step, so
    // 10 allows about four tool rounds before LangGraph stops the run
    recursionLimit: MAX_GRAPH_STEPS,
  };
}

type GraphResult = Awaited<ReturnType<typeof hrGraph.invoke>>;

// Either the graph paused for approval, or it finished with an answer
export function graphResponse(result: GraphResult, threadId: string) {
  // Every tool the agent asked for, in order, to see the path it took
  const toolCalls = result.messages.flatMap((message) =>
    isAIMessage(message)
      ? (message.tool_calls ?? []).map(({ name, args }) => ({ name, args }))
      : [],
  );

  // Set when interrupt() paused the run: hand its value to the person
  // approving, plus the threadId they must send back to resume
  const interrupts = (result as Record<string, unknown>)[INTERRUPT] as
    { value: unknown }[] | undefined;

  if (interrupts?.length) {
    return NextResponse.json({
      status: "pending_approval",
      approval: interrupts[0].value,
      toolCalls,
      threadId,
    });
  }

  const lastMessage = result.messages[result.messages.length - 1];

  return NextResponse.json({
    status: "done",
    // .text rather than .content: Gemini's content can be an array of parts
    text: lastMessage.text,
    messageCount: result.messages.length,
    toolCalls,
    threadId,
  });
}

export function graphErrorResponse(error: unknown) {
  console.error(error);

  // The agent kept calling tools without reaching an answer
  if (error instanceof GraphRecursionError) {
    return NextResponse.json(
      { error: "The assistant took too many steps to answer" },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      error: "Internal server error",
    },
    { status: 500 },
  );
}
