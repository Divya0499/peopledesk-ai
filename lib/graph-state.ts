import { Annotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";

export const GraphState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),

  // Idempotency key for applyLeave, set by the app when the run starts. It
  // lives in the state so the checkpointer saves it: a resumed run reuses
  // the same key and can't deduct the leave twice.
  // No reducer: a new value simply replaces the old one.
  requestId: Annotation<string>(),

  // The signed-in employee, set by the app when the run starts. The agent
  // node puts it in the system prompt, so "apply 3 days leave" means this
  // user's leave and Gemini doesn't guess an ID.
  userId: Annotation<string>(),

  // The human's decision from the approval node: true = approved. Must be a
  // state field, or LangGraph silently drops it from the node's return value.
  // Not named "approval": LangGraph forbids a field and a node sharing a name.
  approved: Annotation<boolean>(),
});
