import type { Content, FunctionCall } from "@google/genai";
import { ai, CHAT_MODEL } from "@/lib/gemini";
import {
  applyLeave,
  getEmployeeDetails,
  getLeaveBalance,
  getLeavePolicy,
  tools,
} from "@/lib/tools";

// Step 13: an agent loop. Ask Gemini, run whatever tools it requests, send
// the results back, and repeat until Gemini answers in text.
const MAX_ROUNDS = 5;

export async function POST(request: Request) {
  // Chosen by the client or the app, never by Gemini. A client retrying the
  // same leave application resends its Idempotency-Key, so applyLeave can
  // recognise the repeat and not deduct the days twice. `||` rather than `??`
  // so an empty header falls back too instead of becoming a shared "" key.
  const requestId =
    request.headers.get("Idempotency-Key") || crypto.randomUUID();

  try {
    const body = await request.json();

    const question = body.question;
    const userId = body.userId ?? "user-123";

    if (typeof question !== "string" || !question.trim()) {
      return Response.json(
        {
          error: "Question is required",
        },
        {
          status: 400,
        },
      );
    }

    const userMessage: Content = {
      role: "user",
      parts: [{ text: question }],
    };

    const config = {
      // Gemini can't guess who "I" is, so tell it the current user's ID.
      // The leave rules are business rules Gemini won't follow unless told.
      systemInstruction: `The current user's ID is ${userId}.

When a user asks to apply for leave:
1. Always check their leave balance first using getLeaveBalance.
2. Only call applyLeave if the requested days are less than or equal to the available leave balance.
3. If the requested days exceed the available balance, do not call applyLeave. Explain that there are not enough leave days available.
4. If applyLeave returns alreadyProcessed: true, do not claim that a new application was submitted. Tell the user that the same application was already submitted earlier and no additional leave was deducted.`,
      tools,
    };

    // The whole conversation so far. Each round adds Gemini's turn and the
    // tool results, so Gemini always sees what happened before.
    const contents: Content[] = [userMessage];

    // Every call and result across all rounds, so we can see what Gemini did.
    const allFunctionCalls: FunctionCall[] = [];
    const allToolResults: unknown[] = [];

    // Agent loop: keep asking Gemini until it answers in text instead of
    // requesting tools. Capped so a model that keeps calling tools can't
    // loop forever.
    for (let round = 1; round <= MAX_ROUNDS; round++) {
      const response = await ai.models.generateContent({
        model: CHAT_MODEL,
        contents,
        config,
      });

      const functionCalls = response.functionCalls ?? [];

      // No tools requested, so Gemini has given its final answer.
      if (functionCalls.length === 0) {
        return Response.json({
          rounds: round,
          functionCalls: allFunctionCalls,
          toolResults: allToolResults,
          text: response.text ?? null,
        });
      }

      // Gemini only asks for a tool. We decide whether and how to run it.
      const toolResults = await Promise.all(
        functionCalls.map(async (functionCall) => {
          if (functionCall.name === "getLeaveBalance") {
            const result = await getLeaveBalance(
              String(functionCall.args?.userId),
            );

            return {
              id: functionCall.id,
              name: functionCall.name,
              result,
            };
          }

          if (functionCall.name === "getEmployeeDetails") {
            const result = await getEmployeeDetails(
              String(functionCall.args?.userId),
            );

            return {
              id: functionCall.id,
              name: functionCall.name,
              result,
            };
          }

          if (functionCall.name === "getLeavePolicy") {
            const result = getLeavePolicy(
              String(functionCall.args?.department),
            );

            return {
              id: functionCall.id,
              name: functionCall.name,
              result,
            };
          }

          if (functionCall.name === "applyLeave") {
            const result = await applyLeave(
              String(functionCall.args?.userId),
              Number(functionCall.args?.days),
              requestId,
            );

            return {
              id: functionCall.id,
              name: functionCall.name,
              result,
            };
          }

          return {
            id: functionCall.id,
            name: functionCall.name,
            error: `Unknown tool: ${functionCall.name}`,
          };
        }),
      );

      // Each tool result goes back as a functionResponse. The id and name tie
      // it to the function call Gemini made.
      const toolMessage: Content = {
        role: "user",
        parts: toolResults.map((toolResult) => ({
          functionResponse: {
            id: toolResult.id,
            name: toolResult.name,
            response:
              "result" in toolResult
                ? { result: toolResult.result }
                : { error: toolResult.error },
          },
        })),
      };

      // Add Gemini's function-call turn unchanged, then our results, and go
      // round again.
      contents.push(
        response.candidates?.[0]?.content ?? { role: "model", parts: [] },
        toolMessage,
      );

      allFunctionCalls.push(...functionCalls);
      allToolResults.push(...toolResults);
    }

    return Response.json(
      {
        error: `Gemini was still calling tools after ${MAX_ROUNDS} rounds`,
        functionCalls: allFunctionCalls,
        toolResults: allToolResults,
      },
      {
        status: 500,
      },
    );
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        error: error instanceof Error ? error.message : "Something went wrong",
      },
      {
        status: 500,
      },
    );
  }
}
