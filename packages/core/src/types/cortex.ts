/**
 * Talos OS v8.0 — Cortex Types
 * Type definitions for the User Cortex & Nornir memory system.
 */

import { z } from "zod";

// ============================================================
// Identity Core (the permanent memory anchor)
// ============================================================

export const IdentityCoreSchema = z.object({
  /** User's long-term goals */
  goals: z.array(z.string()),
  /** Personality traits and preferences */
  personality: z.array(z.string()),
  /** Decision heuristics */
  heuristics: z.array(z.string()),
  /** Strategic mandate (e.g., Metis 20-year plan) */
  strategicMandate: z.string().default(""),
  /** Key entities (people, projects, companies) */
  entities: z.array(z.object({
    name: z.string(),
    relationship: z.string(),
    notes: z.string().default(""),
  })),
  /** Last consolidation timestamp */
  lastConsolidatedAt: z.date().optional(),
});
export type IdentityCore = z.infer<typeof IdentityCoreSchema>;

// ============================================================
// Thread of Fate (the rolling conversation memory)
// ============================================================

/** A verbatim message in the recent window */
export const VerbatimMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
  timestamp: z.date(),
  agentId: z.string().optional(),
});
export type VerbatimMessage = z.infer<typeof VerbatimMessageSchema>;

/** A compressed mid-range summary */
export const MidRangeSummarySchema = z.object({
  /** Turn range start (inclusive) */
  turnStart: z.number().int(),
  /** Turn range end (exclusive) */
  turnEnd: z.number().int(),
  /** Compressed abstract paragraph */
  summary: z.string(),
  /** Key entities mentioned */
  entities: z.array(z.string()),
  /** Timestamp range */
  from: z.date(),
  to: z.date(),
});
export type MidRangeSummary = z.infer<typeof MidRangeSummarySchema>;

/** A distant episodic marker */
export const DistantMarkerSchema = z.object({
  timestamp: z.date(),
  eventType: z.string(),
  summary: z.string(),
  entities: z.array(z.string()),
  importanceScore: z.number().min(0).max(1),
});
export type DistantMarker = z.infer<typeof DistantMarkerSchema>;

/** The complete Thread of Fate structure */
export const ThreadOfFateSchema = z.object({
  /** Recent messages (last 50 turns) — verbatim */
  verbatim: z.array(VerbatimMessageSchema),
  /** Mid-range summaries (turns 51-200, compressed per 20-turn block) */
  midRange: z.array(MidRangeSummarySchema),
  /** Distant episodic markers (turns >200) */
  distant: z.array(DistantMarkerSchema),
});
export type ThreadOfFate = z.infer<typeof ThreadOfFateSchema>;

// ============================================================
// User Cortex (the complete memory structure)
// ============================================================

export const UserCortexSchema = z.object({
  /** User ID */
  userId: z.string().uuid(),
  /** Identity Core — permanent, long-term memory */
  identityCore: IdentityCoreSchema,
  /** Thread of Fate — rolling window with progressive compression */
  threadOfFate: ThreadOfFateSchema,
  /** Pre-assembled Thread Digest for injection (max ~6K tokens) */
  threadDigest: z.string().default(""),
  /** Retrieved context (on-demand, top-3 relevant past conversations) */
  retrievedContext: z.array(z.object({
    summary: z.string(),
    timestamp: z.date(),
    relevanceScore: z.number().min(0).max(1),
    tokensEstimate: z.number().int().positive(),
  })),
  /** Last update timestamp */
  updatedAt: z.date(),
});
export type UserCortex = z.infer<typeof UserCortexSchema>;

// ============================================================
// Cortex Injection (what gets prepended to system prompts)
// ============================================================

export const CortexInjectionSchema = z.object({
  /** The full injection text */
  text: z.string(),
  /** How many tokens this injection occupies */
  tokenCount: z.number().int().nonnegative(),
  /** Budget remaining for the current context window */
  budgetRemaining: z.number().int().nonnegative(),
  /** Whether the injection was truncated */
  truncated: z.boolean().default(false),
  /** Components included */
  components: z.object({
    identityCore: z.boolean(),
    recentThread: z.boolean(),
    recentSummaries: z.boolean(),
    distantMarkers: z.boolean(),
    retrievedContext: z.boolean(),
  }),
});
export type CortexInjection = z.infer<typeof CortexInjectionSchema>;

// ============================================================
// Nornir Consolidation Task
// ============================================================

export const ConsolidationTaskSchema = z.object({
  userId: z.string().uuid(),
  /** Which Nornir component runs this */
  component: z.enum(["urd", "verdandi", "skuld"]),
  /** What kind of consolidation */
  action: z.enum([
    "update_identity_core",
    "compress_mid_range",
    "create_distant_marker",
    "prefetch_context",
    "archive_old_verbatims",
  ]),
  /** Priority */
  priority: z.enum(["low", "normal", "high"]),
  /** Scheduled timestamp */
  scheduledAt: z.date(),
  /** Completed timestamp */
  completedAt: z.date().optional(),
});
export type ConsolidationTask = z.infer<typeof ConsolidationTaskSchema>;

// ============================================================
// Memory Budget Limits
// ============================================================

export const CortexConfigSchema = z.object({
  /** Max tokens for the entire cortex injection */
  max_injection_tokens: z.number().int().default(12000),
  /** How many recent turns to keep verbatim */
  verbatim_window: z.number().int().default(50),
  /** How many turns per mid-range block */
  mid_range_block: z.number().int().default(20),
  /** Turn count after which messages become distant markers */
  distant_threshold: z.number().int().default(200),
});
export type CortexConfig = z.infer<typeof CortexConfigSchema>;