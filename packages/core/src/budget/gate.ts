import type { BudgetCheckRequest, BudgetDecision } from "../types/budget.js";
import { buildBudgetState } from "./state.js";
import { getLedgerSummary } from "./ledger.js";
import { checkRateLimit } from "./rate.js";

/**
 * SYS-BUDGET B3: BudgetGate
 * The single chokepoint for ALL cloud API calls.
 * NO cloud call bypasses this function. Period.
 */
export async function decide(request: BudgetCheckRequest): Promise<BudgetDecision> {
  if (request.channel === "local") {
    return { allow: true, reason: "local_task" };
  }

  const state = buildBudgetState();
  if (!state.enabled) {
    return { allow: true, reason: "under_budget" };
  }

  const ledger = await getLedgerSummary();

  // Hard kill switch: 95% of monthly cap hit
  if (ledger.monthlyUsd / state.monthlyCapUsd >= state.hardKillAt) {
    return { allow: false, reason: "hard_kill_triggered" };
  }

  // Monthly cap
  if (ledger.monthlyUsd + request.estimatedCostUsd > state.monthlyCapUsd) {
    return { allow: false, reason: "monthly_cap_hit" };
  }

  // Hourly cap
  if (ledger.hourlyUsd + request.estimatedCostUsd > state.hourlyCapUsd) {
    return { allow: false, reason: "hourly_cap_hit" };
  }

  // Per-task token cap
  if (request.estimatedTokens > state.perTaskTokenCap) {
    return { allow: false, reason: "task_too_large" };
  }

  // Rate limit
  const rateCheck = await checkRateLimit(request.agentId, state.perMinuteRequests);
  if (!rateCheck.allowed) {
    return { allow: false, reason: "rate_limited" };
  }

  return { allow: true, reason: "under_budget" };
}