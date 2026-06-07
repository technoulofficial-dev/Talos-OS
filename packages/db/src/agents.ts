/**
 * Agent Registry - manages agent records in Supabase.
 * Synchronizes agent state (load, capability score, status) with the database.
 */

import { getSupabaseClient } from "./client.js";

export interface AgentRecord {
  id?: string;
  agentId: string;
  name: string;
  guildId?: string;
  role: string;
  primaryModel: string;
  cloudModel: string;
  localModel?: string;
  maxContextTokens: number;
  capabilities: Array<{ skill: string; proficiency: number }>;
  tools: string[];
  pinned: boolean;
  dockerImage?: string;
  version: string;
  capabilityScore: number;
  currentLoad: number;
  status: "idle" | "bidding" | "executing" | "offline";
}

export interface GuildRecord {
  id?: string;
  name: string;
  displayName: string;
  description?: string;
  sharedTools: string[];
  promptTemplate?: string;
  permissions: string[];
}

/**
 * Register a new agent in the database.
 */
export async function registerAgent(agent: AgentRecord): Promise<AgentRecord> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from("talos_agents")
    .upsert(
      {
        agent_id: agent.agentId,
        name: agent.name,
        guild_id: agent.guildId,
        role: agent.role,
        primary_model: agent.primaryModel,
        cloud_model: agent.cloudModel,
        local_model: agent.localModel,
        max_context_tokens: agent.maxContextTokens,
        capabilities: agent.capabilities,
        tools: agent.tools,
        pinned: agent.pinned,
        docker_image: agent.dockerImage,
        version: agent.version,
        capability_score: agent.capabilityScore,
        current_load: agent.currentLoad,
        status: agent.status,
      },
      { onConflict: "agent_id" }
    )
    .select()
    .single();

  if (error) throw new Error(`Failed to register agent: ${error.message}`);

  return mapAgentFromDb(data);
}

/**
 * Get an agent by its agent_id (e.g., "odin", "mimir").
 */
export async function getAgent(agentId: string): Promise<AgentRecord | null> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from("talos_agents")
    .select("*")
    .eq("agent_id", agentId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to get agent: ${error.message}`);
  }

  return mapAgentFromDb(data);
}

/**
 * List all agents, optionally filtered by status.
 */
export async function listAgents(status?: AgentRecord["status"]): Promise<AgentRecord[]> {
  const client = getSupabaseClient();

  let query = client.from("talos_agents").select("*");
  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list agents: ${error.message}`);

  return (data ?? []).map(mapAgentFromDb);
}

/**
 * Update an agent's capability score (called by The Loom after task completion).
 */
export async function updateAgentScore(agentId: string, score: number): Promise<void> {
  const client = getSupabaseClient();
  const clamped = Math.max(0, Math.min(1, score));

  const { error } = await client
    .from("talos_agents")
    .update({ capability_score: clamped, updated_at: new Date().toISOString() })
    .eq("agent_id", agentId);

  if (error) throw new Error(`Failed to update agent score: ${error.message}`);
}

/**
 * Update an agent's current load (0-1).
 */
export async function updateAgentLoad(agentId: string, load: number): Promise<void> {
  const client = getSupabaseClient();
  const clamped = Math.max(0, Math.min(1, load));

  const { error } = await client
    .from("talos_agents")
    .update({ current_load: clamped, updated_at: new Date().toISOString() })
    .eq("agent_id", agentId);

  if (error) throw new Error(`Failed to update agent load: ${error.message}`);
}

/**
 * Update an agent's status.
 */
export async function updateAgentStatus(
  agentId: string,
  status: AgentRecord["status"]
): Promise<void> {
  const client = getSupabaseClient();

  const { error } = await client
    .from("talos_agents")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("agent_id", agentId);

  if (error) throw new Error(`Failed to update agent status: ${error.message}`);
}

/**
 * Register a guild.
 */
export async function registerGuild(guild: GuildRecord): Promise<GuildRecord> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from("talos_guilds")
    .upsert(
      {
        name: guild.name,
        display_name: guild.displayName,
        description: guild.description,
        shared_tools: guild.sharedTools,
        prompt_template: guild.promptTemplate,
        permissions: guild.permissions,
      },
      { onConflict: "name" }
    )
    .select()
    .single();

  if (error) throw new Error(`Failed to register guild: ${error.message}`);

  return mapGuildFromDb(data);
}

/**
 * Subscribe to agent state changes (real-time).
 */
export function subscribeToAgents(
  onChange: (agent: AgentRecord) => void
): { unsubscribe: () => void } {
  const client = getSupabaseClient();

  const subscription = client
    .channel("talos_agents_changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "talos_agents" },
      (payload: { new: Record<string, unknown> }) => {
        if (payload.new) {
          onChange(mapAgentFromDb(payload.new));
        }
      }
    )
    .subscribe();

  return {
    unsubscribe: () => {
      void client.removeChannel(subscription);
    },
  };
}

// --- Mappers ---

function mapAgentFromDb(row: Record<string, unknown>): AgentRecord {
  return {
    id: row.id as string,
    agentId: row.agent_id as string,
    name: row.name as string,
    guildId: row.guild_id as string | undefined,
    role: row.role as string,
    primaryModel: row.primary_model as string,
    cloudModel: row.cloud_model as string,
    localModel: row.local_model as string | undefined,
    maxContextTokens: row.max_context_tokens as number,
    capabilities: (row.capabilities as Array<{ skill: string; proficiency: number }>) ?? [],
    tools: (row.tools as string[]) ?? [],
    pinned: (row.pinned as boolean) ?? false,
    dockerImage: row.docker_image as string | undefined,
    version: (row.version as string) ?? "1.0.0",
    capabilityScore: (row.capability_score as number) ?? 0.5,
    currentLoad: (row.current_load as number) ?? 0,
    status: (row.status as AgentRecord["status"]) ?? "idle",
  };
}

function mapGuildFromDb(row: Record<string, unknown>): GuildRecord {
  return {
    id: row.id as string,
    name: row.name as string,
    displayName: row.display_name as string,
    description: row.description as string | undefined,
    sharedTools: (row.shared_tools as string[]) ?? [],
    promptTemplate: row.prompt_template as string | undefined,
    permissions: (row.permissions as string[]) ?? [],
  };
}