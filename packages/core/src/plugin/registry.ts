import type { PluginManifest, PluginRecord, PluginStatus, MCPEndpoint, ExternalAgent } from "../types/plugin.js";
import { randomUUID } from "crypto";

const plugins = new Map<string, PluginRecord>();
const mcpEndpoints = new Map<string, MCPEndpoint>();
const externalAgents = new Map<string, ExternalAgent>();

export function registerPlugin(manifest: PluginManifest): PluginRecord {
  const existing = Array.from(plugins.values()).find((p) => p.name === manifest.name);
  if (existing) {
    existing.version = manifest.version;
    existing.manifest = manifest;
    existing.status = "active";
    existing.updatedAt = new Date();
    plugins.set(existing.id, existing);
    return existing;
  }

  const record: PluginRecord = {
    id: randomUUID(),
    name: manifest.name,
    version: manifest.version,
    manifest,
    status: "active",
    errorCount: 0,
    installedAt: new Date(),
    updatedAt: new Date(),
  };
  plugins.set(record.id, record);
  return record;
}

export function getPlugin(idOrName: string): PluginRecord | undefined {
  return plugins.get(idOrName) ?? Array.from(plugins.values()).find((p) => p.name === idOrName);
}

export function listPlugins(status?: PluginStatus): PluginRecord[] {
  const all = Array.from(plugins.values());
  return status ? all.filter((p) => p.status === status) : all;
}

export function updatePluginStatus(id: string, status: PluginStatus, error?: string): void {
  const plugin = plugins.get(id);
  if (plugin) {
    plugin.status = status;
    plugin.updatedAt = new Date();
    if (status === "failed" || status === "inactive") {
      plugin.errorCount++;
    }
    if (error) {
      console.error(`[plugin] ${plugin.name} → ${status}: ${error}`);
    }
  }
}

export function removePlugin(id: string): boolean {
  return plugins.delete(id);
}

export function registerMCPEndpoint(endpoint: MCPEndpoint): void {
  mcpEndpoints.set(endpoint.id, endpoint);
}

export function getMCPEndpoint(id: string): MCPEndpoint | undefined {
  return mcpEndpoints.get(id);
}

export function listMCPEndpoints(healthyOnly?: boolean): MCPEndpoint[] {
  const all = Array.from(mcpEndpoints.values());
  return healthyOnly ? all.filter((e) => e.healthy) : all;
}

export function updateMCPHealth(id: string, healthy: boolean): void {
  const ep = mcpEndpoints.get(id);
  if (ep) {
    ep.healthy = healthy;
    ep.lastChecked = new Date();
  }
}

export function removeMCPEndpoint(id: string): boolean {
  return mcpEndpoints.delete(id);
}

export function registerExternalAgent(agent: ExternalAgent): void {
  externalAgents.set(agent.id, agent);
}

export function getExternalAgent(id: string): ExternalAgent | undefined {
  return externalAgents.get(id);
}

export function listExternalAgents(protocol?: "mcp" | "acp" | "both"): ExternalAgent[] {
  const all = Array.from(externalAgents.values());
  return protocol ? all.filter((a) => a.protocol === protocol) : all;
}

export function removeExternalAgent(id: string): boolean {
  return externalAgents.delete(id);
}

export function clearAll(): void {
  plugins.clear();
  mcpEndpoints.clear();
  externalAgents.clear();
}
