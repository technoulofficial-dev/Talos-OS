/**
 * Talos OS v8.0 — Agent Types
 * Strict type definitions for all agents in the Talos swarm.
 */

import { z } from "zod";

// ============================================================
// Agent Identity
// ============================================================

/** The 12 core agents + generated agents */
export const AgentIdSchema = z.enum([
  "loom",
  "odin",
  "mimir",
  "brokkr",
  "opencode",
  "huginn",
  "sage",
  "muninn",
  "nornir",
  "eitri",
  "bragi",
  "system",
]);
export type AgentId = z.infer<typeof AgentIdSchema>;

/** All known agent IDs including generated */
export const AnyAgentIdSchema = z.union([
  AgentIdSchema,
  z.string().startsWith("gen-"), // generated agents: gen-<name>
]);
export type AnyAgentId = z.infer<typeof AnyAgentIdSchema>;

// ============================================================
// Agent Guild
// ============================================================

export const GuildIdSchema = z.enum([
  "crown",    // Strategy, governance, user liaison
  "forge",    // Code creation, testing, deployment
  "sanctum",  // Research, data synthesis
  "vault",    // Memory, knowledge, identity
  "foundry",  // Agent fabrication (Eitri)
]);
export type GuildId = z.infer<typeof GuildIdSchema>;

// ============================================================
// Agent Capability
// ============================================================

export const CapabilitySchema = z.object({
  /** Skill identifier (e.g., "typescript", "nextjs", "research", "marketing") */
  skill: z.string(),
  /** Proficiency 0.0 to 1.0 */
  proficiency: z.number().min(0).max(1),
});
export type Capability = z.infer<typeof CapabilitySchema>;

// ============================================================
// Agent Specification (used by Eitri for fabrication)
// ============================================================

export const AgentSpecSchema = z.object({
  /** Unique agent identifier */
  agentId: z.string(),
  /** Display name */
  name: z.string(),
  /** Which guild this agent belongs to */
  guild: GuildIdSchema,
  /** Human-readable role description */
  role: z.string(),
  /** System prompt content */
  systemPrompt: z.string(),
  /** Model ID for cloud execution */
  cloudModel: z.string(),
  /** Model name for local Ollama execution */
  localModel: z.string().optional(),
  /** Maximum context window in tokens */
  maxContextTokens: z.number().int().positive(),
  /** Temperature setting */
  temperature: z.number().min(0).max(2).default(0.4),
  /** Skills this agent can perform */
  capabilities: z.array(CapabilitySchema),
  /** Tools this agent has access to */
  tools: z.array(z.string()),
  /** Whether this agent is pinned (cannot be replaced by Eitri) */
  pinned: z.boolean().default(false),
  /** Docker image path (for containerized agents) */
  dockerImage: z.string().optional(),
  /** Agent version */
  version: z.string().default("1.0.0"),
});
export type AgentSpec = z.infer<typeof AgentSpecSchema>;

// ============================================================
// Agent Runtime State
// ============================================================

export const AgentStatusSchema = z.enum([
  "idle",
  "bidding",
  "executing",
  "offline",
  "provisioning",
  "error",
]);
export type AgentStatus = z.infer<typeof AgentStatusSchema>;

export const AgentStateSchema = z.object({
  agentId: AnyAgentIdSchema,
  status: AgentStatusSchema,
  /** Current capability score (updated by Loom feedback loop) */
  capabilityScore: z.number().min(0).max(1).default(0.5),
  /** Current load (0 = idle, 1 = fully loaded) */
  currentLoad: z.number().min(0).max(1).default(0),
  /** Total tasks completed */
  tasksCompleted: z.number().int().default(0),
  /** Average latency in ms */
  avgLatencyMs: z.number().default(0),
  /** Last heartbeat timestamp */
  lastHeartbeat: z.date(),
  /** Error count in current period */
  errorCount: z.number().int().default(0),
});
export type AgentState = z.infer<typeof AgentStateSchema>;

// ============================================================
// Agent Registry Entry (database record)
// ============================================================

export const AgentRegistryEntrySchema = z.object({
  id: z.string().uuid(),
  agentId: AnyAgentIdSchema,
  name: z.string(),
  guildId: z.string().uuid().nullable(),
  role: z.string(),
  primaryModel: z.string(),
  cloudModel: z.string(),
  localModel: z.string().nullable(),
  maxContextTokens: z.number().int(),
  capabilities: z.array(CapabilitySchema),
  tools: z.array(z.string()),
  pinned: z.boolean(),
  dockerImage: z.string().nullable(),
  version: z.string(),
  capabilityScore: z.number(),
  currentLoad: z.number(),
  status: AgentStatusSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type AgentRegistryEntry = z.infer<typeof AgentRegistryEntrySchema>;