import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  registerPlugin,
  getPlugin,
  listPlugins,
  updatePluginStatus,
  removePlugin,
  registerMCPEndpoint,
  getMCPEndpoint,
  listMCPEndpoints,
  updateMCPHealth,
  registerExternalAgent,
  getExternalAgent,
  listExternalAgents,
  clearAll,
} from "../plugin/registry.js";
import { pingEndpoint, executeTool, registerEndpoint, unregisterEndpoint } from "../plugin/mcp.js";
import { handleACP, isPathAllowed } from "../plugin/acp.js";
import { installPlugin, uninstallPlugin, activatePlugin, deactivatePlugin, healthCheck, healthCheckAll, registerExternalAgentFromMCP } from "../plugin/lifecycle.js";
import type { PluginManifest, MCPEndpoint, MCPTool, ExternalAgent, ACPRequest } from "../types/plugin.js";

const testTool: MCPTool = { name: "tool1", inputSchema: {} };

const testManifest: PluginManifest = {
  name: "test-plugin",
  version: "1.0.0",
  description: "A test plugin",
  author: "talos",
  capabilities: ["read", "write"],
};

const testManifestWithEndpoints: PluginManifest = {
  ...testManifest,
  name: "mcp-plugin",
  mcpEndpoints: ["http://localhost:9999/mcp"],
  healthEndpoint: "http://localhost:9999/health",
};

describe("Plugin Registry", () => {
  beforeEach(() => clearAll());

  it("registers a new plugin", () => {
    const record = registerPlugin(testManifest);
    expect(record.id).toBeDefined();
    expect(record.name).toBe("test-plugin");
    expect(record.version).toBe("1.0.0");
    expect(record.status).toBe("active");
    expect(record.errorCount).toBe(0);
    expect(record.installedAt).toBeInstanceOf(Date);
  });

  it("updates existing plugin with same name", () => {
    const r1 = registerPlugin(testManifest);
    const updatedManifest = { ...testManifest, version: "2.0.0" };
    const r2 = registerPlugin(updatedManifest);
    expect(r2.id).toBe(r1.id);
    expect(r2.version).toBe("2.0.0");
  });

  it("gets plugin by id", () => {
    const record = registerPlugin(testManifest);
    const found = getPlugin(record.id);
    expect(found).toBeDefined();
    expect(found!.name).toBe("test-plugin");
  });

  it("gets plugin by name", () => {
    registerPlugin(testManifest);
    const found = getPlugin("test-plugin");
    expect(found).toBeDefined();
    expect(found!.version).toBe("1.0.0");
  });

  it("returns undefined for unknown plugin", () => {
    expect(getPlugin("nonexistent")).toBeUndefined();
  });

  it("lists all plugins", () => {
    registerPlugin(testManifest);
    registerPlugin({ ...testManifest, name: "plugin-b" });
    expect(listPlugins()).toHaveLength(2);
  });

  it("filters plugins by status", () => {
    const r1 = registerPlugin(testManifest);
    updatePluginStatus(r1.id, "inactive");
    registerPlugin({ ...testManifest, name: "plugin-b" });
    const inactive = listPlugins("inactive");
    expect(inactive).toHaveLength(1);
    expect(inactive[0]!.name).toBe("test-plugin");
    expect(listPlugins("active")).toHaveLength(1);
  });

  it("updates plugin status and increments error count on failure", () => {
    const record = registerPlugin(testManifest);
    updatePluginStatus(record.id, "inactive");
    expect(getPlugin(record.id)!.status).toBe("inactive");
    expect(getPlugin(record.id)!.errorCount).toBe(1);
    updatePluginStatus(record.id, "failed", "Something broke");
    expect(getPlugin(record.id)!.status).toBe("failed");
    expect(getPlugin(record.id)!.errorCount).toBe(2);
  });

  it("removes a plugin", () => {
    const record = registerPlugin(testManifest);
    expect(removePlugin(record.id)).toBe(true);
    expect(getPlugin(record.id)).toBeUndefined();
  });

  it("returns false removing nonexistent plugin", () => {
    expect(removePlugin("nonexistent")).toBe(false);
  });

  it("registers MCP endpoints", () => {
    const ep: MCPEndpoint = { id: "ep-1", url: "http://example.com/mcp", tools: [], headers: {}, healthy: false };
    registerMCPEndpoint(ep);
    expect(getMCPEndpoint("ep-1")).toEqual(ep);
  });

  it("lists MCP endpoints with health filter", () => {
    registerMCPEndpoint({ id: "ep-1", url: "http://a.com", tools: [], headers: {}, healthy: true });
    registerMCPEndpoint({ id: "ep-2", url: "http://b.com", tools: [], headers: {}, healthy: false });
    expect(listMCPEndpoints(true)).toHaveLength(1);
    expect(listMCPEndpoints()).toHaveLength(2);
  });

  it("updates MCP health", () => {
    registerMCPEndpoint({ id: "ep-1", url: "http://a.com", tools: [], headers: {}, healthy: false });
    updateMCPHealth("ep-1", true);
    expect(getMCPEndpoint("ep-1")!.healthy).toBe(true);
    expect(getMCPEndpoint("ep-1")!.lastChecked).toBeInstanceOf(Date);
  });

  it("registers external agents", () => {
    const agent: ExternalAgent = { id: "ext-1", name: "helper", protocol: "mcp", capabilities: ["search"], status: "active" };
    registerExternalAgent(agent);
    expect(getExternalAgent("ext-1")).toEqual(agent);
  });

  it("lists external agents filtered by protocol", () => {
    registerExternalAgent({ id: "ext-1", name: "mcp-agent", protocol: "mcp", capabilities: [], status: "active" });
    registerExternalAgent({ id: "ext-2", name: "acp-agent", protocol: "acp", capabilities: [], status: "active" });
    expect(listExternalAgents("mcp")).toHaveLength(1);
    expect(listExternalAgents()).toHaveLength(2);
  });

  it("clears all registries", () => {
    registerPlugin(testManifest);
    registerMCPEndpoint({ id: "ep-1", url: "http://a.com", tools: [], headers: {}, healthy: true });
    registerExternalAgent({ id: "ext-1", name: "agent", protocol: "mcp", capabilities: [], status: "active" });
    clearAll();
    expect(listPlugins()).toHaveLength(0);
    expect(listMCPEndpoints()).toHaveLength(0);
    expect(listExternalAgents()).toHaveLength(0);
  });
});

describe("MCP — Network Operations", () => {
  beforeEach(() => { clearAll(); vi.restoreAllMocks(); });

  it("pingEndpoint returns false on network failure", async () => {
    const result = await pingEndpoint({ id: "test", url: "http://localhost:1", tools: [], headers: {}, healthy: false });
    expect(result).toBe(false);
  });

  it("pingEndpoint returns true on success", async () => {
    const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true } as Response);
    const result = await pingEndpoint({ id: "test", url: "http://example.com", tools: [], headers: {}, healthy: false });
    expect(result).toBe(true);
    mockFetch.mockRestore();
  });

  it("executeTool returns error for unknown endpoint", async () => {
    const result = await executeTool({ endpointId: "unknown", tool: "test", args: {} });
    expect(result.success).toBe(false);
    expect(result.error).toContain("unknown");
  });

  it("executeTool returns error for unhealthy endpoint", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Connection refused"));
    registerMCPEndpoint({ id: "ep-1", url: "http://localhost:1", tools: [], headers: {}, healthy: false });
    const result = await executeTool({ endpointId: "ep-1", tool: "test", args: {} });
    expect(result.success).toBe(false);
    expect(result.error).toContain("unhealthy");
  });

  it("executeTool returns data on success", async () => {
    const responseData = { result: "ok" };
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, json: async () => responseData } as Response);
    registerMCPEndpoint({ id: "ep-1", url: "http://example.com/mcp", tools: [], headers: {}, healthy: true });
    const result = await executeTool({ endpointId: "ep-1", tool: "greet", args: { name: "talos" } });
    expect(result.success).toBe(true);
    expect(result.data).toEqual(responseData);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("executeTool handles HTTP error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false, status: 500, text: async () => "Internal error" } as Response);
    registerMCPEndpoint({ id: "ep-1", url: "http://example.com/mcp", tools: [], headers: {}, healthy: true });
    const result = await executeTool({ endpointId: "ep-1", tool: "fail", args: {} });
    expect(result.success).toBe(false);
    expect(result.error).toContain("500");
  });

  it("registerEndpoint creates endpoint and pings it", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true } as Response);
    const ep = await registerEndpoint("http://example.com/mcp", [testTool]);
    expect(ep.id).toContain("mcp-");
    expect(ep.url).toBe("http://example.com/mcp");
    expect(ep.tools).toHaveLength(1);
    expect(ep.healthy).toBe(true);
    expect(getMCPEndpoint(ep.id)).toBeDefined();
  });

  it("unregisterEndpoint removes endpoint", () => {
    registerMCPEndpoint({ id: "mcp-test", url: "http://example.com", tools: [], headers: {}, healthy: true });
    unregisterEndpoint("mcp-test");
    expect(getMCPEndpoint("mcp-test")).toBeUndefined();
  });
});

describe("ACP — Path Traversal Protection", () => {
  it("allows paths within ALLOWED_BASE", () => {
    expect(isPathAllowed(process.cwd())).toBe(true);
    expect(isPathAllowed(process.cwd() + "/some/file.ts")).toBe(true);
  });

  it("rejects paths outside ALLOWED_BASE", () => {
    expect(isPathAllowed("C:\\Windows\\System32")).toBe(false);
    expect(isPathAllowed("/tmp/outside")).toBe(false);
  });

  it("rejects traversal via ..", () => {
    const path = process.cwd() + "/../../etc/passwd";
    expect(isPathAllowed(path)).toBe(false);
  });
});

describe("ACP — File Operations", () => {
  const tmpDir = process.cwd() + "/.talos-test-acp";

  beforeEach(async () => {
    const { mkdir, writeFile } = await import("node:fs/promises");
    await mkdir(tmpDir, { recursive: true });
    await writeFile(tmpDir + "/test.txt", "hello world", "utf-8");
  });

  afterEach(async () => {
    const { rm } = await import("node:fs/promises");
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("reads a file", async () => {
    const req: ACPRequest = { operation: "read", path: ".talos-test-acp/test.txt" };
    const result = await handleACP(req);
    expect(result.success).toBe(true);
    expect((result.data as { content: string }).content).toBe("hello world");
  });

  it("returns error for nonexistent file", async () => {
    const req: ACPRequest = { operation: "read", path: ".talos-test-acp/nonexistent.txt" };
    const result = await handleACP(req);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("writes a file", async () => {
    const req: ACPRequest = { operation: "write", path: ".talos-test-acp/new.txt", content: "new content" };
    const result = await handleACP(req);
    expect(result.success).toBe(true);
    expect((result.data as { bytes: number }).bytes).toBe(11);
  });

  it("rejects write with no content", async () => {
    const req: ACPRequest = { operation: "write", path: ".talos-test-acp/new.txt" };
    const result = await handleACP(req);
    expect(result.success).toBe(false);
    expect(result.error).toContain("content");
  });

  it("lints a file", async () => {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(tmpDir + "/long.txt", "a".repeat(150) + "\n" + "clean line" + "   \n", "utf-8");
    const req: ACPRequest = { operation: "lint", path: ".talos-test-acp/long.txt" };
    const result = await handleACP(req);
    expect(result.success).toBe(true);
    const lintData = result.data as { issues: Array<{ severity: string; message: string }> };
    expect(lintData.issues.some((i) => i.message.includes("120"))).toBe(true);
    expect(lintData.issues.some((i) => i.message.includes("whitespace"))).toBe(true);
  });

  it("searches a directory", async () => {
    const req: ACPRequest = { operation: "search", path: ".talos-test-acp" };
    const result = await handleACP(req);
    expect(result.success).toBe(true);
    const searchData = result.data as { files: unknown[]; total: number };
    expect(searchData.files.length).toBeGreaterThanOrEqual(1);
  });

  it("rejects unknown operation", async () => {
    const req = { operation: "delete" as const, path: ".talos-test-acp/test.txt" } as unknown as ACPRequest;
    const result = await handleACP(req);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Unknown");
  });

  it("rejects path traversal attempts", async () => {
    const req: ACPRequest = { operation: "read", path: "../../etc/passwd" };
    const result = await handleACP(req);
    expect(result.success).toBe(false);
    expect(result.error).toContain("traversal");
  });
});

describe("Plugin Lifecycle", () => {
  beforeEach(() => { clearAll(); vi.restoreAllMocks(); });

  it("installs a plugin without MCP endpoints", async () => {
    const record = await installPlugin(testManifest);
    expect(record.name).toBe("test-plugin");
    expect(record.status).toBe("active");
    expect(getPlugin("test-plugin")).toBeDefined();
  });

  it("installs a plugin with MCP endpoints", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true } as Response);
    const record = await installPlugin(testManifestWithEndpoints);
    expect(record.name).toBe("mcp-plugin");
  });

  it("uninstalls a plugin", async () => {
    await installPlugin(testManifest);
    const removed = await uninstallPlugin("test-plugin");
    expect(removed).toBe(true);
    expect(getPlugin("test-plugin")!.status).toBe("removed");
  });

  it("returns false uninstalling nonexistent plugin", async () => {
    expect(await uninstallPlugin("nonexistent")).toBe(false);
  });

  it("activates a plugin", async () => {
    await installPlugin(testManifest);
    const record = getPlugin("test-plugin")!;
    updatePluginStatus(record.id, "inactive");
    await activatePlugin(record.id);
    expect(getPlugin(record.id)!.status).toBe("active");
  });

  it("deactivates a plugin", async () => {
    await installPlugin(testManifest);
    const record = getPlugin("test-plugin")!;
    await deactivatePlugin(record.id);
    expect(getPlugin(record.id)!.status).toBe("inactive");
  });

  it("healthCheck returns unhealthy for unknown plugin", async () => {
    const result = await healthCheck("nonexistent");
    expect(result.healthy).toBe(false);
    expect(result.error).toContain("not found");
  });

  it("healthCheck returns unhealthy when health endpoint fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Connection refused"));
    await installPlugin(testManifestWithEndpoints);
    const record = getPlugin("mcp-plugin")!;
    const result = await healthCheck(record.id);
    expect(result.healthy).toBe(false);
  });

  it("healthCheck returns healthy when health endpoint succeeds", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true } as Response);
    await installPlugin(testManifestWithEndpoints);
    const record = getPlugin("mcp-plugin")!;
    const result = await healthCheck(record.id);
    expect(result.healthy).toBe(true);
    expect(getPlugin(record.id)!.status).toBe("active");
  });

  it("healthCheck returns healthy for plugin without endpoints", async () => {
    await installPlugin(testManifest);
    const record = getPlugin("test-plugin")!;
    const result = await healthCheck(record.id);
    expect(result.healthy).toBe(true);
  });

  it("healthCheckAll returns results for all non-removed plugins", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true } as Response);
    await installPlugin(testManifest);
    await installPlugin(testManifestWithEndpoints);
    const results = await healthCheckAll();
    expect(results.length).toBeGreaterThanOrEqual(2);
  });

  it("registers external agent from MCP endpoint", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true } as Response);
    const agent = await registerExternalAgentFromMCP("My Helper", "http://helper.example.com/mcp", [testTool], ["file_search"]);
    expect(agent.id).toBe("ext-my-helper");
    expect(agent.name).toBe("My Helper");
    expect(agent.protocol).toBe("mcp");
    expect(agent.status).toBe("active");
    expect(getExternalAgent(agent.id)).toBeDefined();
  });

  it("registers external agent with failed MCP endpoint", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Unreachable"));
    const agent = await registerExternalAgentFromMCP("Offline Agent", "http://localhost:1/mcp", [], []);
    expect(agent.status).toBe("failed");
  });
});
