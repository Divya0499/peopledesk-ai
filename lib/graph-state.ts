import { Annotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";

export const GraphState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),

  // idempotency key for applyLeave, in state so it survives a resume
  requestId: Annotation<string>(),

  userId: Annotation<string>(),

  // can't be called "approval", that's the node name
  approved: Annotation<boolean>(),
});
