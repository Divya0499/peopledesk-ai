"use client";

import { useState } from "react";

import type { AgentStreamEvent } from "@/lib/agent-stream-events";

type ToolStep = { id: string; tool: string; done: boolean };

// Sends a question to /api/langgraph-stream and shows the agent's progress
// live: each tool call as it starts and finishes, then the answer as it's
// generated.
export default function LangGraphStream() {
  const [message, setMessage] = useState("What is my leave balance?");
  const [steps, setSteps] = useState<ToolStep[]>([]);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [streaming, setStreaming] = useState(false);

  function handleEvent(event: AgentStreamEvent) {
    console.log("EVENT:", event);

    if (event.type === "tool_start") {
      const id = event.id ?? crypto.randomUUID();
      setSteps((previous) => [
        ...previous,
        { id, tool: event.tool, done: false },
      ]);
    }

    // Matched by id, so the right step is ticked even when the agent ran
    // several tools at once
    if (event.type === "tool_result") {
      setSteps((previous) =>
        previous.map((step) =>
          step.id === event.id ? { ...step, done: true } : step,
        ),
      );
    }

    if (event.type === "text") {
      setAnswer((previous) => previous + event.content);
    }

    if (event.type === "error") {
      setError(event.message);
    }
  }

  async function send() {
    setSteps([]);
    setAnswer("");
    setError("");
    setStreaming(true);

    try {
      const response = await fetch("/api/langgraph-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      if (!response.ok || !response.body) {
        setError(`Request failed: ${response.status}`);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      // Bytes arrive in chunks that needn't line up with events: one read can
      // hold half an event or several. Keep the unfinished last line here
      // until the rest of it arrives.
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        // stream: true keeps a multi-byte character that was split across
        // two chunks from turning into garbage
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.trim()) handleEvent(JSON.parse(line));
        }
      }
    } catch (error) {
      // e.g. the connection dropped mid-stream
      setError(`Stream failed: ${String(error)}`);
    } finally {
      setStreaming(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="flex gap-2">
        <input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          className="flex-1 rounded border px-3 py-2"
        />
        <button
          onClick={send}
          disabled={streaming || !message.trim()}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {streaming ? "Streaming…" : "Ask"}
        </button>
      </div>

      {steps.length > 0 && (
        <ul className="mt-6 space-y-1 text-sm text-gray-600">
          {steps.map((step) => (
            <li key={step.id}>
              {step.done ? "✅" : "🔧"} {step.tool}
              {step.done ? " done" : "…"}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 whitespace-pre-wrap">{answer}</p>

      {error && <p className="mt-6 text-red-600">{error}</p>}
    </main>
  );
}
