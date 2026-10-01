import { HumanMessage, AIMessage } from "@langchain/core/messages";

type HistoryMessage = {
  role: "user" | "ai";
  text: string;
};

export function toLangChainMessages(messages: HistoryMessage[]) {
  return messages.map((message) => {
    if (message.role === "user") {
      return new HumanMessage(message.text);
    }

    return new AIMessage(message.text);
  });
}
