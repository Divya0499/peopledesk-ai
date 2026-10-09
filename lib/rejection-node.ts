import { AIMessage } from "@langchain/core/messages";

// otherwise the run just ends on the applyLeave call with no reply
export async function rejectionNode() {
  return {
    messages: [
      new AIMessage("Okay, I've cancelled that. The leave request was not sent."),
    ],
  };
}
