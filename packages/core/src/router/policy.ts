import type { TaskConfig, ProviderDecision } from "../types/provider.js";
import type { ModelRequest } from "../ai-engine/router.js";
import { routeUnlimited } from "../ai-engine/router.js";

export async function pickProvider(task: TaskConfig): Promise<ProviderDecision> {
  const request: ModelRequest = {
    prompt: task.prompt,
    systemPrompt: task.systemPrompt,
    messages: task.messages as ModelRequest["messages"],
    model: task.modelHints[0],
    maxTokens: task.maxTokens,
    temperature: task.temperature,
    agentId: task.agentId,
    preferLocal: task.preferLocal,
  };

  try {
    const result = await routeUnlimited(request);
    const providerType = result.provider === "ollama" ? "local" : "cloud";
    const endpoint =
      result.provider === "ollama"
        ? (process.env as Record<string, string | undefined>)["OLLAMA_HOST"] ?? "http://127.0.0.1:11434"
        : result.provider === "g0dm0d3"
          ? (process.env as Record<string, string | undefined>)["OPENROUTER_BASE_URL"] ?? "https://openrouter.ai/api/v1"
          : result.provider === "cloud"
            ? (process.env as Record<string, string | undefined>)["NVIDIA_NIM_BASE_URL"] ?? "https://integrate.api.nvidia.com/v1"
            : "https://unknown";

    if (providerType === "local") {
      return {
        type: "local",
        endpoint,
        model: result.model,
        output: result.output,
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
        costUsd: 0,
        latencyMs: result.latencyMs,
      };
    }

    const providerIdMap: Record<string, "openrouter" | "nvidia-nim" | "openai" | "anthropic" | "ollama-local" | "ollama-g0dm0d3"> = {
      g0dm0d3: "openrouter",
      cloud: "nvidia-nim",
      keylessai: "openai",
      freetheai: "openai",
      "free-ai-router": "openai",
      puter: "anthropic",
    };

    return {
      type: "cloud",
      endpoint,
      model: result.model,
      providerId: providerIdMap[result.provider] ?? "openrouter",
      output: result.output,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      costUsd: result.costUsd,
      latencyMs: result.latencyMs,
    };
  } catch (err) {
    return { type: "none", reason: `all_providers_exhausted: ${(err as Error).message}` };
  }
}
