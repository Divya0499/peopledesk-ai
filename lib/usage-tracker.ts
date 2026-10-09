import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import type { Serialized } from "@langchain/core/load/serializable";
import { AIMessage, type BaseMessage } from "@langchain/core/messages";
import type { ChatGeneration, LLMResult } from "@langchain/core/outputs";

export type UsageSummary = {
  llmCalls: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  toolCalls: number;
  errors: number;
  byModel: Record<string, { inputTokens: number; outputTokens: number }>;
};

// counts tokens for one request, including the nested agents. one per request
export class UsageTracker extends BaseCallbackHandler {
  name = "usage-tracker";

  private summary: UsageSummary = {
    llmCalls: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    toolCalls: 0,
    errors: 0,
    byModel: {},
  };

  private modelByRun = new Map<string, string>();

  async handleChatModelStart(
    _llm: Serialized,
    _messages: BaseMessage[][],
    runId: string,
    _parentRunId?: string,
    _extraParams?: Record<string, unknown>,
    _tags?: string[],
    metadata?: Record<string, unknown>,
  ) {
    this.modelByRun.set(runId, String(metadata?.ls_model_name ?? "unknown"));
  }

  async handleLLMEnd(output: LLMResult, runId: string) {
    const generation = output.generations[0]?.[0] as ChatGeneration | undefined;
    const message = generation?.message;
    const usage = AIMessage.isInstance(message)
      ? message.usage_metadata
      : undefined;
    const model = this.modelByRun.get(runId) ?? "unknown";
    this.modelByRun.delete(runId);

    this.summary.llmCalls += 1;
    if (!usage) return;

    this.summary.inputTokens += usage.input_tokens;
    this.summary.outputTokens += usage.output_tokens;
    this.summary.totalTokens += usage.total_tokens;

    const perModel = (this.summary.byModel[model] ??= {
      inputTokens: 0,
      outputTokens: 0,
    });
    perModel.inputTokens += usage.input_tokens;
    perModel.outputTokens += usage.output_tokens;
  }

  async handleToolEnd() {
    this.summary.toolCalls += 1;
  }

  async handleLLMError() {
    this.summary.errors += 1;
  }

  async handleToolError() {
    this.summary.errors += 1;
  }

  getSummary(): UsageSummary {
    return structuredClone(this.summary);
  }
}
