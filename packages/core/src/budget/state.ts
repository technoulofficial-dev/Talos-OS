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
  const raw = {
    monthly_usd: parseFloat(process.env.BUDGET_MONTHLY_USD ?? String(DEFAULT_CONFIG.monthly_usd)),
    hourly_usd: parseFloat(process.env.BUDGET_HOURLY_USD ?? String(DEFAULT_CONFIG.hourly_usd)),
    per_task_tokens: parseInt(process.env.BUDGET_PER_TASK_TOKENS ?? String(DEFAULT_CONFIG.per_task_tokens), 10),
    per_minute_requests: parseInt(process.env.BUDGET_PER_MINUTE_REQUESTS ?? String(DEFAULT_CONFIG.per_minute_requests), 10),
    hard_kill_at: parseFloat(process.env.BUDGET_HARD_KILL_AT ?? String(DEFAULT_CONFIG.hard_kill_at)),
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