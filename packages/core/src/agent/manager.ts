/**
 * Agent Manager — unified agent lifecycle management.
 *
 * Responsibilities:
 *   1. CRUD operations for agents (create, get, list, update, delete)
 *   2. Hybrid seeding: .talos/agents.json → hardcoded core agents
 *   3. Dual-mode: in-memory always runs; DB writes gated behind TALOS_AGENT_DB_ENABLED
 *
 * This module is self-contained — no dependency on Loom.
 * Loom reads from this module's in-memory state for auction bidding.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentConfig {
  agentId: string;
  name: string;
  guildId?: string;
  role: string;
  primaryModel: string;
  cloudModel: string;
  localModel?: string;
  maxContextTokens: number;
  temperature?: number;
  capabilities: Array<{ skill: string; proficiency: number }>;
  tools: string[];
  pinned: boolean;
  dockerImage?: string;
  version: string;
}

export interface AgentState extends AgentConfig {
  capabilityScore: number;
  currentLoad: number;
  status: "idle" | "bidding" | "executing" | "offline" | "error";
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Core agent defaults (mirrors Loom's hardcoded list)
// ---------------------------------------------------------------------------

const CORE_AGENTS: Array<{ agentId: string; capabilityScore: number; role: string }> = [
  { agentId: "odin", capabilityScore: 0.9, role: "orchestrator" },
  { agentId: "mimir", capabilityScore: 0.85, role: "architect" },
  { agentId: "brokkr", capabilityScore: 0.8, role: "builder" },
  { agentId: "opencode", capabilityScore: 0.85, role: "coder" },
  { agentId: "muninn", capabilityScore: 0.8, role: "retriever" },
  { agentId: "huginn", capabilityScore: 0.8, role: "scout" },
  { agentId: "sage", capabilityScore: 0.8, role: "advisor" },
  { agentId: "nornir", capabilityScore: 0.75, role: "memory-weaver" },
  { agentId: "eitri", capabilityScore: 0.85, role: "fabricator" },
  { agentId: "bragi", capabilityScore: 0.75, role: "storyteller" },
  { agentId: "system", capabilityScore: 0.7, role: "system" },
];

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function agentDbEnabled(): boolean {
  return process.env["TALOS_AGENT_DB_ENABLED"] === "true";
}

function getConfigPath(): string {
  return resolve(process.cwd(), ".talos", "agents.json");
}

let _dbModule: typeof import("@talos/db") | null = null;
async function getDb() {
  if (!_dbModule) {
    try {
      _dbModule = await import("@talos/db");
    } catch {
      return null;
    }
  }
  return _dbModule;
}

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------

const agents: Map<string, AgentState> = new Map();

// ---------------------------------------------------------------------------
// CRUD Operations
// ---------------------------------------------------------------------------

/**
 * Create a new agent. Stores in-memory + optional DB.
 */
export async function createAgent(config: AgentConfig): Promise<AgentState> {
  if (agents.has(config.agentId)) {
    throw new Error(`Agent ${config.agentId} already exists`);
  }

  const state: AgentState = {
    ...config,
    capabilityScore: 0.5,
    currentLoad: 0,
    status: "idle",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Persist to DB
  if (agentDbEnabled()) {
    const db = await getDb();
    if (db) {
      try {
        await db.registerAgent({
          agentId: config.agentId,
          name: config.name,
          guildId: config.guildId,
          role: config.role,
          primaryModel: config.primaryModel,
          cloudModel: config.cloudModel,
          localModel: config.localModel,
          maxContextTokens: config.maxContextTokens,
          capabilities: config.capabilities,
          tools: config.tools,
          pinned: config.pinned,
          dockerImage: config.dockerImage,
          version: config.version,
          capabilityScore: 0.5,
          currentLoad: 0,
          status: "idle",
        });
      } catch {
        // DB sync failed; continue with in-memory
      }
    }
  }

  agents.set(config.agentId, state);
  return state;
}

/**
 * Get an agent by ID.
 */
export function getAgent(agentId: string): AgentState | null {
  return agents.get(agentId) ?? null;
}

/**
 * List all agents, optionally filtered by status.
 */
export function listAgents(status?: AgentState["status"]): AgentState[] {
  const all = Array.from(agents.values());
  if (status) return all.filter((a) => a.status === status);
  return all;
}

/**
 * Update an agent's configuration.
 */
export async function updateAgent(
  agentId: string,
  patch: Partial<Omit<AgentConfig, "agentId">>
): Promise<AgentState | null> {
  const existing = agents.get(agentId);
  if (!existing) return null;

  const updated: AgentState = {
    ...existing,
    ...patch,
    updatedAt: new Date(),
  };

  // Sync to DB
  if (agentDbEnabled()) {
    const db = await getDb();
    if (db) {
      try {
        const existingDb = await db.getAgent(agentId);
        if (existingDb) {
          await db.registerAgent({
            ...existingDb,
            ...(patch.name && { name: patch.name }),
            ...(patch.guildId && { guildId: patch.guildId }),
            ...(patch.role && { role: patch.role }),
            ...(patch.primaryModel && { primaryModel: patch.primaryModel }),
            ...(patch.cloudModel && { cloudModel: patch.cloudModel }),
            ...(patch.localModel !== undefined && { localModel: patch.localModel }),
            ...(patch.maxContextTokens && { maxContextTokens: patch.maxContextTokens }),
            ...(patch.capabilities && { capabilities: patch.capabilities }),
            ...(patch.tools && { tools: patch.tools }),
            ...(patch.pinned !== undefined && { pinned: patch.pinned }),
            ...(patch.dockerImage !== undefined && { dockerImage: patch.dockerImage }),
            ...(patch.version && { version: patch.version }),
          });
        }
      } catch {
        // DB sync failed
      }
    }
  }

  agents.set(agentId, updated);
  return updated;
}

/**
 * Soft-delete an agent (set status to offline).
 */
export async function deleteAgent(agentId: string): Promise<boolean> {
  const existing = agents.get(agentId);
  if (!existing) return false;

  existing.status = "offline";
  existing.updatedAt = new Date();
  agents.set(agentId, existing);

  // Sync to DB
  if (agentDbEnabled()) {
    const db = await getDb();
    if (db) {
      try {
        await db.updateAgentStatus(agentId, "offline");
      } catch {
        // DB sync failed
      }
    }
  }

  return true;
}

// ---------------------------------------------------------------------------
// Hybrid Seeding
// ---------------------------------------------------------------------------

/**
 * Seed agents from .talos/agents.json. Falls back to hardcoded core agents.
 */
export async function seedAgents(): Promise<number> {
  const configPath = getConfigPath();

  // Try JSON config file first
  if (existsSync(configPath)) {
    try {
      const raw = readFileSync(configPath, "utf-8");
      const configs = JSON.parse(raw) as AgentConfig[];
      let count = 0;
      for (const config of configs) {
        if (!agents.has(config.agentId)) {
          await createAgent(config);
          count++;
        }
      }
      console.log(`[agent-manager] Seeded ${count} agents from ${configPath}`);
      return count;
    } catch (err) {
      console.warn(`[agent-manager] Failed to read ${configPath}: ${(err as Error).message}`);
    }
  }

  // Fall back to hardcoded core agents
  let count = 0;
  for (const core of CORE_AGENTS) {
    if (!agents.has(core.agentId)) {
      const config: AgentConfig = {
        agentId: core.agentId,
        name: core.agentId,
        role: core.role,
        primaryModel: "deepseek-ai/deepseek-v4-pro",
        cloudModel: "deepseek-ai/deepseek-v4-pro",
        maxContextTokens: 100_000,
        capabilities: [],
        tools: [],
        pinned: false,
        version: "1.0.0",
      };
      const state: AgentState = {
        ...config,
        capabilityScore: core.capabilityScore,
        currentLoad: 0,
        status: "idle",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      agents.set(core.agentId, state);
      count++;
    }
  }
  console.log(`[agent-manager] Seeded ${count} agents from hardcoded core list`);
  return count;
}

/**
 * Generate .talos/agents.json from core agent list (if file doesn't exist).
 */
export function generateConfigFile(): string | null {
  const configPath = getConfigPath();
  if (existsSync(configPath)) return null;

  const configs: AgentConfig[] = CORE_AGENTS.map((ca) => ({
    agentId: ca.agentId,
    name: ca.agentId,
    role: ca.role,
    primaryModel: "deepseek-ai/deepseek-v4-pro",
    cloudModel: "deepseek-ai/deepseek-v4-pro",
    maxContextTokens: 100_000,
    capabilities: [],
    tools: [],
    pinned: false,
    version: "1.0.0",
  }));

  return JSON.stringify(configs, null, 2);
}

/**
 * Get all in-memory agent states (for Loom integration).
 */
export function getAllAgents(): AgentState[] {
  return Array.from(agents.values());
}
