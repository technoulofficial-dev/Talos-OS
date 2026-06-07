import type { MCPEndpoint, MCPTool } from "../types/plugin.js";
import { registerMCPEndpoint, getMCPEndpoint, updateMCPHealth, removeMCPEndpoint } from "./registry.js";

export interface MCPExecutionRequest {
  endpointId: string;
  tool: string;
  args: Record<string, unknown>;
}

export interface MCPExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  durationMs: number;
}

export async function registerEndpoint(
  url: string,
  tools: MCPTool[],
  headers?: Record<string, string>
): Promise<MCPEndpoint> {
  const id = `mcp-${url.replace(/[^a-zA-Z0-9]/g, "-")}`;
  const endpoint: MCPEndpoint = {
    id,
    url,
    tools,
    headers: headers ?? {},
    healthy: false,
  };

  registerMCPEndpoint(endpoint);

  const healthy = await pingEndpoint(endpoint);
  updateMCPHealth(id, healthy);

  return { ...endpoint, healthy };
}

export async function pingEndpoint(endpoint: MCPEndpoint): Promise<boolean> {
  try {
    const response = await fetch(endpoint.url, {
      method: "GET",
      headers: { ...endpoint.headers, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function executeTool(request: MCPExecutionRequest): Promise<MCPExecutionResult> {
  const start = Date.now();
  const endpoint = getMCPEndpoint(request.endpointId);

  if (!endpoint) {
    return { success: false, error: `MCP endpoint not found: ${request.endpointId}`, durationMs: 0 };
  }

  if (!endpoint.healthy) {
    const alive = await pingEndpoint(endpoint);
    updateMCPHealth(request.endpointId, alive);
    if (!alive) {
      return { success: false, error: `MCP endpoint unhealthy: ${request.endpointId}`, durationMs: Date.now() - start };
    }
  }

  try {
    const response = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        ...endpoint.headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: request.tool,
        args: request.args,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "Unknown error");
      return { success: false, error: `MCP error ${response.status}: ${errText}`, durationMs: Date.now() - start };
    }

    const data = await response.json();
    return { success: true, data, durationMs: Date.now() - start };
  } catch (err) {
    return { success: false, error: (err as Error).message, durationMs: Date.now() - start };
  }
}

export async function checkAllEndpoints(): Promise<Array<{ id: string; healthy: boolean }>> {
  const { listMCPEndpoints } = await import("./registry.js");
  const endpoints = listMCPEndpoints();
  const results: Array<{ id: string; healthy: boolean }> = [];

  for (const ep of endpoints) {
    const healthy = await pingEndpoint(ep);
    updateMCPHealth(ep.id, healthy);
    results.push({ id: ep.id, healthy });
  }

  return results;
}

export { removeMCPEndpoint as unregisterEndpoint };
