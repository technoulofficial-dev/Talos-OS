/**
 * Guild Permission Middleware
 * Enforces GUILD_PERMISSIONS from types/guild.ts on API endpoints.
 * Checks that the requesting agent's guild has the required permission.
 *
 * Uses the GUILD_PERMISSIONS static map (types/guild.ts:32) for permission lookup.
 * Agent-to-guild mapping is resolved from the agent's config or the x-agent-id header.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { GUILD_PERMISSIONS, type GuildPermission } from "../types/guild.js";
import type { GuildId } from "../types/agent.js";
import { getAgent } from "@talos/db/agents";

export interface PermissionContext {
  agentId: string;
  guildId: GuildId;
  permissions: GuildPermission[];
}

/**
 * Resolve an agent's guild ID and permissions.
 * Falls back to "crown" guild if agent not found.
 */
export async function resolveAgentPermissions(agentId: string): Promise<PermissionContext> {
  try {
    const agent = await getAgent(agentId);
    if (agent?.guildId) {
      const guildId = agent.guildId as GuildId;
      return {
        agentId,
        guildId,
        permissions: GUILD_PERMISSIONS[guildId] ?? GUILD_PERMISSIONS["crown"]!,
      };
    }
  } catch {
    // Agent not in DB; fall through to default
  }

  // Default: crown guild permissions
  return {
    agentId,
    guildId: "crown",
    permissions: GUILD_PERMISSIONS["crown"]!,
  };
}

/**
 * Check if an agent has a specific permission.
 */
export async function checkGuildPermission(
  agentId: string,
  permission: GuildPermission
): Promise<boolean> {
  const ctx = await resolveAgentPermissions(agentId);
  return ctx.permissions.includes(permission);
}

/**
 * Express-style middleware factory that enforces a permission requirement.
 * Returns 403 if the agent lacks the permission.
 *
 * Usage in server.ts:
 *   const deny = requirePermission("execute_tasks");
 *   if (deny) return deny(res);
 */
export async function requirePermission(
  agentId: string,
  permission: GuildPermission
): Promise<{ denied: boolean; status?: number; body?: string }> {
  const hasPermission = await checkGuildPermission(agentId, permission);
  if (hasPermission) {
    return { denied: false };
  }

  return {
    denied: true,
    status: 403,
    body: JSON.stringify({
      success: false,
      error: `Agent "${agentId}" lacks permission "${permission}"`,
      timestamp: new Date().toISOString(),
    }),
  };
}

/**
 * Extract agent ID from request headers or query params.
 * Priority: x-agent-id header > agentId query param > "system" fallback
 */
export function extractAgentId(req: IncomingMessage, url: URL): string {
  const headerAgent = req.headers["x-agent-id"];
  if (typeof headerAgent === "string" && headerAgent) return headerAgent;

  const queryAgent = url.searchParams.get("agentId");
  if (queryAgent) return queryAgent;

  return "system";
}
