import { z } from "zod";
import { GuildIdSchema, AgentIdSchema } from "./agent.js";

export const GuildPermissionSchema = z.enum([
  "read_own_memory",
  "write_own_memory",
  "read_cortex",
  "write_cortex",
  "execute_tasks",
  "create_agents",
  "access_network",
  "modify_config",
  "access_cloud",
  "view_audit",
]);
export type GuildPermission = z.infer<typeof GuildPermissionSchema>;

export const GuildSchema = z.object({
  id: z.string().uuid(),
  name: GuildIdSchema,
  displayName: z.string(),
  description: z.string(),
  sharedTools: z.array(z.string()),
  promptTemplate: z.string().optional(),
  permissions: z.array(GuildPermissionSchema),
  memberAgents: z.array(AgentIdSchema),
  createdAt: z.date(),
});
export type Guild = z.infer<typeof GuildSchema>;

/** Default permissions per guild */
export const GUILD_PERMISSIONS: Record<z.infer<typeof GuildIdSchema>, GuildPermission[]> = {
  crown: [
    "read_own_memory", "execute_tasks", "view_audit",
    "read_cortex", "modify_config",
  ],
  forge: [
    "read_own_memory", "write_own_memory", "execute_tasks",
    "access_network",
  ],
  sanctum: [
    "read_own_memory", "write_own_memory", "execute_tasks",
    "access_network", "access_cloud",
  ],
  vault: [
    "read_own_memory", "write_own_memory", "read_cortex",
    "write_cortex",
  ],
  foundry: [
    "read_own_memory", "write_own_memory", "execute_tasks",
    "create_agents", "access_network", "access_cloud",
  ],
};