/**
 * Talos OS v8.0 — Task Types
 * Strict type definitions for task lifecycle management.
 */

import { z } from "zod";
import { AgentIdSchema, AnyAgentIdSchema } from "./agent.js";

// ============================================================
// Task Status
// ============================================================

export const TaskStatusSchema = z.enum([
  "pending",
  "queued",
  "auctioning",
  "assigned",
  "executing",
  "reviewing",
  "completed",
  "failed",
  "cancelled",
  "timeout",
]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

// ============================================================
// Task Priority
// ============================================================

export const TaskPrioritySchema = z.enum(["low", "normal", "high", "critical"]);
export type TaskPriority = z.infer<typeof TaskPrioritySchema>;

// ============================================================
// Task Request (what gets submitted)
// ============================================================

export const TaskRequestSchema = z.object({
  /** Unique task identifier (auto-generated UUID) */
  taskId: z.string().uuid().optional(),
  /** Human-readable description of what needs to be done */
  description: z.string().min(1),
  /** Agent that requested this task (or "system") */
  originAgent: AnyAgentIdSchema.default("system"),
  /** Required skills for this task */
  requiredSkills: z.array(z.string()).default([]),
  /** Preferred model hints */
  modelHints: z.array(z.string()).optional(),
  /** Maximum tokens allowed for this task */
  maxTokens: z.number().int().positive().default(100000),
  /** Task priority */
  priority: TaskPrioritySchema.default("normal"),
  /** Maximum cost in USD (hard cap) */
  maxCostUsd: z.number().nonnegative().default(10),
  /** Deadline in milliseconds from now */
  deadlineMs: z.number().int().positive().optional(),
  /** Idempotency key for retry safety */
  idempotencyKey: z.string().optional(),
  /** Whether to prefer local execution */
  preferLocal: z.boolean().default(true),
  /** Task dependencies (other task IDs that must complete first) */
  dependsOn: z.array(z.string().uuid()).default([]),
  /** Arbitrary context payload */
  context: z.record(z.unknown()).default({}),
});
export type TaskRequest = z.infer<typeof TaskRequestSchema>;

// ============================================================
// Task Result (what gets returned)
// ============================================================

export const TaskResultSchema = z.object({
  /** Task identifier */
  taskId: z.string().uuid(),
  /** Final status */
  status: TaskStatusSchema,
  /** Agent that executed the task */
  assignedAgent: AnyAgentIdSchema.optional(),
  /** Output content */
  output: z.string().optional(),
  /** Error message if failed */
  error: z.string().optional(),
  /** Error code (TAL-xxx) */
  errorCode: z.string().optional(),
  /** Tokens consumed */
  tokensUsed: z.number().int().nonnegative().default(0),
  /** Cost in USD */
  costUsd: z.number().nonnegative().default(0),
  /** Execution time in milliseconds */
  durationMs: z.number().int().nonnegative().default(0),
  /** Execution trace (which provider was used, etc.) */
  trace: z.record(z.unknown()).optional(),
  /** Completion timestamp */
  completedAt: z.date().optional(),
});
export type TaskResult = z.infer<typeof TaskResultSchema>;

// ============================================================
// Task (database record — full lifecycle)
// ============================================================

export const TaskSchema = z.object({
  /** UUID primary key */
  id: z.string().uuid(),
  /** Task description */
  description: z.string(),
  /** Origin agent */
  originAgent: AnyAgentIdSchema,
  /** Current status */
  status: TaskStatusSchema,
  /** Priority */
  priority: TaskPrioritySchema,
  /** Required skills */
  requiredSkills: z.array(z.string()),
  /** Maximum tokens */
  maxTokens: z.number().int(),
  /** Maximum cost in USD */
  maxCostUsd: z.number(),
  /** Assigned agent ID */
  assignedAgent: AnyAgentIdSchema.nullable(),
  /** Related auction ID */
  auctionId: z.string().uuid().nullable(),
  /** Plan graph (JSON) for visual flow chart */
  planGraph: z.record(z.unknown()).nullable(),
  /** Result output */
  output: z.string().nullable(),
  /** Error info */
  error: z.string().nullable(),
  /** Error code */
  errorCode: z.string().nullable(),
  /** Tokens consumed */
  tokensUsed: z.number().int().default(0),
  /** Actual cost in USD */
  costUsd: z.number().default(0),
  /** Execution duration in ms */
  durationMs: z.number().int().default(0),
  /** Retry count */
  retryCount: z.number().int().default(0),
  /** Max retries */
  maxRetries: z.number().int().default(3),
  /** Idempotency key */
  idempotencyKey: z.string().nullable(),
  /** Whether local execution was preferred */
  preferLocal: z.boolean().default(true),
  /** Task dependencies */
  dependsOn: z.array(z.string().uuid()).default([]),
  /** Context payload */
  context: z.record(z.unknown()).default({}),
  /** Creation timestamp */
  createdAt: z.date(),
  /** Last update timestamp */
  updatedAt: z.date(),
  /** Deadline */
  deadline: z.date().nullable(),
  /** Completion timestamp */
  completedAt: z.date().nullable(),
});
export type Task = z.infer<typeof TaskSchema>;

// ============================================================
// Plan Card (Odin generates this)
// ============================================================

export const PlanStepSchema = z.object({
  id: z.string(),
  title: z.string(),
  agent: AgentIdSchema,
  modelHint: z.string().optional(),
  dependsOn: z.array(z.string()).default([]),
  estimateTokens: z.number().int().positive(),
});
export type PlanStep = z.infer<typeof PlanStepSchema>;

export const PlanCardSchema = z.object({
  goal: z.string(),
  steps: z.array(PlanStepSchema).min(1),
  risks: z.array(z.string()),
  estimatedCost: z.object({
    usd: z.number().nonnegative(),
    tokens: z.number().int().positive(),
  }),
  requiresApproval: z.boolean().default(true),
});
export type PlanCard = z.infer<typeof PlanCardSchema>;