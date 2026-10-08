import type { RunnableConfig } from "@langchain/core/runnables";

const MAX_GRAPH_STEPS = 10;

// The config for one hrGraph run, used by askHrAgent in supervisor-tools.ts
export function graphConfig(threadId: string): RunnableConfig {
  return {
    // The checkpointer saves the run under this ID; resuming needs the same one
    configurable: { thread_id: threadId },
    // Safety guard, not a business rule: each node run is one step, so
    // 10 allows about four tool rounds before LangGraph stops the run
    recursionLimit: MAX_GRAPH_STEPS,
  };
}
