/**
 * SYS-ROUTER R0: Router
 * Entry point for all AI routing decisions.
 *
 * Context Budget: Every call is pre-checked. If 95% of context used,
 * the router returns type="none" with reason="context_budget_exceeded".
 */

import { randomUUID } from "crypto";
import type { TaskConfig, ProviderDecision } from "../types/provider.js";
import { pickProvider } from "./policy.js";
import { recordTrace } from "./trace.js";
import { checkContextBudget, estimateConversationTokens } from "../cortex/context-budget.js";

export interface ContextBudgetInfo {
  currentTokens: number;
  maxTokens: number;
  usedPct: number;
  snapshotNeeded: boolean;
  severity: string;
  message: string;
}

export type RouteResult = ProviderDecision & {
  contextBudget?: ContextBudgetInfo;
};

const DEFAULT_CONTEXT_WINDOW = 128_000;

export async function route(task: TaskConfig): Promise<RouteResult> {
  const traceId = randomUUID();
  const start = Date.now();

  const totalTokens = estimateConversationTokens(
    task.messages ?? [],
    task.systemPrompt ?? ""
  );

  const budget = checkContextBudget(
    totalTokens,
    DEFAULT_CONTEXT_WINDOW,
    0
  );

  if (budget.snapshotNeeded) {
    console.warn(`[router] Context budget exceeded (${budget.usedPct}%) — snapshot required before continuing`);

    const decision: RouteResult = {
      type: "none",
      reason: "context_budget_exceeded",
      contextBudget: {
        currentTokens: budget.currentTokens,
        maxTokens: budget.maxTokens,
        usedPct: budget.usedPct,
        snapshotNeeded: true,
        severity: budget.severity,
        message: budget.message,
      },
    };

    await recordTrace({
      taskId: traceId,
      agentId: task.agentId,
      decision: "snapshot_required",
      reason: `context_${budget.usedPct}pct`,
      latencyMs: Date.now() - start,
      costUsd: 0,
    });

    return decision;
  }

  const decision = await pickProvider(task);

  await recordTrace({
    taskId: traceId,
    agentId: task.agentId,
    decision: decision.type,
    reason: decision.type === "none" ? decision.reason : "success",
    endpoint: decision.type !== "none" ? decision.endpoint : undefined,
    model: decision.type !== "none" ? decision.model : undefined,
    latencyMs: Date.now() - start,
    costUsd: decision.type === "cloud" ? decision.costUsd ?? 0 : 0,
  });

  return {
    ...decision,
    contextBudget: {
      currentTokens: budget.currentTokens,
      maxTokens: budget.maxTokens,
      usedPct: budget.usedPct,
      snapshotNeeded: false,
      severity: budget.severity,
      message: budget.message,
    },
  };
}