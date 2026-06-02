import type { TaskConfig, ProviderDecision } from "../types/provider.js";
import { pickProvider } from "./policy.js";
import { recordTrace } from "./trace.js";

export async function route(task: TaskConfig): Promise<ProviderDecision> {
  const start = Date.now();
  const decision = await pickProvider(task);

  await recordTrace({
    taskId: task.agentId,
    agentId: task.agentId,
    decision: decision.type,
    reason: decision.type === "none" ? decision.reason : "success",
    endpoint: decision.type !== "none" ? decision.endpoint : undefined,
    model: decision.type !== "none" ? decision.model : undefined,
    latencyMs: Date.now() - start,
    costUsd: decision.type === "cloud" ? decision.costUsd : 0,
  });

  return decision;
}