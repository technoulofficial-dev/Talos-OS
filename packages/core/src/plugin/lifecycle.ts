import { registerPlugin, getPlugin, updatePluginStatus, listPlugins, registerExternalAgent } from "./registry.js";
import { registerEndpoint, pingEndpoint, checkAllEndpoints } from "./mcp.js";
import type { PluginManifest, PluginRecord, ExternalAgent, MCPTool } from "../types/plugin.js";

export interface DiscoveryResult {
  manifest: PluginManifest;
  source: string;
}

export async function installPlugin(manifest: PluginManifest): Promise<PluginRecord> {
  const record = registerPlugin(manifest);

  if (manifest.mcpEndpoints && manifest.mcpEndpoints.length > 0) {
    for (const url of manifest.mcpEndpoints) {
      await registerEndpoint(url, []);
    }
  }

  return record;
}

export async function uninstallPlugin(idOrName: string): Promise<boolean> {
  const plugin = getPlugin(idOrName);
  if (!plugin) return false;
  updatePluginStatus(plugin.id, "removed");
  return true;
}

export async function activatePlugin(id: string): Promise<void> {
  updatePluginStatus(id, "active");
}

export async function deactivatePlugin(id: string): Promise<void> {
  updatePluginStatus(id, "inactive");
}

export async function healthCheck(id: string): Promise<{ healthy: boolean; error?: string }> {
  const plugin = getPlugin(id);
  if (!plugin) return { healthy: false, error: "Plugin not found" };

  if (plugin.manifest.healthEndpoint) {
    try {
      const response = await fetch(plugin.manifest.healthEndpoint, {
        signal: AbortSignal.timeout(5000),
      });
      const healthy = response.ok;
      updatePluginStatus(id, healthy ? "active" : "failed");
      return { healthy };
    } catch (err) {
      updatePluginStatus(id, "failed", (err as Error).message);
      return { healthy: false, error: (err as Error).message };
    }
  }

  if (plugin.manifest.mcpEndpoints && plugin.manifest.mcpEndpoints.length > 0) {
    for (const url of plugin.manifest.mcpEndpoints) {
      try {
        const alive = await pingEndpoint({ id: "", url, tools: [], headers: {}, healthy: false });
        if (!alive) {
          updatePluginStatus(id, "failed", `MCP endpoint unreachable: ${url}`);
          return { healthy: false, error: `MCP endpoint unreachable: ${url}` };
        }
      } catch (err) {
        updatePluginStatus(id, "failed", (err as Error).message);
        return { healthy: false, error: (err as Error).message };
      }
    }
  }

  updatePluginStatus(id, "active");
  return { healthy: true };
}

export async function healthCheckAll(): Promise<Array<{ id: string; name: string; healthy: boolean }>> {
  const all = listPlugins();
  const results: Array<{ id: string; name: string; healthy: boolean }> = [];

  for (const plugin of all) {
    if (plugin.status === "removed") continue;
    const { healthy } = await healthCheck(plugin.id);
    results.push({ id: plugin.id, name: plugin.name, healthy });
  }

  return results;
}

export async function registerExternalAgentFromMCP(
  name: string,
  mcpUrl: string,
  tools: MCPTool[],
  capabilities: string[]
): Promise<ExternalAgent> {
  const id = `ext-${name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;

  const endpoint = await registerEndpoint(mcpUrl, tools);

  const agent: ExternalAgent = {
    id,
    name,
    protocol: "mcp",
    mcpEndpoint: { ...endpoint, tools },
    capabilities,
    status: endpoint.healthy ? "active" : "failed",
    lastSeen: new Date(),
  };

  registerExternalAgent(agent);
  return agent;
}

export { checkAllEndpoints };
