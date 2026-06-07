# Talos OS — REST API Reference

> **Version:** 8.0 · **Port:** 8642 · **Server:** Node.js `http.createServer` · **Format:** JSON

---

## 1. Purpose

The Talos OS HTTP API is the central nervous system of the platform. It exposes all core capabilities — AI routing, agent execution, task management, the Council deliberation system, plugin lifecycle, MCP tool execution, ACP operations, the Graphify knowledge graph, and the Workflow engine — over a single REST interface on port 8642.

Every agent, the Mission Control UI, and external tools connect through this API. It is designed for **local-first operation** with no authentication by default (see §6 for future JWT plans).

---

## 2. Server Setup

The server is built on Node.js's native `http.createServer` — no Express, no Koa, no framework dependencies.

### Startup

```typescript
// packages/core/src/api/server.ts
import { createServer } from "node:http";

const PORT = Number(process.env["TALOS_PORT"] ?? 8642);
const HOST = process.env["TALOS_HOST"] ?? "0.0.0.0";

const server = createServer(async (req, res) => {
  // Routing logic
});

server.listen(PORT, HOST, () => {
  console.log(`[talos-api] Listening on http://${HOST}:${PORT}`);
});
```

### Auto-Start

The server auto-starts when run directly:

```typescript
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}
```

### Exports

```typescript
export function startServer(): void;
export function stopServer(): Promise<void>;
```

---

## 3. Response Format

Every response follows a consistent envelope:

```typescript
interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;  // ISO 8601
}
```

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2026-06-06T12:00:00.000Z"
}
```

### Error Response

```json
{
  "success": false,
  "error": "Proposal must include title and description",
  "timestamp": "2026-06-06T12:00:00.000Z"
}
```

### Status Codes

| Code | Meaning |
|------|---------|
| `200` | Success |
| `201` | Created (resource installed/registered) |
| `202` | Accepted (async operation started) |
| `400` | Bad request (validation error) |
| `404` | Not found |
| `500` | Internal server error |
| `502` | Bad gateway (upstream MCP tool failed) |

---

## 4. Endpoints

### 4.1 Health

#### `GET /health`

System health check. Returns uptime and operational status.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "operational",
    "uptime": 3600.5
  },
  "timestamp": "2026-06-06T12:00:00.000Z"
}
```

**curl:**
```bash
curl http://localhost:8642/health
```

---

#### `GET /health/providers`

Check health of all configured AI providers (Ollama, G0DM0D3 LAN peers, OpenRouter).

**Response:**
```json
{
  "success": true,
  "data": {
    "ollama": { "status": "healthy", "models": ["llama3.1:8b"] },
    "g0dm0d3": { "status": "healthy", "peers": 2 },
    "openrouter": { "status": "healthy" }
  },
  "timestamp": "2026-06-06T12:00:00.000Z"
}
```

**curl:**
```bash
curl http://localhost:8642/health/providers
```

---

### 4.2 AI Route

#### `POST /v1/route`

Route an AI request through the multi-tier provider waterfall: local Ollama → G0DM0D3 LAN peers → Owl Alpha → G0DM0D3 cloud.

**Request Body:**
```typescript
{
  prompt: string;              // Required: the user prompt
  systemPrompt?: string;       // Optional: system prompt
  messages?: Array<{           // Optional: conversation history
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  model?: string;              // Optional: specific model ID
  maxTokens?: number;          // Optional: max output tokens (default: 4096)
  temperature?: number;        // Optional: sampling temperature (0-2)
  agentId: string;             // Required: requesting agent
  preferLocal?: boolean;       // Optional: prefer local inference
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "content": "The capital of France is Paris.",
    "model": "ollama/llama3.1:8b",
    "provider": "ollama",
    "tokensUsed": 42,
    "costUsd": 0,
    "durationMs": 1250
  },
  "timestamp": "2026-06-06T12:00:00.000Z"
}
```

**curl:**
```bash
curl -X POST http://localhost:8642/v1/route \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "What is the capital of France?",
    "agentId": "odin",
    "maxTokens": 100
  }'
```

---

### 4.3 Agents

#### `POST /v1/agents/:id`

Execute an agent with a prompt. Routes through the AI engine with the agent's model configuration.

**Request Body:** Same as `POST /v1/route`.

**Response:** Same as `POST /v1/route`.

**curl:**
```bash
curl -X POST http://localhost:8642/v1/agents/odin \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Analyze the current system load and recommend optimizations",
    "maxTokens": 500
  }'
```

---

#### `GET /v1/agents/external`

List all registered external agents (discovered via MCP or ACP).

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `protocol` | `string` | Filter by protocol: `"mcp"`, `"acp"`, or `"both"` |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "name": "github-surgeon",
      "protocol": "mcp",
      "tools": ["git_rebase", "git_bisect"],
      "capabilities": ["version-control", "automation"]
    }
  ],
  "timestamp": "2026-06-06T12:00:00.000Z"
}
```

**curl:**
```bash
curl "http://localhost:8642/v1/agents/external?protocol=mcp"
```

---

#### `POST /v1/agents/external/register`

Register an external agent from its MCP endpoint.

**Request Body:**
```typescript
{
  name: string;        // Required: agent name
  mcpUrl: string;      // Required: MCP server URL
  tools?: Array<{      // Optional: tool definitions
    name: string;
    description?: string;
    inputSchema?: Record<string, unknown>;
  }>;
  capabilities?: string[];  // Optional: capability tags
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "name": "github-surgeon",
    "protocol": "mcp",
    "tools": ["git_rebase", "git_bisect"],
    "capabilities": ["version-control"]
  },
  "timestamp": "2026-06-06T12:00:00.000Z"
}
```

**curl:**
```bash
curl -X POST http://localhost:8642/v1/agents/external/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "github-surgeon",
    "mcpUrl": "http://localhost:3001",
    "tools": [
      { "name": "git_rebase", "description": "Interactive rebase" },
      { "name": "git_bisect", "description": "Binary search for bugs" }
    ],
    "capabilities": ["version-control", "automation"]
  }'
```

---

### 4.4 Council

#### `POST /v1/council`

Submit a proposal to the Council for deliberation. The Council is a multi-agent decision-making system where agents vote on proposals.

**Request Body:**
```typescript
{
  proposal: {
    title: string;         // Required: proposal title
    description: string;   // Required: proposal description
    type?: string;         // Optional: proposal type
    priority?: string;     // Optional: priority level
  }
}
```

**Response (202 Accepted):**
```json
{
  "success": true,
  "data": {
    "sessionId": "council-abc-123",
    "status": "in_progress",
    "message": "Council session started"
  },
  "timestamp": "2026-06-06T12:00:00.000Z"
}
```

**curl:**
```bash
curl -X POST http://localhost:8642/v1/council \
  -H "Content-Type: application/json" \
  -d '{
    "proposal": {
      "title": "Migrate to GPT-5 for code review agent",
      "description": "The current model misses 30% of critical bugs. GPT-5 shows 95% accuracy on our benchmark."
    }
  }'
```

---

#### `GET /v1/council/:id`

Get the status and results of a Council session.

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "council-abc-123",
    "proposal": {
      "title": "Migrate to GPT-5 for code review agent",
      "description": "The current model misses 30% of critical bugs."
    },
    "status": "completed",
    "votes": {
      "approve": ["odin", "mimir"],
      "reject": ["brokkr"],
      "abstain": []
    },
    "result": "approved",
    "completedAt": "2026-06-06T12:05:00.000Z"
  },
  "timestamp": "2026-06-06T12:05:00.000Z"
}
```

**curl:**
```bash
curl http://localhost:8642/v1/council/council-abc-123
```

---

### 4.5 Plugins

#### `GET /v1/plugins`

List all installed plugins.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "name": "github-surgeon",
      "version": "1.2.0",
      "dockerImage": "talos/plugin-github-surgeon:1.2.0",
      "active": true,
      "tools": ["git_rebase", "git_bisect"]
    }
  ],
  "timestamp": "2026-06-06T12:00:00.000Z"
}
```

**curl:**
```bash
curl http://localhost:8642/v1/plugins
```

---

#### `POST /v1/plugins`

Install a new plugin from a manifest.

**Request Body:**
```typescript
{
  manifest: {
    name: string;           // Required: plugin name
    version: string;        // Required: version
    dockerImage: string;    // Required: Docker image
    configSchema?: object;  // Optional: JSON Schema
    healthEndpoint?: string;// Optional: health check path
    tools?: Array<{
      name: string;
      description?: string;
      inputSchema?: Record<string, unknown>;
    }>;
  }
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "name": "github-surgeon",
    "version": "1.2.0",
    "dockerImage": "talos/plugin-github-surgeon:1.2.0",
    "active": true
  },
  "timestamp": "2026-06-06T12:00:00.000Z"
}
```

**curl:**
```bash
curl -X POST http://localhost:8642/v1/plugins \
  -H "Content-Type: application/json" \
  -d '{
    "manifest": {
      "name": "github-surgeon",
      "version": "1.2.0",
      "dockerImage": "talos/plugin-github-surgeon:1.2.0",
      "tools": [
        { "name": "git_rebase", "description": "Interactive rebase" }
      ]
    }
  }'
```

---

#### `GET /v1/plugins/health`

Run health checks on all installed plugins.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "name": "github-surgeon",
      "status": "healthy",
      "latencyMs": 12,
      "lastChecked": "2026-06-06T12:00:00.000Z"
    }
  ],
  "timestamp": "2026-06-06T12:00:00.000Z"
}
```

**curl:**
```bash
curl http://localhost:8642/v1/plugins/health
```

---

#### `GET /v1/plugins/:id`

Get a specific plugin by name or ID.

**Response:**
```json
{
  "success": true,
  "data": {
    "name": "github-surgeon",
    "version": "1.2.0",
    "dockerImage": "talos/plugin-github-surgeon:1.2.0",
    "active": true,
    "tools": ["git_rebase", "git_bisect"]
  },
  "timestamp": "2026-06-06T12:00:00.000Z"
}
```

**curl:**
```bash
curl http://localhost:8642/v1/plugins/github-surgeon
```

---

#### `DELETE /v1/plugins/:id`

Uninstall a plugin. Returns `{ removed: true }` on success, 404 if not found.

**Response:**
```json
{
  "success": true,
  "data": { "removed": true },
  "timestamp": "2026-06-06T12:00:00.000Z"
}
```

**curl:**
```bash
curl -X DELETE http://localhost:8642/v1/plugins/github-surgeon
```

---

### 4.6 MCP (Model Context Protocol)

#### `GET /v1/mcp/endpoints`

List all configured MCP endpoints.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `healthy` | `string` | If `"true"`, only return healthy endpoints |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "browser",
      "name": "Playwright Browser",
      "status": "healthy",
      "tools": ["browser_navigate", "browser_click", "browser_snapshot"]
    }
  ],
  "timestamp": "2026-06-06T12:00:00.000Z"
}
```

**curl:**
```bash
curl "http://localhost:8642/v1/mcp/endpoints?healthy=true"
```

---

#### `POST /v1/mcp/execute`

Execute a tool on an MCP endpoint.

**Request Body:**
```typescript
{
  endpointId: string;    // Required: MCP endpoint ID
  tool: string;          // Required: tool name
  args?: Record<string, unknown>;  // Optional: tool arguments
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "result": {
      "url": "https://example.com",
      "title": "Example Domain"
    }
  },
  "timestamp": "2026-06-06T12:00:00.000Z"
}
```

**curl:**
```bash
curl -X POST http://localhost:8642/v1/mcp/execute \
  -H "Content-Type: application/json" \
  -d '{
    "endpointId": "browser",
    "tool": "browser_navigate",
    "args": { "url": "https://example.com" }
  }'
```

---

### 4.7 ACP (Agent Communication Protocol)

#### `POST /v1/acp`

Execute an ACP operation (read, write, exec, lint, search).

**Request Body:**
```typescript
{
  operation: "read" | "write" | "exec" | "lint" | "search";  // Required
  path: string;            // Required: file path or search query
  content?: string;        // Required for "write"
  language?: string;       // Optional: for "lint"
}
```

**Response (read):**
```json
{
  "success": true,
  "data": {
    "success": true,
    "content": "import { createServer } from 'node:http';\n..."
  },
  "timestamp": "2026-06-06T12:00:00.000Z"
}
```

**Response (lint):**
```json
{
  "success": true,
  "data": {
    "success": true,
    "issues": [
      { "line": 12, "column": 5, "severity": "warning", "message": "Unused variable 'x'" }
    ]
  },
  "timestamp": "2026-06-06T12:00:00.000Z"
}
```

**curl:**
```bash
curl -X POST http://localhost:8642/v1/acp \
  -H "Content-Type: application/json" \
  -d '{
    "operation": "read",
    "path": "packages/core/src/api/server.ts"
  }'
```

---

### 4.8 Graphify (Knowledge Graph)

The Graphify system stores and queries knowledge triples (subject-predicate-object) in a JSON-based graph store.

#### `POST /v1/graphify/triple`

Add a knowledge triple.

**Request Body:**
```typescript
{
  subject: string;     // Required: entity name
  predicate: string;   // Required: relation
  object: string;      // Required: target entity
  context?: string;    // Optional: source reference
  weight?: number;     // Optional: confidence weight
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "triple-abc-123",
    "subject": "OdinAgent",
    "predicate": "depends_on",
    "object": "AiEngine",
    "context": "architecture review",
    "weight": 0.9,
    "createdAt": "2026-06-06T12:00:00.000Z"
  },
  "timestamp": "2026-06-06T12:00:00.000Z"
}
```

**curl:**
```bash
curl -X POST http://localhost:8642/v1/graphify/triple \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "OdinAgent",
    "predicate": "depends_on",
    "object": "AiEngine",
    "context": "architecture review",
    "weight": 0.9
  }'
```

---

#### `GET /v1/graphify/triples`

Query triples with optional filters.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `entity` | `string` | Filter by subject or object (partial match) |
| `predicate` | `string` | Filter by predicate (partial match) |
| `subject` | `string` | Filter by subject (partial match) |
| `object` | `string` | Filter by object (partial match) |
| `limit` | `number` | Max results (default: 100) |
| `offset` | `number` | Pagination offset |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "triple-abc-123",
      "subject": "OdinAgent",
      "predicate": "depends_on",
      "object": "AiEngine",
      "context": "architecture review",
      "weight": 0.9
    }
  ],
  "timestamp": "2026-06-06T12:00:00.000Z"
}
```

**curl:**
```bash
curl "http://localhost:8642/v1/graphify/triples?entity=OdinAgent&limit=10"
```

---

#### `GET /v1/graphify/stats`

Get graph statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalTriples": 1247,
    "uniqueSubjects": 89,
    "uniquePredicates": 34,
    "uniqueObjects": 156,
    "avgWeight": 0.72
  },
  "timestamp": "2026-06-06T12:00:00.000Z"
}
```

**curl:**
```bash
curl http://localhost:8642/v1/graphify/stats
```

---

#### `DELETE /v1/graphify/triple/:id`

Delete a specific triple by ID.

**Response:**
```json
{
  "success": true,
  "data": { "removed": true },
  "timestamp": "2026-06-06T12:00:00.000Z"
}
```

**curl:**
```bash
curl -X DELETE http://localhost:8642/v1/graphify/triple/triple-abc-123
```

---

#### `DELETE /v1/graphify`

Clear the entire knowledge graph.

**Response:**
```json
{
  "success": true,
  "data": { "cleared": true },
  "timestamp": "2026-06-06T12:00:00.000Z"
}
```

**curl:**
```bash
curl -X DELETE http://localhost:8642/v1/graphify
```

---

#### `GET /v1/graphify/search/entity`

Search triples by entity name (partial match on subject or object).

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `q` | `string` | Required: search query |
| `limit` | `number` | Max results |

**curl:**
```bash
curl "http://localhost:8642/v1/graphify/search/entity?q=Odin&limit=20"
```

---

#### `GET /v1/graphify/search/predicate`

Search triples by predicate (partial match).

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `q` | `string` | Required: search query |
| `limit` | `number` | Max results |

**curl:**
```bash
curl "http://localhost:8642/v1/graphify/search/predicate?q=depends"
```

---

#### `GET /v1/graphify/path`

Find a path between two entities in the graph.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `from` | `string` | Required: source entity |
| `to` | `string` | Required: target entity |
| `maxDepth` | `number` | Max traversal depth (default: 5) |

**Response:**
```json
{
  "success": true,
  "data": {
    "paths": [
      [
        { "subject": "OdinAgent", "predicate": "depends_on", "object": "AiEngine" },
        { "subject": "AiEngine", "predicate": "uses", "object": "G0DM0D3Router" }
      ]
    ],
    "found": true
  },
  "timestamp": "2026-06-06T12:00:00.000Z"
}
```

**curl:**
```bash
curl "http://localhost:8642/v1/graphify/path?from=OdinAgent&to=G0DM0D3Router&maxDepth=3"
```

---

### 4.9 Workflows

#### `POST /v1/workflow`

Create a new workflow definition.

**Request Body:**
```typescript
{
  name: string;           // Required: workflow name
  description?: string;   // Optional: description
  nodes: Array<{          // Required: non-empty array of nodes
    id: string;
    type: "prompt" | "code" | "condition" | "parallel" | "loop" | "sub_workflow" | "graphify" | "delay" | "webhook" | "plugin";
    config: Record<string, unknown>;
    dependsOn?: string[];
  }>;
  variables?: Record<string, unknown>;  // Optional: default variables
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "wf-abc-123",
    "name": "Summarize Codebase",
    "description": "Traverse and summarize the entire codebase",
    "version": "1.0.0",
    "nodeCount": 5,
    "createdAt": "2026-06-06T12:00:00.000Z"
  },
  "timestamp": "2026-06-06T12:00:00.000Z"
}
```

**curl:**
```bash
curl -X POST http://localhost:8642/v1/workflow \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Summarize Codebase",
    "description": "Traverse and summarize the entire codebase",
    "nodes": [
      {
        "id": "start",
        "type": "prompt",
        "config": { "prompt": "List all source directories" }
      },
      {
        "id": "summarize",
        "type": "prompt",
        "config": { "prompt": "Summarize each directory" },
        "dependsOn": ["start"]
      }
    ]
  }'
```

---

#### `GET /v1/workflow`

List all saved workflows.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "wf-abc-123",
      "name": "Summarize Codebase",
      "updatedAt": "2026-06-06T12:00:00.000Z"
    }
  ],
  "timestamp": "2026-06-06T12:00:00.000Z"
}
```

**curl:**
```bash
curl http://localhost:8642/v1/workflow
```

---

#### `POST /v1/workflow/validate`

Validate a workflow definition without persisting it. Returns validation errors or success.

**Request Body:**
```typescript
{
  nodes: Array<{          // Required: nodes to validate
    id: string;
    type: string;
    config: Record<string, unknown>;
    dependsOn?: string[];
  }>;
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "errors": [],
    "warnings": [],
    "nodeCount": 5,
    "hasCycles": false
  },
  "timestamp": "2026-06-06T12:00:00.000Z"
}
```

**curl:**
```bash
curl -X POST http://localhost:8642/v1/workflow/validate \
  -H "Content-Type: application/json" \
  -d '{
    "nodes": [
      { "id": "a", "type": "prompt", "config": { "prompt": "hello" } },
      { "id": "b", "type": "prompt", "config": { "prompt": "world" }, "dependsOn": ["a"] }
    ]
  }'
```

---

#### `POST /v1/workflow/:id/run`

Execute a workflow. Returns immediately with a run ID (async execution).

**Request Body:**
```typescript
{
  variables?: Record<string, unknown>;  // Optional: runtime variables
  triggeredBy?: string;                 // Optional: trigger source (default: "api")
}
```

**Response (202 Accepted):**
```json
{
  "success": true,
  "data": {
    "runId": "run-abc-123",
    "state": "pending",
    "storeLocation": ".talos/workflows/"
  },
  "timestamp": "2026-06-06T12:00:00.000Z"
}
```

**curl:**
```bash
curl -X POST http://localhost:8642/v1/workflow/wf-abc-123/run \
  -H "Content-Type: application/json" \
  -d '{
    "variables": { "targetDir": "packages/core" },
    "triggeredBy": "api"
  }'
```

---

#### `GET /v1/workflow/run/:id`

Get the status and results of a workflow run.

**Response:**
```json
{
  "success": true,
  "data": {
    "runId": "run-abc-123",
    "workflowId": "wf-abc-123",
    "workflowName": "Summarize Codebase",
    "state": "completed",
    "variables": { "targetDir": "packages/core" },
    "triggeredBy": "api",
    "startedAt": "2026-06-06T12:00:00.000Z",
    "completedAt": "2026-06-06T12:05:00.000Z",
    "nodes": [
      {
        "nodeId": "start",
        "state": "completed",
        "attempts": 1,
        "durationMs": 1200,
        "output": { "directories": ["src", "tests"] }
      },
      {
        "nodeId": "summarize",
        "state": "completed",
        "attempts": 1,
        "durationMs": 3500,
        "output": { "summary": "Core package contains AI routing..." }
      }
    ]
  },
  "timestamp": "2026-06-06T12:05:00.000Z"
}
```

**curl:**
```bash
curl http://localhost:8642/v1/workflow/run/run-abc-123
```

---

#### `GET /v1/workflow/runs`

List all workflow runs, optionally filtered by workflow ID.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `workflowId` | `string` | Filter by workflow ID |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "runId": "run-abc-123",
      "workflowId": "wf-abc-123",
      "state": "completed",
      "startedAt": "2026-06-06T12:00:00.000Z"
    }
  ],
  "timestamp": "2026-06-06T12:00:00.000Z"
}
```

**curl:**
```bash
curl "http://localhost:8642/v1/workflow/runs?workflowId=wf-abc-123"
```

---

### 4.10 Blueprint

#### `POST /v1/blueprint/diff`

Parse a blueprint diff between two versions. Compares the current blueprint against a target version.

**Response:**
```json
{
  "success": true,
  "data": {
    "diffs": [
      {
        "type": "added",
        "section": "§9.2",
        "description": "New node type: sub_workflow",
        "impact": "medium"
      }
    ],
    "sourceVersion": "v8.0",
    "targetVersion": "v8.1"
  },
  "timestamp": "2026-06-06T12:00:00.000Z"
}
```

**curl:**
```bash
curl -X POST http://localhost:8642/v1/blueprint/diff
```

---

#### `POST /v1/blueprint/plan`

Generate a reconfiguration plan from a blueprint diff.

**Request Body:**
```typescript
{
  source: string;  // Required: source version (e.g., "v8.0")
  target: string;  // Required: target version (e.g., "v8.1")
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "plan": [
      {
        "step": 1,
        "action": "Add sub_workflow node type to WorkflowNodeTypeSchema",
        "files": ["packages/core/src/workflow/types.ts"],
        "estimated effort": "1 hour"
      },
      {
        "step": 2,
        "action": "Implement executeSubWorkflowNode",
        "files": ["packages/core/src/workflow/executor.ts"],
        "estimated effort": "2 hours"
      }
    ],
    "totalSteps": 5,
    "estimatedTotalEffort": "8 hours"
  },
  "timestamp": "2026-06-06T12:00:00.000Z"
}
```

**curl:**
```bash
curl -X POST http://localhost:8642/v1/blueprint/plan \
  -H "Content-Type: application/json" \
  -d '{ "source": "v8.0", "target": "v8.1" }'
```

---

## 5. Error Handling

All errors follow the standard `ApiResponse` envelope with `success: false` and an `error` string.

### Common Errors

| Scenario | Status | Error Message |
|----------|--------|---------------|
| Missing required field | 400 | `"name and non-empty nodes required"` |
| Resource not found | 404 | `"Not found"` or `"Plugin not found"` or `"Run not found"` |
| Invalid proposal | 400 | `"Proposal must include title and description"` |
| MCP tool failure | 502 | Upstream error message |
| Server crash | 500 | `(err as Error).message` |

### Validation Pattern

The API validates required fields inline:

```typescript
if (!body.name || !body.nodes || body.nodes.length === 0) {
  return sendJson(res, 400, {
    success: false,
    error: "name and non-empty nodes required",
    timestamp: new Date().toISOString()
  });
}
```

No validation library is used — all validation is manual and explicit.

---

## 6. Authentication

**Current state:** No authentication. The API is designed for local-only operation (bound to `0.0.0.0:8642` by default).

**Future plans:** JWT-based authentication for remote access. The `SUPABASE_SERVICE_ROLE_KEY` is used server-side only and never exposed to clients.

### Security Considerations

- The API is **not exposed to the internet** by default (local binding).
- RLS on Supabase tables provides an additional data-layer security boundary.
- The `service_role` key bypasses RLS — it must never be sent to browsers or untrusted clients.
- Future JWT auth will add per-user RLS enforcement via Supabase's `auth.uid()`.

---

## 7. Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `TALOS_PORT` | `8642` | API server port |
| `TALOS_HOST` | `0.0.0.0` | API server bind address |
| `SUPABASE_URL` | — | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | — | Supabase service role key |
| `TALOS_WORKFLOW_DB_ENABLED` | `false` | Enable Supabase-backed workflow persistence |
| `TALOS_OWL_ALPHA_ENABLED` | `true` | Enable Owl Alpha as top-priority cloud model |
| `TALOS_WORKFLOW_CODE_ENABLED` | `false` | Enable `code` and `condition` workflow node types (RCE gate) |

---

## 8. CORS

The API sets permissive CORS headers for local development:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

Preflight `OPTIONS` requests return `204 No Content`.

**Production note:** For remote deployments, restrict `Access-Control-Allow-Origin` to the Mission Control UI domain.

---

## 9. Request/Response Examples

### Full Example: Create and Run a Workflow

```bash
# 1. Create a workflow
curl -X POST http://localhost:8642/v1/workflow \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Code Review Pipeline",
    "description": "Automated code review with multiple agents",
    "nodes": [
      {
        "id": "diff",
        "type": "prompt",
        "config": { "prompt": "Generate a diff of the current branch" }
      },
      {
        "id": "review",
        "type": "prompt",
        "config": { "prompt": "Review the diff for bugs and style issues" },
        "dependsOn": ["diff"]
      },
      {
        "id": "summary",
        "type": "prompt",
        "config": { "prompt": "Write a summary of the review findings" },
        "dependsOn": ["review"]
      }
    ]
  }'

# Response: { "data": { "id": "wf-xyz", "name": "Code Review Pipeline", ... } }

# 2. Execute the workflow
curl -X POST http://localhost:8642/v1/workflow/wf-xyz/run \
  -H "Content-Type: application/json" \
  -d '{ "variables": { "branch": "feature/new-api" } }'

# Response: { "data": { "runId": "run-abc", "state": "pending", ... } }

# 3. Check run status
curl http://localhost:8642/v1/workflow/run/run-abc

# Response: { "data": { "state": "completed", "nodes": [...], ... } }
```

### Full Example: Knowledge Graph

```bash
# Add triples
curl -X POST http://localhost:8642/v1/graphify/triple \
  -H "Content-Type: application/json" \
  -d '{ "subject": "TalosOS", "predicate": "built_with", "object": "TypeScript" }'

curl -X POST http://localhost:8642/v1/graphify/triple \
  -H "Content-Type: application/json" \
  -d '{ "subject": "TalosOS", "predicate": "uses", "object": "Supabase" }'

curl -X POST http://localhost:8642/v1/graphify/triple \
  -H "Content-Type: application/json" \
  -d '{ "subject": "Supabase", "predicate": "provides", "object": "PostgreSQL" }'

# Query by entity
curl "http://localhost:8642/v1/graphify/triples?entity=TalosOS"

# Find path
curl "http://localhost:8642/v1/graphify/path?from=TalosOS&to=PostgreSQL"
# Returns: [[TalosOS → uses → Supabase → provides → PostgreSQL]]

# Get stats
curl http://localhost:8642/v1/graphify/stats
```

### Full Example: AI Routing

```bash
# Simple prompt
curl -X POST http://localhost:8642/v1/route \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Explain the Raft consensus algorithm in 3 sentences",
    "agentId": "mimir",
    "maxTokens": 200,
    "temperature": 0.7
  }'

# With conversation history
curl -X POST http://localhost:8642/v1/route \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Now compare it to Paxos",
    "messages": [
      { "role": "user", "content": "Explain the Raft consensus algorithm" },
      { "role": "assistant", "content": "Raft is a consensus algorithm designed..." }
    ],
    "agentId": "mimir",
    "maxTokens": 300
  }'
```

### Full Example: Plugin Lifecycle

```bash
# List installed plugins
curl http://localhost:8642/v1/plugins

# Install a plugin
curl -X POST http://localhost:8642/v1/plugins \
  -H "Content-Type: application/json" \
  -d '{
    "manifest": {
      "name": "obsidian-vault",
      "version": "0.9.1",
      "dockerImage": "talos/plugin-obsidian-vault:0.9.1",
      "tools": [
        { "name": "vault_read", "description": "Read note from vault" },
        { "name": "vault_write", "description": "Write note to vault" }
      ]
    }
  }'

# Check health
curl http://localhost:8642/v1/plugins/health

# Uninstall
curl -X DELETE http://localhost:8642/v1/plugins/obsidian-vault
```

---

## 10. Endpoint Summary

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | System health check |
| `GET` | `/health/providers` | Provider health status |
| `POST` | `/v1/route` | AI route request |
| `POST` | `/v1/agents/:id` | Execute agent |
| `GET` | `/v1/agents/external` | List external agents |
| `POST` | `/v1/agents/external/register` | Register external agent |
| `POST` | `/v1/council` | Submit proposal |
| `GET` | `/v1/council/:id` | Get council session |
| `GET` | `/v1/plugins` | List plugins |
| `POST` | `/v1/plugins` | Install plugin |
| `GET` | `/v1/plugins/health` | Plugin health check |
| `GET` | `/v1/plugins/:id` | Get plugin |
| `DELETE` | `/v1/plugins/:id` | Uninstall plugin |
| `GET` | `/v1/mcp/endpoints` | List MCP endpoints |
| `POST` | `/v1/mcp/execute` | Execute MCP tool |
| `POST` | `/v1/acp` | ACP operations |
| `POST` | `/v1/graphify/triple` | Add knowledge triple |
| `GET` | `/v1/graphify/triples` | Query triples |
| `GET` | `/v1/graphify/stats` | Graph statistics |
| `DELETE` | `/v1/graphify/triple/:id` | Delete triple |
| `DELETE` | `/v1/graphify` | Clear graph |
| `GET` | `/v1/graphify/search/entity` | Search by entity |
| `GET` | `/v1/graphify/search/predicate` | Search by predicate |
| `GET` | `/v1/graphify/path` | Find path in graph |
| `POST` | `/v1/workflow` | Create workflow |
| `GET` | `/v1/workflow` | List workflows |
| `POST` | `/v1/workflow/validate` | Validate workflow |
| `POST` | `/v1/workflow/:id/run` | Execute workflow |
| `GET` | `/v1/workflow/run/:id` | Get run status |
| `GET` | `/v1/workflow/runs` | List runs |
| `POST` | `/v1/blueprint/diff` | Parse blueprint diff |
| `POST` | `/v1/blueprint/plan` | Generate reconfiguration plan |

**Total: 31 endpoints** across 10 resource groups.
