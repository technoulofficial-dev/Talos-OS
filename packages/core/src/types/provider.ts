/**
 * Talos OS v8.0 — Provider Types
 * Type definitions for the hybrid AI provider routing system.
 */

import { z } from "zod";
import { AnyAgentIdSchema } from "./agent.js";

// ============================================================
// Provider Type
// ============================================================

export const ProviderTypeSchema = z.enum(["local", "cloud", "none"]);
export type ProviderType = z.infer<typeof ProviderTypeSchema>;

// ============================================================
// Provider Identity
// ============================================================

export const ProviderIdSchema = z.enum([
  "ollama-local",
  "ollama-g0dm0d3",
  "nvidia-nim",
  "openai",
  "anthropic",
]);
export type ProviderId = z.infer<typeof ProviderIdSchema>;

// ============================================================
// Task Configuration (what the router needs to know)
// ============================================================

export const TaskConfigSchema = z.object({
  /** Agent requesting the task */
  agentId: AnyAgentIdSchema,
  /** Maximum output tokens */
  maxTokens: z.number().int().positive(),
  /** Temperature */
  temperature: z.number().min(0).max(2),
  /** Whether to prefer local execution */
  preferLocal: z.boolean().default(true),
  /** Task priority for budget gating */
  priority: z.enum(["low", "normal", "high", "critical"]).default("normal"),
  /** Required skills (for provider selection) */
  requiredSkills: z.array(z.string()).default([]),
  /** Model hints (specific model IDs preferred) */
  modelHints: z.array(z.string()).default([]),
  /** Whether the task requires web search / tools */
  requiresTools: z.boolean().default(false),
  /** System prompt */
  systemPrompt: z.string().optional(),
  /** User prompt / task content */
  prompt: z.string(),
  /** Previous messages for chat context */
  messages: z.array(z.object({
    role: z.enum(["system", "user", "assistant"]),
    content: z.string(),
  })).default([]),
});
export type TaskConfig = z.infer<typeof TaskConfigSchema>;

// ============================================================
// Provider Result
// ============================================================

export const ProviderResultSchema = z.object({
  /** Which provider was used */
  type: ProviderTypeSchema,
  /** Provider endpoint URL */
  endpoint: z.string().url(),
  /** Model ID used */
  model: z.string(),
  /** If G0DM0D3 device, which device */
  deviceId: z.string().optional(),
  /** If cloud, the provider name */
  providerId: ProviderIdSchema.optional(),
  /** Generated output */
  output: z.string(),
  /** Tokens consumed (input) */
  tokensIn: z.number().int().nonnegative(),
  /** Tokens consumed (output) */
  tokensOut: z.number().int().nonnegative(),
  /** Cost in USD (0 for local) */
  costUsd: z.number().nonnegative().default(0),
  /** Latency in ms */
  latencyMs: z.number().int().nonnegative(),
  /** Whether the response was streamed */
  streamed: z.boolean().default(false),
  /** Raw response metadata */
  metadata: z.record(z.unknown()).default({}),
});
export type ProviderResult = z.infer<typeof ProviderResultSchema>;

// ============================================================
// Provider Decision (what the router returns)
// ============================================================

export const ProviderDecisionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("local"),
    endpoint: z.string(),
    model: z.string(),
    deviceId: z.string().optional(),
    output: z.string().optional(),
    tokensIn: z.number().int().default(0),
    tokensOut: z.number().int().default(0),
    costUsd: z.literal(0),
    latencyMs: z.number().int().default(0),
  }),
  z.object({
    type: z.literal("cloud"),
    endpoint: z.string(),
    model: z.string(),
    providerId: ProviderIdSchema,
    output: z.string().optional(),
    tokensIn: z.number().int().default(0),
    tokensOut: z.number().int().default(0),
    costUsd: z.number().nonnegative(),
    latencyMs: z.number().int().default(0),
  }),
  z.object({
    type: z.literal("none"),
    reason: z.string(),
  }),
]);
export type ProviderDecision = z.infer<typeof ProviderDecisionSchema>;

// ============================================================
// Provider Health
// ============================================================

export const ProviderHealthSchema = z.object({
  providerId: ProviderIdSchema,
  healthy: z.boolean(),
  latencyMs: z.number().int().nonnegative(),
  lastChecked: z.date(),
  errorCount: z.number().int().default(0),
  errorMessage: z.string().optional(),
});
export type ProviderHealth = z.infer<typeof ProviderHealthSchema>;

// ============================================================
// Cost Estimate (for budget gating before execution)
// ============================================================

export const CostEstimateSchema = z.object({
  /** Estimated tokens for the full task */
  tokens: z.number().int().positive(),
  /** Estimated USD cost */
  usd: z.number().nonnegative(),
  /** Which provider this estimate is for */
  providerId: ProviderIdSchema,
  /** Confidence in the estimate (0-1) */
  confidence: z.number().min(0).max(1).default(0.5),
});
export type CostEstimate = z.infer<typeof CostEstimateSchema>;