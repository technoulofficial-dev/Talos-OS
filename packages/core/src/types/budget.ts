/**
 * Talos OS v8.0 — Budget Types
 * Type definitions for the credit & API call controller (SYS-BUDGET).
 * NO cloud call bypasses these types.
 */

import { z } from "zod";
import { AnyAgentIdSchema } from "./agent.js";

// ============================================================
// Budget Decision (the core chokepoint output)
// ============================================================

export const BudgetDecisionSchema = z.discriminatedUnion("allow", [
  z.object({
    allow: z.literal(true),
    reason: z.enum(["under_budget", "local_task", "emergency_override"]),
    overrideBy: z.string().optional(),
  }),
  z.object({
    allow: z.literal(false),
    reason: z.enum([
      "monthly_cap_hit",
      "hourly_cap_hit",
      "rate_limited",
      "task_too_large",
      "hard_kill_triggered",
      "unknown_channel",
    ]),
  }),
]);
export type BudgetDecision = z.infer<typeof BudgetDecisionSchema>;

// ============================================================
// Budget Check Request (what gets sent to the gate)
// ============================================================

export const BudgetCheckRequestSchema = z.object({
  /** Which agent is making the call */
  agentId: AnyAgentIdSchema,
  /** Is this local ($0) or cloud ($) */
  channel: z.enum(["local", "cloud"]),
  /** Estimated tokens for this call */
  estimatedTokens: z.number().int().positive(),
  /** Estimated USD cost */
  estimatedCostUsd: z.number().nonnegative(),
  /** Task priority (critical can override soft limits) */
  priority: z.enum(["low", "normal", "high", "critical"]),
  /** Optional: which provider will be used */
  providerId: z.string().optional(),
});
export type BudgetCheckRequest = z.infer<typeof BudgetCheckRequestSchema>;

// ============================================================
// Budget State (snapshot of current period spending)
// ============================================================

export const BudgetPeriodSchema = z.enum(["hourly", "monthly"]);
export type BudgetPeriod = z.infer<typeof BudgetPeriodSchema>;

export const BudgetStateSchema = z.object({
  /** Current period identifier (e.g., "2026-06" or "2026-06-01T07:00") */
  periodId: z.string(),
  /** Period type */
  period: BudgetPeriodSchema,
  /** Monthly spending cap in USD */
  monthlyCapUsd: z.number().nonnegative(),
  /** Hourly spending cap in USD */
  hourlyCapUsd: z.number().nonnegative(),
  /** Per-task token cap */
  perTaskTokenCap: z.number().int().positive(),
  /** Per-minute request rate cap */
  perMinuteRequests: z.number().int().positive(),
  /** Hard kill threshold (0-1, e.g. 0.95 = kill at 95% of monthly cap) */
  hardKillAt: z.number().min(0).max(1),
  /** Whether budget gating is enabled */
  enabled: z.boolean().default(true),
});
export type BudgetState = z.infer<typeof BudgetStateSchema>;

// ============================================================
// Spend Record (individual API call cost entry)
// ============================================================

export const SpendRecordSchema = z.object({
  /** Unique record ID */
  id: z.string().uuid().optional(),
  /** Agent that made the call */
  agentId: AnyAgentIdSchema,
  /** Provider used */
  providerId: z.string(),
  /** Tokens consumed (input) */
  tokensIn: z.number().int().nonnegative(),
  /** Tokens consumed (output) */
  tokensOut: z.number().int().nonnegative(),
  /** Total tokens */
  totalTokens: z.number().int().nonnegative(),
  /** Cost in USD */
  costUsd: z.number().nonnegative(),
  /** Task ID (if applicable) */
  taskId: z.string().uuid().optional(),
  /** Timestamp */
  timestamp: z.date(),
  /** Period ID for aggregation */
  periodId: z.string(),
});
export type SpendRecord = z.infer<typeof SpendRecordSchema>;

// ============================================================
// Spend Ledger Summary (aggregated by period)
// ============================================================

export const SpendLedgerSummarySchema = z.object({
  /** Current period ID */
  currentPeriod: z.string(),
  /** Total USD spent in current month */
  monthlyUsd: z.number().nonnegative(),
  /** Total USD spent in current hour */
  hourlyUsd: z.number().nonnegative(),
  /** Total tokens used this month */
  monthlyTokens: z.number().int().nonnegative(),
  /** Total API calls this minute (for rate limiting) */
  minuteRequests: z.number().int().nonnegative(),
  /** Last request timestamp */
  lastRequestAt: z.date().optional(),
  /** Records for the current period */
  records: z.array(SpendRecordSchema),
});
export type SpendLedgerSummary = z.infer<typeof SpendLedgerSummarySchema>;

// ============================================================
// Rate Limit Check
// ============================================================

export const RateLimitCheckSchema = z.object({
  allowed: z.boolean(),
  remaining: z.number().int().nonnegative(),
  resetAtMs: z.number().int(),
  retryAfterMs: z.number().int().nonnegative().optional(),
});
export type RateLimitCheck = z.infer<typeof RateLimitCheckSchema>;

// ============================================================
// Token Estimate (from tiktoken or approximation)
// ============================================================

export const TokenEstimateSchema = z.object({
  /** Estimated input tokens */
  inputTokens: z.number().int().positive(),
  /** Estimated output tokens */
  outputTokens: z.number().int().positive(),
  /** Total tokens */
  totalTokens: z.number().int().positive(),
  /** Estimated cost in USD (0 for local) */
  costUsd: z.number().nonnegative(),
  /** Which provider this estimate is for */
  providerId: z.string(),
  /** Cost per input token */
  costPerInputToken: z.number().nonnegative(),
  /** Cost per output token */
  costPerOutputToken: z.number().nonnegative(),
});
export type TokenEstimate = z.infer<typeof TokenEstimateSchema>;

// ============================================================
// Budget Config (from talos.config.yaml, validated by zod)
// ============================================================

export const BudgetConfigSchema = z.object({
  monthly_usd: z.number().nonnegative().default(50),
  hourly_usd: z.number().nonnegative().default(5),
  per_task_tokens: z.number().int().positive().default(100000),
  per_minute_requests: z.number().int().positive().default(30),
  hard_kill_at: z.number().min(0).max(1).default(0.95),
});
export type BudgetConfig = z.infer<typeof BudgetConfigSchema>;

// ============================================================
// Error Code Constants
// ============================================================

export const BUDGET_ERROR_CODES = {
  MONTHLY_CAP_HIT: "TAL-B01",
  HOURLY_CAP_HIT: "TAL-B02",
  RATE_LIMITED: "TAL-B03",
  TASK_TOO_LARGE: "TAL-B04",
  HARD_KILL: "TAL-B05",
} as const;