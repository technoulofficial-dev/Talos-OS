import { z } from "zod";
import {
  BudgetStateSchema,
  BudgetConfigSchema,
  type BudgetState,
  type BudgetConfig,
} from "../types/budget.js";

const DEFAULT_CONFIG: BudgetConfig = {
  monthly_usd: 50,
  hourly_usd: 5,
  per_task_tokens: 100000,
  per_minute_requests: 30,
  hard_kill_at: 0.95,
};

export function getCurrentMonthPeriod(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function getCurrentHourPeriod(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}T${String(now.getUTCHours()).padStart(2, "0")}`;
}

export function loadBudgetConfig(): BudgetConfig {
  const env = (key: string, fallback: number): number => {
    const val = (process.env as Record<string, string | undefined>)[key];
    return val !== undefined ? parseFloat(val) : fallback;
  };
  const raw = {
    monthly_usd: env("BUDGET_MONTHLY_USD", DEFAULT_CONFIG.monthly_usd),
    hourly_usd: env("BUDGET_HOURLY_USD", DEFAULT_CONFIG.hourly_usd),
    per_task_tokens: parseInt((process.env as Record<string, string | undefined>)["BUDGET_PER_TASK_TOKENS"] ?? String(DEFAULT_CONFIG.per_task_tokens), 10),
    per_minute_requests: parseInt((process.env as Record<string, string | undefined>)["BUDGET_PER_MINUTE_REQUESTS"] ?? String(DEFAULT_CONFIG.per_minute_requests), 10),
    hard_kill_at: env("BUDGET_HARD_KILL_AT", DEFAULT_CONFIG.hard_kill_at),
  };
  return BudgetConfigSchema.parse(raw);
}

export function buildBudgetState(config?: BudgetConfig): BudgetState {
  const cfg = config ?? loadBudgetConfig();
  return BudgetStateSchema.parse({
    periodId: getCurrentMonthPeriod(),
    period: "monthly",
    monthlyCapUsd: cfg.monthly_usd,
    hourlyCapUsd: cfg.hourly_usd,
    perTaskTokenCap: cfg.per_task_tokens,
    perMinuteRequests: cfg.per_minute_requests,
    hardKillAt: cfg.hard_kill_at,
    enabled: true,
  });
}