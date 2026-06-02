import type { TokenEstimate } from "../types/budget.js";

const PROVIDER_COSTS: Record<string, { input: number; output: number }> = {
  "nvidia-nim": { input: 0.000001, output: 0.000002 },
  "openai": { input: 0.000003, output: 0.000012 },
  "anthropic": { input: 0.000003, output: 0.000015 },
};

const CHARS_PER_TOKEN = 4;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function estimateCost(
  providerId: string,
  inputTokens: number,
  outputTokens: number
): number {
  const costs = PROVIDER_COSTS[providerId];
  if (!costs) return 0;
  return (
    (inputTokens / 1_000_000) * costs.input +
    (outputTokens / 1_000_000) * costs.output
  );
}

export function buildEstimate(params: {
  systemPrompt?: string;
  messages: Array<{ role: string; content: string }>;
  expectedOutputTokens: number;
  providerId: string;
}): TokenEstimate {
  const inputText =
    (params.systemPrompt ?? "") +
    params.messages.map((m) => m.content).join("\n");
  const inputTokens = estimateTokens(inputText);
  const outputTokens = params.expectedOutputTokens;
  const totalTokens = inputTokens + outputTokens;
  const costUsd = estimateCost(params.providerId, inputTokens, outputTokens);
  const providerCosts = PROVIDER_COSTS[params.providerId];

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    costUsd,
    providerId: params.providerId,
    costPerInputToken: (providerCosts?.input ?? 0) / 1_000_000,
    costPerOutputToken: (providerCosts?.output ?? 0) / 1_000_000,
  };
}