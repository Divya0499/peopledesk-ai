import { AIMessage } from "@langchain/core/messages";

// Runs when the person rejects the leave: replies to the user instead of
// ending silently with the agent's unanswered applyLeave call as the last
// message. applyLeave never runs, so the database is untouched.
export async function rejectionNode() {
  return {
    messages: [
      new AIMessage("Okay, I've cancelled that. The leave request was not sent."),
    ],
  };
}
