import type { TaskConfig, ProviderDecision } from "../types/provider.js";
import type { BudgetDecision } from "../types/budget.js";
import { getOnlineDevices } from "../g0dm0d3/registry.js";
import { executeLocal, isLocalAlive } from "../g0dm0d3/executor.js";
import { getHealthyProviders } from "./registry.js";
import { decide as budgetDecide } from "../budget/gate.js";
import { buildEstimate } from "../budget/tokens.js";

export async function pickProvider(task: TaskConfig): Promise<ProviderDecision> {
  if (task.preferLocal !== false) {
    const localAlive = await isLocalAlive();
    if (localAlive) {
      const model = task.modelHints[0] ?? process.env.OLLAMA_LOCAL_MODEL ?? "llama3.2";
      const result = await executeLocal({
        endpoint: process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434",
        model,
        prompt: task.prompt,
        system: task.systemPrompt,
      });
      if (result) {
        return {
          type: "local",
          endpoint: process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434",
          model: result.model,
          output: result.output,
          tokensIn: result.tokensIn,
          tokensOut: result.tokensOut,
          costUsd: 0,
          latencyMs: result.latencyMs,
        };
      }
    }
  }

  if (task.preferLocal !== false) {
    const devices = getOnlineDevices();
    for (const device of devices) {
      if (device.capabilityScore < 0.3) continue;
      const model = task.modelHints[0] ?? device.models[0] ?? "";
      if (!model) continue;
      const result = await executeLocal({
        endpoint: `http://${device.ip}:${device.port}`,
        model,
        prompt: task.prompt,
        system: task.systemPrompt,
      });
      if (result) {
        return {
          type: "local",
          endpoint: `http://${device.ip}:${device.port}`,
          model: result.model,
          deviceId: device.id,
          output: result.output,
          tokensIn: result.tokensIn,
          tokensOut: result.tokensOut,
          costUsd: 0,
          latencyMs: result.latencyMs,
        };
      }
    }
  }

  const estimate = buildEstimate({
    systemPrompt: task.systemPrompt,
    messages: task.messages,
    expectedOutputTokens: Math.min(task.maxTokens, 4096),
    providerId: "nvidia-nim",
  });

  const budgetDecision: BudgetDecision = await budgetDecide({
    agentId: task.agentId,
    channel: "cloud",
    estimatedTokens: estimate.totalTokens,
    estimatedCostUsd: estimate.costUsd,
    priority: task.priority,
  });

  if (!budgetDecision.allow) {
    return { type: "none", reason: budgetDecision.reason };
  }

  const healthy = getHealthyProviders();
  if (healthy.length === 0) {
    return { type: "none", reason: "all_providers_exhausted" };
  }

  const provider = healthy[0]!;
  return {
    type: "cloud",
    endpoint: provider.baseUrl,
    model: task.modelHints[0] ?? provider.models[0] ?? "",
    providerId: provider.id,
    costUsd: estimate.costUsd,
  };
}