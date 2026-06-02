import type { BudgetDecision } from "../types/budget.js";

/**
 * SYS-BUDGET B6: BudgetAlerter
 * Alerts when budget thresholds are approached or breached.
 * Phase 1: console.warn. Phase 2+: webhook integration.
 */

export interface BudgetAlert {
  level: "warning" | "critical" | "denied";
  reason: string;
  message: string;
  timestamp: Date;
}

const alerts: BudgetAlert[] = [];

export function emitBudgetAlert(decision: BudgetDecision): void {
  if (decision.allow) return;

  let level: BudgetAlert["level"] = "warning";
  if (
    decision.reason === "hard_kill_triggered" ||
    decision.reason === "monthly_cap_hit"
  ) {
    level = "critical";
  } else {
    level = "denied";
  }

  const alert: BudgetAlert = {
    level,
    reason: decision.reason,
    message: `[TALOS BUDGET ${level.toUpperCase()}] Cloud call denied: ${decision.reason}`,
    timestamp: new Date(),
  };

  alerts.push(alert);
  console.warn(alert.message);
}

export function getRecentAlerts(limit: number = 50): BudgetAlert[] {
  return alerts.slice(-limit);
}

export function clearAlerts(): void {
  alerts.length = 0;
}