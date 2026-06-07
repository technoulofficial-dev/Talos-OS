import { z } from "zod";

export const PluginStatusSchema = z.enum(["discovered", "registering", "active", "inactive", "failed", "removed"]);
export type PluginStatus = z.infer<typeof PluginStatusSchema>;

export const PluginManifestSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  description: z.string().optional(),
  author: z.string().optional(),
  homepage: z.string().optional(),
  capabilities: z.array(z.string()).default([]),
  mcpEndpoints: z.array(z.string()).optional(),
  healthEndpoint: z.string().optional(),
  configSchema: z.record(z.unknown()).optional(),
  dockerImage: z.string().optional(),
});
export type PluginManifest = z.infer<typeof PluginManifestSchema>;

export const PluginRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  manifest: PluginManifestSchema,
  status: PluginStatusSchema,
  errorCount: z.number().int().default(0),
  lastHeartbeat: z.date().optional(),
  installedAt: z.date(),
  updatedAt: z.date(),
});
export type PluginRecord = z.infer<typeof PluginRecordSchema>;

export const MCPToolSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  inputSchema: z.record(z.unknown()).default({}),
});
export type MCPTool = z.infer<typeof MCPToolSchema>;

export const MCPEndpointSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  tools: z.array(MCPToolSchema).default([]),
  headers: z.record(z.string()).default({}),
  healthy: z.boolean().default(false),
  lastChecked: z.date().optional(),
});
export type MCPEndpoint = z.infer<typeof MCPEndpointSchema>;

export const ACPOperationSchema = z.enum(["read", "write", "exec", "lint", "search"]);
export type ACPOperation = z.infer<typeof ACPOperationSchema>;

export const ACPRequestSchema = z.object({
  operation: ACPOperationSchema,
  path: z.string(),
  content: z.string().optional(),
  language: z.string().optional(),
  pattern: z.string().optional(),
});
export type ACPRequest = z.infer<typeof ACPRequestSchema>;

export const ACPResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  metadata: z.object({
    operation: ACPOperationSchema,
    path: z.string(),
    size: z.number().int().optional(),
    durationMs: z.number().int(),
  }),
});
export type ACPResponse = z.infer<typeof ACPResponseSchema>;

export const ExternalAgentSchema = z.object({
  id: z.string(),
  name: z.string(),
  protocol: z.enum(["mcp", "acp", "both"]),
  mcpEndpoint: MCPEndpointSchema.optional(),
  capabilities: z.array(z.string()).default([]),
  status: PluginStatusSchema,
  lastSeen: z.date().optional(),
});
export type ExternalAgent = z.infer<typeof ExternalAgentSchema>;
