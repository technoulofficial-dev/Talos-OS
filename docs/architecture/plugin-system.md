# Plugin System (MCP + ACP)

> **Package:** `@talos/core` — `packages/core/src/plugin/`
> **Types:** `packages/core/src/types/plugin.ts`
> **Tests:** `packages/core/src/__tests__/plugin.test.ts` (410 lines, 30+ test cases)

---

## 1. Purpose

The Plugin System is the extensibility backbone of Talos OS. It provides two distinct protocols for integrating external functionality:

- **MCP (Model Context Protocol)** — Standard tool integration layer for connecting to external MCP servers (Playwright, GitHub, Supabase, etc.). MCP endpoints expose tools that the AI engine or workflow nodes can invoke via HTTP POST.
- **ACP (Agent Communication Protocol)** — File-system scoped inter-agent communication. ACP lets external agents read, write, execute, lint, and search files within the project workspace, with strict path-traversal protection.

Both protocols are managed through a unified plugin lifecycle (install → activate → healthCheck → deactivate → uninstall) backed by in-memory registries and optional database persistence.

### Design Goals

| Goal | Mechanism |
|------|-----------|
| **Zero-config discovery** | Plugins self-register via `installPlugin()` with a manifest |
| **Health monitoring** | `pingEndpoint()` + `healthCheck()` with 5-second timeouts |
| **Security** | ACP path traversal protection via `ALLOWED_BASE = resolve(process.cwd())` |
| **Extensibility** | New node types in the workflow engine can invoke MCP tools via `executeTool()` |
| **Agent federation** | `registerExternalAgentFromMCP()` bridges MCP endpoints into the external agent registry |

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Plugin System                         │
│                                                         │
│  ┌──────────┐   ┌──────────┐   ┌──────────────────┐    │
│  │ Lifecycle │   │  Registry │   │   MCP Layer      │    │
│  │          │   │          │   │                  │    │
│  │ install  │──▶│ plugins  │   │ registerEndpoint │    │
│  │ activate │   │ mcpEp    │   │ executeTool      │    │
│  │ health   │   │ extAgts  │   │ pingEndpoint     │    │
│  │ deactiv  │   │          │   │ checkAll         │    │
│  │ uninstall│   │          │   │                  │    │
│  └──────────┘   └──────────┘   └──────────────────┘    │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │                 ACP Layer                          │   │
│  │  handleACP() → read | write | exec | lint | search│   │
│  │  isPathAllowed() → ALLOWED_BASE guard             │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
   ┌──────────┐        ┌──────────┐        ┌──────────┐
   │ Workflow  │        │ AI Engine│        │ External │
   │  Engine   │        │  Router  │        │  Agents  │
   └──────────┘        └──────────┘        └──────────┘
```

---

## 3. MCP (Model Context Protocol)

MCP is the standard protocol for tool integration in Talos OS. Each MCP endpoint is an HTTP server that exposes a set of tools. The plugin system manages endpoint registration, health checking, and tool execution.

### 3.1 Data Model

```typescript
// packages/core/src/types/plugin.ts

interface MCPEndpoint {
  id: string;                          // Generated: "mcp-<sanitized-url>"
  url: string;                         // e.g., "http://localhost:3000/mcp"
  tools: MCPTool[];                    // Tools exposed by this endpoint
  headers: Record<string, string>;     // Custom HTTP headers (auth tokens, etc.)
  healthy: boolean;                    // Last-known health state
  lastChecked?: Date;                  // Timestamp of last health check
}

interface MCPTool {
  name: string;                        // Tool name (e.g., "browser_navigate")
  description?: string;                // Human-readable description
  inputSchema: Record<string, unknown>; // JSON Schema for tool arguments
}
```

### 3.2 Core Functions

#### `registerEndpoint(url, tools, headers?)`

Registers a new MCP endpoint and immediately pings it for health.

```typescript
// packages/core/src/plugin/mcp.ts:17-37

async function registerEndpoint(
  url: string,
  tools: MCPTool[],
  headers?: Record<string, string>
): Promise<MCPEndpoint> {
  const id = `mcp-${url.replace(/[^a-zA-Z0-9]/g, "-")}`;
  const endpoint: MCPEndpoint = {
    id, url, tools,
    headers: headers ?? {},
    healthy: false,
  };
  registerMCPEndpoint(endpoint);
  const healthy = await pingEndpoint(endpoint);
  updateMCPHealth(id, healthy);
  return { ...endpoint, healthy };
}
```

**ID generation:** The endpoint ID is derived from the URL by replacing non-alphanumeric characters with hyphens. Example: `http://localhost:3000/mcp` → `mcp-http-localhost-3000-mcp`.

**Behavior:**
1. Creates the endpoint record with `healthy: false`
2. Stores it in the in-memory `mcpEndpoints` Map
3. Pings the endpoint with a 5-second timeout
4. Updates the health state based on the ping result
5. Returns the endpoint with the resolved health state

#### `executeTool(request)`

Executes a tool on an MCP endpoint. If the endpoint is unhealthy, it re-pings before failing.

```typescript
// packages/core/src/plugin/mcp.ts:52-92

async function executeTool(request: MCPExecutionRequest): Promise<MCPExecutionResult> {
  const start = Date.now();
  const endpoint = getMCPEndpoint(request.endpointId);

  if (!endpoint) {
    return { success: false, error: `MCP endpoint not found: ${request.endpointId}`, durationMs: 0 };
  }

  if (!endpoint.healthy) {
    const alive = await pingEndpoint(endpoint);
    updateMCPHealth(request.endpointId, alive);
    if (!alive) {
      return { success: false, error: `MCP endpoint unhealthy: ${request.endpointId}`, durationMs: ... };
    }
  }

  const response = await fetch(endpoint.url, {
    method: "POST",
    headers: { ...endpoint.headers, "Content-Type": "application/json" },
    body: JSON.stringify({ tool: request.tool, args: request.args }),
    signal: AbortSignal.timeout(30000),
  });
  // ...
}
```

**Request/Response types:**

```typescript
interface MCPExecutionRequest {
  endpointId: string;           // Target MCP endpoint ID
  tool: string;                 // Tool name to invoke
  args: Record<string, unknown>; // Tool arguments
}

interface MCPExecutionResult {
  success: boolean;
  data?: unknown;               // Tool response payload
  error?: string;               // Error message on failure
  durationMs: number;           // Execution time in milliseconds
}
```

**Execution flow:**
1. Look up the endpoint by ID — return error if not found
2. If endpoint is unhealthy, re-ping with a 5-second timeout
3. If re-ping fails, return error immediately
4. POST to the endpoint URL with `{ tool, args }` body
5. 30-second timeout on the tool execution
6. Parse JSON response on success
7. Return error with HTTP status code on non-2xx response

#### `pingEndpoint(endpoint)`

Health-checks a single MCP endpoint with a GET request and 5-second timeout.

```typescript
// packages/core/src/plugin/mcp.ts:39-50

async function pingEndpoint(endpoint: MCPEndpoint): Promise<boolean> {
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
```

Returns `true` if the server responds with a 2xx status, `false` on any network error or timeout.

#### `checkAllEndpoints()`

Batch health-checks all registered MCP endpoints.

```typescript
// packages/core/src/plugin/mcp.ts:94-106

async function checkAllEndpoints(): Promise<Array<{ id: string; healthy: boolean }>> {
  const endpoints = listMCPEndpoints();
  const results: Array<{ id: string; healthy: boolean }> = [];

  for (const ep of endpoints) {
    const healthy = await pingEndpoint(ep);
    updateMCPHealth(ep.id, healthy);
    results.push({ id: ep.id, healthy });
  }

  return results;
}
```

Iterates all endpoints sequentially (not parallel) to avoid overwhelming the network. Updates each endpoint's health state in the registry.

#### `unregisterEndpoint(id)`

Removes an MCP endpoint from the registry.

```typescript
// packages/core/src/plugin/mcp.ts:108

export { removeMCPEndpoint as unregisterEndpoint };
```

### 3.3 Workflow Engine Integration

MCP tools are invoked from workflow `plugin` nodes:

```typescript
// packages/core/src/workflow/engine.ts:250-260

async function executePluginNode(ctx: NodeExecutionContext): Promise<unknown> {
  const { config } = ctx.workflow.nodes.find((n) => n.id === ctx.nodeRun.nodeId)!;
  if (!config.endpointId || !config.tool) throw new Error("plugin node missing endpointId/tool");
  const result = await executeTool({
    endpointId: config.endpointId,
    tool: config.tool,
    args: config.args,
  });
  if (!result.success) throw new Error(result.error ?? "plugin tool execution failed");
  return result;
}
```

The workflow `plugin` node requires `config.endpointId` and `config.tool` to be set. The `config.args` field passes arguments to the tool.

---

## 4. ACP (Agent Communication Protocol)

ACP provides file-system scoped operations for inter-agent communication. It enforces strict path-traversal protection to prevent agents from accessing files outside the project workspace.

### 4.1 Security Model

```typescript
// packages/core/src/plugin/acp.ts:5-11

const ALLOWED_BASE = resolve(process.cwd());
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function isPathAllowed(target: string): boolean {
  const resolved = resolve(target);
  return resolved.startsWith(ALLOWED_BASE);
}
```

**Key security properties:**
- `ALLOWED_BASE` is resolved from `process.cwd()` at module load time
- All paths are resolved to absolute before comparison
- Paths are rejected if they resolve outside `ALLOWED_BASE`
- Maximum file size for writes: 10MB
- No symbolic link resolution (relies on `path.resolve()`)

**Path traversal protection tests:**

```typescript
// packages/core/src/__tests__/plugin.test.ts:222-237

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
```

**ADR-032:** The path-traversal test uses `C:\Windows\System32` instead of the parent of `process.cwd()`. On Windows, `resolve("D:")` normalizes to `D:\` which may equal `ALLOWED_BASE`, causing false positives.

### 4.2 Supported Operations

#### `read` — Read a file

```typescript
async function handleRead(targetPath: string, request: ACPRequest, start: number): Promise<ACPResponse> {
  await access(targetPath);
  const content = await readFile(targetPath, "utf-8");
  return {
    success: true,
    data: { content, path: relative(ALLOWED_BASE, targetPath) },
    metadata: { operation: "read", path: request.path, size: content.length, durationMs: Date.now() - start },
  };
}
```

Returns the file content as a UTF-8 string with the relative path from the workspace root.

#### `write` — Write a file

```typescript
async function handleWrite(targetPath: string, request: ACPRequest, start: number): Promise<ACPResponse> {
  if (!request.content || request.content.length > MAX_FILE_SIZE) {
    return {
      success: false,
      error: request.content ? "File exceeds maximum size (10MB)" : "No content provided",
      // ...
    };
  }
  await writeFile(targetPath, request.content, "utf-8");
  return {
    success: true,
    data: { path: relative(ALLOWED_BASE, targetPath), bytes: request.content.length },
    // ...
  };
}
```

**Guards:**
- Rejects if `content` is missing
- Rejects if `content.length > 10MB` (10 × 1024 × 1024 bytes)

#### `exec` — Execute a file in sandbox

```typescript
async function handleExec(targetPath: string, _request: ACPRequest, start: number): Promise<ACPResponse> {
  const { executeSandbox } = await import("../sandbox/sandbox.js");
  const content = await readFile(targetPath, "utf-8");
  const ext = targetPath.split(".").pop() ?? "js";
  const languageMap: Record<string, "javascript" | "typescript" | "python" | "bash"> = {
    js: "javascript", ts: "typescript", py: "python", sh: "bash", mjs: "javascript", cjs: "javascript",
  };

  const result = await executeSandbox({
    code: content,
    language: languageMap[ext] ?? "javascript",
    timeoutMs: 30000,
  });

  return {
    success: result.exitCode === 0,
    data: { stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode },
    // ...
  };
}
```

Dynamically imports the sandbox module and executes the file content with a 30-second timeout. Language is inferred from the file extension.

#### `lint` — Lint a file

```typescript
async function handleLint(targetPath: string, _request: ACPRequest, start: number): Promise<ACPResponse> {
  const ext = targetPath.split(".").pop() ?? "js";
  const content = await readFile(targetPath, "utf-8");
  const lines = content.split("\n");
  const issues: Array<{ line: number; column: number; message: string; severity: string }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.length > 120) {
      issues.push({ line: i + 1, column: 121, message: "Line exceeds 120 characters", severity: "warning" });
    }
    if (line.match(/\s+$/)) {
      issues.push({ line: i + 1, column: line.length, message: "Trailing whitespace", severity: "warning" });
    }
  }

  return {
    success: true,
    data: { file: _request.path, issues, totalLines: lines.length, language: ext },
    // ...
  };
}
```

Built-in linter checks:
- Lines exceeding 120 characters (warning)
- Trailing whitespace (warning)

#### `search` — List directory contents

```typescript
async function handleSearch(targetPath: string, request: ACPRequest, start: number): Promise<ACPResponse> {
  const entries = await readdir(targetPath, { withFileTypes: true });
  const files = entries.map((e) => ({
    name: e.name,
    type: e.isDirectory() ? "directory" : "file",
    path: join(relative(ALLOWED_BASE, targetPath), e.name),
  }));

  return {
    success: true,
    data: { files, total: files.length },
    // ...
  };
}
```

Returns a list of files and directories with their relative paths and types.

### 4.3 ACP Request/Response Types

```typescript
// packages/core/src/types/plugin.ts

type ACPOperation = "read" | "write" | "exec" | "lint" | "search";

interface ACPRequest {
  operation: ACPOperation;
  path: string;           // Relative to ALLOWED_BASE
  content?: string;       // Required for write
  language?: string;      // Optional language hint
  pattern?: string;       // Optional search pattern
}

interface ACPResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  metadata: {
    operation: ACPOperation;
    path: string;
    size?: number;
    durationMs: number;
  };
}
```

---

## 5. Plugin Lifecycle

The lifecycle manages the full lifecycle of a plugin from installation to removal.

### 5.1 Lifecycle States

```
  install ──▶ active ──▶ inactive ──▶ active
                  │                        │
                  ▼                        ▼
               failed ───────────────▶ active
                  │
                  ▼
               removed
```

| Status | Description |
|--------|-------------|
| `active` | Plugin is running and healthy |
| `inactive` | Plugin is registered but deactivated |
| `failed` | Health check failed or error occurred |
| `removed` | Plugin has been uninstalled (soft-delete) |
| `discovered` | Plugin discovered but not yet registered |
| `registering` | Plugin is in the process of being registered |

### 5.2 Lifecycle Functions

#### `installPlugin(manifest)`

```typescript
// packages/core/src/plugin/lifecycle.ts:10-20

async function installPlugin(manifest: PluginManifest): Promise<PluginRecord> {
  const record = registerPlugin(manifest);

  if (manifest.mcpEndpoints && manifest.mcpEndpoints.length > 0) {
    for (const url of manifest.mcpEndpoints) {
      await registerEndpoint(url, []);
    }
  }

  return record;
}
```

1. Registers the plugin in the in-memory registry
2. If the manifest declares MCP endpoints, registers and pings each one
3. Returns the created `PluginRecord`

#### `uninstallPlugin(idOrName)`

```typescript
async function uninstallPlugin(idOrName: string): Promise<boolean> {
  const plugin = getPlugin(idOrName);
  if (!plugin) return false;
  updatePluginStatus(plugin.id, "removed");
  return true;
}
```

Soft-deletes by setting status to `"removed"`. Does not remove from the in-memory Map (for audit trail).

#### `activatePlugin(id)` / `deactivatePlugin(id)`

```typescript
async function activatePlugin(id: string): Promise<void> {
  updatePluginStatus(id, "active");
}

async function deactivatePlugin(id: string): Promise<void> {
  updatePluginStatus(id, "inactive");
}
```

Simple status transitions. The `errorCount` is incremented on `inactive` and `failed` transitions.

#### `healthCheck(id)`

```typescript
// packages/core/src/plugin/lifecycle.ts:37-72

async function healthCheck(id: string): Promise<{ healthy: boolean; error?: string }> {
  const plugin = getPlugin(id);
  if (!plugin) return { healthy: false, error: "Plugin not found" };

  // 1. Check health endpoint (if configured)
  if (plugin.manifest.healthEndpoint) {
    const response = await fetch(plugin.manifest.healthEndpoint, {
      signal: AbortSignal.timeout(5000),
    });
    const healthy = response.ok;
    updatePluginStatus(id, healthy ? "active" : "failed");
    return { healthy };
  }

  // 2. Ping MCP endpoints (if configured)
  if (plugin.manifest.mcpEndpoints && plugin.manifest.mcpEndpoints.length > 0) {
    for (const url of plugin.manifest.mcpEndpoints) {
      const alive = await pingEndpoint({ id: "", url, tools: [], headers: {}, healthy: false });
      if (!alive) {
        updatePluginStatus(id, "failed", `MCP endpoint unreachable: ${url}`);
        return { healthy: false, error: `MCP endpoint unreachable: ${url}` };
      }
    }
  }

  // 3. No health check configured — assume healthy
  updatePluginStatus(id, "active");
  return { healthy: true };
}
```

**Health check priority:**
1. Custom `healthEndpoint` (HTTP GET, 5s timeout)
2. MCP endpoint pings (sequential)
3. No configured checks → assume healthy

#### `healthCheckAll()`

```typescript
async function healthCheckAll(): Promise<Array<{ id: string; name: string; healthy: boolean }>> {
  const all = listPlugins();
  const results: Array<{ id: string; name: string; healthy: boolean }> = [];

  for (const plugin of all) {
    if (plugin.status === "removed") continue;
    const { healthy } = await healthCheck(plugin.id);
    results.push({ id: plugin.id, name: plugin.name, healthy });
  }

  return results;
}
```

Iterates all non-removed plugins and runs individual health checks.

#### `registerExternalAgentFromMCP(name, mcpUrl, tools, capabilities)`

```typescript
// packages/core/src/plugin/lifecycle.ts:87-109

async function registerExternalAgentFromMCP(
  name: string, mcpUrl: string, tools: MCPTool[], capabilities: string[]
): Promise<ExternalAgent> {
  const id = `ext-${name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
  const endpoint = await registerEndpoint(mcpUrl, tools);

  const agent: ExternalAgent = {
    id, name, protocol: "mcp",
    mcpEndpoint: { ...endpoint, tools },
    capabilities,
    status: endpoint.healthy ? "active" : "failed",
    lastSeen: new Date(),
  };

  registerExternalAgent(agent);
  return agent;
}
```

Bridges an MCP endpoint into the external agent registry. The agent ID is derived from the name (lowercased, non-alphanumeric → hyphens).

---

## 6. Plugin Manifest

The plugin manifest defines the metadata and capabilities of a plugin.

```typescript
// packages/core/src/types/plugin.ts:6-18

const PluginManifestSchema = z.object({
  name: z.string().min(1),                    // Plugin name (unique identifier)
  version: z.string().min(1),                 // Semver version
  description: z.string().optional(),         // Human-readable description
  author: z.string().optional(),              // Author name
  homepage: z.string().optional(),            // URL to documentation
  capabilities: z.array(z.string()).default([]), // Declared capabilities
  mcpEndpoints: z.array(z.string()).optional(), // MCP server URLs
  healthEndpoint: z.string().optional(),      // Custom health check URL
  configSchema: z.record(z.unknown()).optional(), // Plugin-specific config schema
  dockerImage: z.string().optional(),         // Docker image for containerized plugins
});
```

**Example manifest:**

```typescript
const manifest: PluginManifest = {
  name: "playwright-browser",
  version: "1.2.0",
  description: "Browser automation via Playwright",
  author: "talos",
  capabilities: ["browser_navigate", "browser_click", "browser_screenshot"],
  mcpEndpoints: ["http://localhost:3001/mcp"],
  healthEndpoint: "http://localhost:3001/health",
};
```

---

## 7. Plugin Record

The plugin record tracks the runtime state of an installed plugin.

```typescript
// packages/core/src/types/plugin.ts:20-31

const PluginRecordSchema = z.object({
  id: z.string(),                    // UUID generated on install
  name: z.string(),                  // From manifest
  version: z.string(),               // From manifest
  manifest: PluginManifestSchema,    // Full manifest snapshot
  status: PluginStatusSchema,        // Current lifecycle status
  errorCount: z.number().int().default(0), // Incremented on failure/inactive
  lastHeartbeat: z.date().optional(), // Last successful health check
  installedAt: z.date(),             // When the plugin was installed
  updatedAt: z.date(),               // Last status change
});
```

**Error counting:** The `errorCount` field is incremented every time the plugin transitions to `"inactive"` or `"failed"` status. This is used for monitoring and alerting.

---

## 8. Registry

The registry is the in-memory data store for all plugin system entities.

### 8.1 Store Structure

```typescript
// packages/core/src/plugin/registry.ts:4-6

const plugins = new Map<string, PluginRecord>();
const mcpEndpoints = new Map<string, MCPEndpoint>();
const externalAgents = new Map<string, ExternalAgent>();
```

Three separate `Map` instances:

| Store | Key | Value | Purpose |
|-------|-----|-------|---------|
| `plugins` | UUID | `PluginRecord` | Installed plugins |
| `mcpEndpoints` | sanitized URL ID | `MCPEndpoint` | Registered MCP endpoints |
| `externalAgents` | `ext-<name>` | `ExternalAgent` | External agent registrations |

### 8.2 Registry Functions

| Function | Description |
|----------|-------------|
| `registerPlugin(manifest)` | Register or update a plugin. If a plugin with the same name exists, updates its version and manifest. |
| `getPlugin(idOrName)` | Look up by UUID or name. Falls back to name search if UUID lookup fails. |
| `listPlugins(status?)` | List all plugins, optionally filtered by status. |
| `updatePluginStatus(id, status, error?)` | Update status and increment errorCount on failure/inactive. |
| `removePlugin(id)` | Delete a plugin from the Map. |
| `registerMCPEndpoint(endpoint)` | Store an MCP endpoint. |
| `getMCPEndpoint(id)` | Look up an endpoint by ID. |
| `listMCPEndpoints(healthyOnly?)` | List endpoints, optionally filtered by health. |
| `updateMCPHealth(id, healthy)` | Update endpoint health state and `lastChecked` timestamp. |
| `removeMCPEndpoint(id)` | Delete an endpoint. |
| `registerExternalAgent(agent)` | Store an external agent. |
| `getExternalAgent(id)` | Look up by ID. |
| `listExternalAgents(protocol?)` | List agents, optionally filtered by protocol (`mcp`, `acp`, `both`). |
| `removeExternalAgent(id)` | Delete an agent. |
| `clearAll()` | Clear all three stores (used in tests). |

### 8.3 Plugin Name Deduplication

```typescript
// packages/core/src/plugin/registry.ts:8-17

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
  // ... create new
}
```

If a plugin with the same name already exists, `registerPlugin()` updates it in-place rather than creating a duplicate. The UUID remains the same.

---

## 9. External Agent Model

External agents represent remote agents connected via MCP or ACP protocols.

```typescript
// packages/core/src/types/plugin.ts:75-84

const ExternalAgentSchema = z.object({
  id: z.string(),                          // "ext-<name>"
  name: z.string(),                        // Human-readable name
  protocol: z.enum(["mcp", "acp", "both"]), // Communication protocol
  mcpEndpoint: MCPEndpointSchema.optional(), // MCP endpoint (if protocol is "mcp")
  capabilities: z.array(z.string()).default([]), // Declared capabilities
  status: PluginStatusSchema,              // Current status
  lastSeen: z.date().optional(),           // Last communication timestamp
});
```

**Protocol values:**
- `"mcp"` — Agent communicates via MCP tools
- `"acp"` — Agent communicates via ACP file operations
- `"both"` — Agent supports both protocols

---

## 10. API Endpoints

The plugin system exposes the following REST API endpoints (served by the Talos Core server):

### Plugin Management

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/plugins` | List all plugins (optional `?status=` filter) |
| `GET` | `/v1/plugins/health` | Run health checks on all plugins |
| `POST` | `/v1/plugins` | Install a plugin from manifest |
| `DELETE` | `/v1/plugins/:id` | Uninstall a plugin |

### MCP Operations

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/mcp/execute` | Execute a tool on an MCP endpoint |
| `POST` | `/v1/mcp/register` | Register a new MCP endpoint |
| `GET` | `/v1/mcp/endpoints` | List all MCP endpoints |
| `POST` | `/v1/mcp/check` | Batch health check all MCP endpoints |

### ACP Operations

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/acp` | Execute an ACP operation (read/write/exec/lint/search) |

### Request Examples

**Install plugin:**

```json
POST /v1/plugins
{
  "name": "playwright-browser",
  "version": "1.2.0",
  "description": "Browser automation",
  "capabilities": ["browser_navigate", "browser_click"],
  "mcpEndpoints": ["http://localhost:3001/mcp"]
}
```

**Execute MCP tool:**

```json
POST /v1/mcp/execute
{
  "endpointId": "mcp-http-localhost-3001-mcp",
  "tool": "browser_navigate",
  "args": { "url": "https://example.com" }
}
```

**Execute ACP operation:**

```json
POST /v1/acp
{
  "operation": "read",
  "path": "packages/core/src/index.ts"
}
```

---

## 11. Database Tables

### `talos_plugins`

Stores installed plugin records for persistence across server restarts.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | Primary key |
| `name` | `text` | Plugin name (unique) |
| `version` | `text` | Semver version |
| `manifest` | `jsonb` | Full manifest JSON |
| `status` | `text` | Current status |
| `error_count` | `integer` | Number of failures |
| `installed_at` | `timestamptz` | Installation timestamp |
| `updated_at` | `timestamptz` | Last update timestamp |

### `talos_store`

Marketplace registry for discoverable plugins.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | Primary key |
| `name` | `text` | Plugin name |
| `version` | `text` | Latest version |
| `description` | `text` | Short description |
| `author` | `text` | Author name |
| `capabilities` | `jsonb` | Array of capability strings |
| `mcp_endpoints` | `jsonb` | Array of MCP endpoint URLs |
| `docker_image` | `text` | Docker image reference |
| `published_at` | `timestamptz` | Publication timestamp |

---

## 12. Configuration

### Plugin Manifest Configuration

Plugins can declare a custom `configSchema` in their manifest for plugin-specific configuration:

```typescript
const manifest: PluginManifest = {
  name: "my-plugin",
  version: "1.0.0",
  configSchema: {
    apiKey: { type: "string", description: "API key for the external service" },
    baseUrl: { type: "string", default: "https://api.example.com" },
    timeout: { type: "number", default: 30000 },
  },
};
```

### Model Selection

Plugins can influence AI model selection through the workflow engine. A workflow `agent` node with `config.agentId` routes through the AI engine's model selection logic (see `packages/core/src/ai-engine/router.ts`).

### Context Tokens

MCP tool execution includes a `durationMs` field in the result for monitoring and budget tracking. The AI engine's `BudgetGate` can use this data to enforce token/time limits.

---

## 13. Security Considerations

### Path Traversal Protection

ACP enforces a strict allowlist based on the working directory:

```
ALLOWED_BASE = resolve(process.cwd())
```

**Rejected paths:**
- `../../etc/passwd` — parent directory traversal
- `/tmp/outside` — absolute path outside workspace
- `C:\Windows\System32` — different drive/directory

**Allowed paths:**
- `packages/core/src/index.ts` — relative path within workspace
- `./src/utils.ts` — explicit relative path

### MCP Endpoint Security

- All MCP requests include custom headers (for auth tokens)
- Endpoints are health-checked before tool execution
- 30-second timeout on tool execution prevents hanging
- 5-second timeout on health checks prevents slow liveness probes

### File Size Limits

ACP `write` operations are limited to 10MB to prevent disk exhaustion attacks.

---

## 14. Testing

The plugin system has comprehensive test coverage in `packages/core/src/__tests__/plugin.test.ts` (410 lines).

### Test Suites

| Suite | Tests | Description |
|-------|-------|-------------|
| Plugin Registry | 15 | Registration, lookup, status updates, error counting, removal |
| MCP — Network Operations | 8 | Ping, execute, health, endpoint registration, error handling |
| ACP — Path Traversal Protection | 3 | Allow/reject paths, traversal via `..` |
| ACP — File Operations | 7 | Read, write, lint, search, unknown operation, traversal rejection |
| Plugin Lifecycle | 12 | Install, uninstall, activate, deactivate, health checks, external agents |

### Key Test Patterns

**Mocking network calls:**

```typescript
beforeEach(() => { clearAll(); vi.restoreAllMocks(); });

it("pingEndpoint returns true on success", async () => {
  const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true } as Response);
  const result = await pingEndpoint({ id: "test", url: "http://example.com", tools: [], headers: {}, healthy: false });
  expect(result).toBe(true);
  mockFetch.mockRestore();
});
```

**Testing ACP with temp directories:**

```typescript
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
```

### Running Tests

```bash
pnpm --filter @talos/core test
```

---

## 15. File Index

| File | Lines | Purpose |
|------|-------|---------|
| `packages/core/src/plugin/index.ts` | 6 | Barrel exports |
| `packages/core/src/plugin/lifecycle.ts` | 111 | Lifecycle management (install, health check, etc.) |
| `packages/core/src/plugin/mcp.ts` | 108 | MCP endpoint registration, tool execution, health |
| `packages/core/src/plugin/acp.ts` | 138 | ACP file operations with path traversal protection |
| `packages/core/src/plugin/registry.ts` | 106 | In-memory stores for plugins, endpoints, agents |
| `packages/core/src/types/plugin.ts` | 84 | Zod schemas and TypeScript types |
| `packages/core/src/__tests__/plugin.test.ts` | 410 | Comprehensive test suite |

---

## 16. Architecture Decision Records

| ADR | Decision | Rationale |
|-----|----------|-----------|
| ADR-011 | `__setStoreDir` test hook in `_test_hooks.ts`, not re-exported from barrel | Underscore prefix is convention; barrel exposure is the real attack surface |
| ADR-032 | Path-traversal test uses `C:\Windows\System32` | On Windows, `resolve("D:")` normalizes to `D:\` which may equal `ALLOWED_BASE` |
| — | MCP health checks are sequential, not parallel | Avoids overwhelming the network with simultaneous requests |
| — | Plugin name deduplication on registration | Prevents duplicate plugins; updates in-place with new version |
| — | ACP `write` limited to 10MB | Prevents disk exhaustion attacks from malicious agents |
