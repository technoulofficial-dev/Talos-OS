# Workflow Engine — DAG-Based Workflow Executor

> A directed acyclic graph (DAG) workflow executor with 10 node types, retry logic, timeout enforcement, and dual-mode persistence (JSON files or Supabase).

## Table of Contents

1. [Purpose](#1-purpose)
2. [DAG Execution Model](#2-dag-execution-model)
3. [10 Node Types](#3-10-node-types)
4. [State Machine](#4-state-machine)
5. [Retry Logic](#5-retry-logic)
6. [Timeout Enforcement](#6-timeout-enforcement)
7. [Persistence — Dual-Mode](#7-persistence--dual-mode)
8. [Validation](#8-validation)
9. [Security](#9-security)
10. [API Endpoints](#10-api-endpoints)
11. [Type Reference](#11-type-reference)
12. [Testing](#12-testing)
13. [Source Files](#13-source-files)

---

## 1. Purpose

The Workflow Engine executes multi-step workflows as directed acyclic graphs. Each node represents a unit of work — calling an AI agent, running a council evaluation, executing an HTTP request, branching on a condition, or querying the knowledge graph.

**Key capabilities:**

- **10 node types** — Agent, Council, Plugin, Condition, Parallel, Loop, HTTP, Code, Sub-workflow, Graphify
- **DAG execution** — Kahn's topological sort ensures correct dependency ordering
- **Retry with backoff** — Configurable per-node retry on timeout or error
- **Timeout enforcement** — Per-node `timeoutMs` with `Promise.race`
- **Skip-on-fail cascade** — Downstream nodes skipped when upstream fails
- **Dual-mode persistence** — JSON files (default) or Supabase database (opt-in)
- **Validation** — Catches duplicate IDs, unknown dependencies, cycles, missing configs
- **Real-time callbacks** — `onRunUpdate()` fires after each node completes

---

## 2. DAG Execution Model

### Topological Sort

The engine uses **Kahn's algorithm** (`engine.ts:22-49`):

1. Build in-degree map and adjacency list from `dependsOn` arrays
2. Enqueue all nodes with in-degree 0
3. Process queue: for each node, decrement neighbors' in-degrees; enqueue if reaches 0
4. If result length equals input length → valid DAG; otherwise → cycle detected

### Execution Loop

```
for each node in topoOrder:
  if any upstream node failed:
    mark node as "skipped"
  else if all dependencies are "completed" or "skipped":
    execute node with timeout
    if node fails → set failed flag → all subsequent nodes skipped
  else:
    mark node as "skipped" (missing dependency)
```

**Key invariants:**

- Nodes execute in topological order — a node never runs before its dependencies
- Once a node fails, all remaining nodes are skipped (fail-fast)
- Skipped nodes still get `completedAt` timestamps for audit trails
- The workflow state is persisted after every node execution

### Cycle Detection

`detectCycle()` (`engine.ts:51-81`) uses Kahn's algorithm to count processed nodes. If `processed !== nodes.length`, the unprocessed nodes form a cycle and their IDs are returned as a validation issue.

---

## 3. 10 Node Types

Each node type has a dedicated executor receiving a `NodeExecutionContext` with the workflow definition, current run, node run state, and shared variables.

### 3.1 agent — Route to AI Agent

| Config Field | Type | Required | Description |
|-------------|------|----------|-------------|
| `agentId` | `string` | Yes | Agent identifier for routing |
| `prompt` | `string` | No | Prompt to send |

Calls `routeUnlimited()` with `maxTokens: 1024`. Returns `{ provider, output, model }`.

```json
{ "id": "research", "type": "agent", "name": "Research",
  "config": { "agentId": "odin", "prompt": "Research AI orchestration trends" },
  "dependsOn": [], "timeoutMs": 30000 }
```

### 3.2 council — Trigger Council Evaluation

| Config Field | Type | Required | Description |
|-------------|------|----------|-------------|
| `proposal` | `{ title, description, priority, context? }` | Yes | Proposal to evaluate |

Creates a Council session via `createSession()`, executes via `executeSession()`. Returns `{ sessionId, verdict, reports }`. Waits for full 5-advisor evaluation (30-60s typical).

```json
{ "id": "review", "type": "council", "name": "Council Review",
  "config": { "proposal": { "title": "API design", "description": "Add REST endpoint", "priority": "high" } },
  "dependsOn": ["design"], "timeoutMs": 120000 }
```

### 3.3 plugin — Execute MCP Tool

| Config Field | Type | Required | Description |
|-------------|------|----------|-------------|
| `endpointId` | `string` | Yes | MCP endpoint identifier |
| `tool` | `string` | Yes | Tool name to execute |
| `args` | `Record<string, unknown>` | No | Tool arguments (default: `{}`) |

Calls `executeTool({ endpointId, tool, args })`. Throws if `result.success` is false.

```json
{ "id": "screenshot", "type": "plugin", "name": "Browser Screenshot",
  "config": { "endpointId": "browser", "tool": "browser_take_screenshot", "args": { "type": "png" } },
  "dependsOn": ["deploy"] }
```

### 3.4 condition — Branching Logic

| Config Field | Type | Required | Description |
|-------------|------|----------|-------------|
| `expression` | `string` | No | JavaScript expression evaluated against variables |

**Gated** behind `TALOS_WORKFLOW_CODE_ENABLED=true`. Evaluates via `new Function("variables", \`with (variables) { return (${expression}); }\`)`. Returns `{ branch: 0|1, evaluated: boolean }` — branch 1 = true, branch 0 = false.

```json
{ "id": "check-score", "type": "condition", "name": "Quality Check",
  "config": { "expression": "variables.qualityScore > 80" },
  "dependsOn": ["quality-check"], "timeoutMs": 5000 }
```

### 3.5 parallel — Fan-Out Branches

| Config Field | Type | Default | Description |
|-------------|------|---------|-------------|
| `branches` | `number` | `2` | Number of parallel branches |

Marker node returning `{ parallelBranches, status: "fanned_out" }`. Actual fan-out is handled by the DAG structure — multiple downstream nodes depend on this node.

### 3.6 loop — Iterate Over Array

| Config Field | Type | Default | Description |
|-------------|------|---------|-------------|
| `iterSource` | `string` | — | Variable name containing the array |
| `maxIterations` | `number` | `10` | Maximum iterations (cap) |

Marker node returning `{ iterations: min(items.length, maxIterations), maxIterations }`. Reads `variables[iterSource]` as the source array.

### 3.7 http — HTTP Request

| Config Field | Type | Required | Default | Description |
|-------------|------|----------|---------|-------------|
| `url` | `string` | Yes | — | URL to fetch |
| `method` | `string` | No | `"GET"` | HTTP method |
| `headers` | `Record<string, string>` | No | `{}` | Request headers |
| `body` | `unknown` | No | — | Body (auto-JSON-stringified for non-GET/DELETE) |

Auto-adds `Content-Type: application/json` if body present and no Content-Type set. Returns `{ status, ok, body }`.

```json
{ "id": "webhook", "type": "http", "name": "Notify Slack",
  "config": { "url": "https://hooks.slack.com/services/T00/B00/xxx", "method": "POST",
              "headers": { "Content-Type": "application/json" }, "body": { "text": "Done!" } },
  "dependsOn": ["process"] }
```

### 3.8 code — Execute JavaScript

| Config Field | Type | Default | Description |
|-------------|------|---------|-------------|
| `code` | `string` | — | JavaScript code to execute |
| `language` | `string` | `"javascript"` | Language (only JS supported) |

**Gated** behind `TALOS_WORKFLOW_CODE_ENABLED=true`. Executes via `new Function("variables", code)`. Returns the function's return value.

```json
{ "id": "transform", "type": "code", "name": "Transform Data",
  "config": { "code": "return variables.items.filter(i => i.active).map(i => i.id);" },
  "dependsOn": ["fetch"], "timeoutMs": 5000 }
```

### 3.9 sub_workflow — Execute Another Workflow

| Config Field | Type | Required | Description |
|-------------|------|----------|-------------|
| `subWorkflowId` | `string` | Yes | ID of the workflow to execute |
| `passThrough` | `Record<string, unknown>` | No | Variables to merge into child |

Calls `executeWorkflow(subWorkflowId, { ...variables, ...passThrough }, parent:runId)` synchronously. Returns `{ childRunId, childState, childError, childNodeCount }`.

### 3.10 graphify — Knowledge Graph Operations

| Config Field | Type | Default | Description |
|-------------|------|---------|-------------|
| `graphifyAction` | `"query" \| "add"` | `"query"` | Operation to perform |
| `graphifyEntity` | `string` | — | Entity filter / subject |
| `graphifyPredicate` | `string` | — | Predicate filter / predicate |
| `graphifyLimit` | `number` | `10` | Max results (query only) |

**add:** Uses previous node output as object, calls `addTriple()`. **query:** Calls `queryTriples()`, returns `{ count, triples }`.

```json
{ "id": "log-result", "type": "graphify", "name": "Log to Graph",
  "config": { "graphifyAction": "add", "graphifyEntity": "WorkflowRun", "graphifyPredicate": "completed_at" },
  "dependsOn": ["process"] }
```

---

## 4. State Machine

### Node States

```
pending → running → completed
                  → failed
                  → skipped
```

| State | Meaning |
|-------|---------|
| `pending` | Not started (initial) |
| `running` | Currently executing |
| `completed` | Finished successfully |
| `failed` | Threw error (after retries exhausted) |
| `skipped` | Skipped due to upstream failure or missing dependency |

### Workflow States

```
draft → pending → running → completed
                       → failed
                       → cancelled
```

The workflow state is persisted after every node execution for crash recovery.

---

## 5. Retry Logic

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `maxRetries` | `number` | `0` | Max retry attempts (0 = no retries) |
| `retryOn` | `Array<"timeout" \| "error">` | `["error"]` | Which failures trigger retry |

**Total attempts = 1 (initial) + maxRetries.** For `maxRetries: 2`, the node attempts up to 3 times. The retry loop in `runNode()` (`engine.ts:419-447`) catches errors and re-attempts until exhausted.

**Note:** `retryOn` is defined in the schema but not yet used to filter which errors trigger retries. Currently all errors trigger retries if `maxRetries > 0`.

---

## 6. Timeout Enforcement

Each node has `timeoutMs` (default: `30000`). Implemented via `withTimeout()` (`engine.ts:214-224`) using `Promise.race()`:

```typescript
nodeRun.output = await withTimeout(executor(ctx), node.timeoutMs);
```

**Recommended timeouts:** `agent` 30-60s, `council` 120s, `plugin/http` 10-30s, `condition/parallel/loop/code` 5s, `sub_workflow` 60-300s, `graphify` 10s.

---

## 7. Persistence — Dual-Mode

### Mode 1: JSON Files (Default)

**Location:** `{CWD}/.talos/workflows/` (configurable via `TALOS_WORKFLOW_DIR`)

```
.talos/workflows/
├── _index.json              # Index of all workflows and runs
├── workflow-{uuid}.json     # Workflow definition
├── run-{uuid}.json          # Run state with node outputs
```

Operations: `saveWorkflow` writes JSON + updates index; `loadWorkflow` reads JSON and parses dates; `listWorkflows` reads index; `deleteWorkflow` removes file + updates index.

### Mode 2: Supabase Database

**Enable:** `TALOS_WORKFLOW_DB_ENABLED=true`

**Tables** (from `supabase/migrations/0003_workflows.sql`):

| Table | Purpose |
|-------|---------|
| `talos_workflows` | Workflow definitions (JSONB `definition` column) |
| `talos_workflow_runs` | Run metadata and state |
| `talos_run_logs` | Per-node execution logs |

All tables have RLS: all roles can SELECT, only `service_role` can write. The DB module is loaded via `import("@talos/db")` dynamically, keeping 40+ tests passing without Supabase.

---

## 8. Validation

`validateWorkflow()` checks for structural and semantic issues:

| Check Code | Description |
|-----------|-------------|
| `empty_workflow` | Workflow has no nodes |
| `duplicate_node_id` | Two nodes share the same ID |
| `unknown_dependency` | A node depends on a non-existent node |
| `cycle` | A dependency cycle is detected |
| `missing_required_config` | Node is missing required config fields |

**Per-type required config:** `agent` → `agentId`; `council` → `proposal`; `plugin` → `endpointId` + `tool`; `http` → `url`; `sub_workflow` → `subWorkflowId`; `graphify` → `graphifyEntity` OR `graphifyPredicate`.

---

## 9. Security

### Code Execution Gate

`condition` and `code` nodes execute arbitrary JavaScript via `new Function()`. Both are gated behind `TALOS_WORKFLOW_CODE_ENABLED` (default OFF). Set `TALOS_WORKFLOW_CODE_ENABLED=true` to enable.

**ADR-012:** Added to prevent RCE via `POST /v1/workflow` with unauthenticated `new Function()` execution.

### Defense-in-Depth

Validation catches cycles (infinite loops), missing configs (null pointer errors), and duplicate IDs (ambiguous references). HTTP nodes can make arbitrary requests — consider network-level controls for production.

---

## 10. API Endpoints

### POST /v1/workflow — Create Workflow

**Request:** `{ name, description?, nodes, variables? }` → **201** with `WorkflowDefinition`

### GET /v1/workflow — List Workflows

Returns array of `{ id, name, updatedAt }`.

### POST /v1/workflow/validate — Validate (Dry-Run)

**Request:** `{ nodes }` → **200** with `{ valid, issues }`

### POST /v1/workflow/:id/run — Execute

**Request:** `{ variables?, triggeredBy? }` → **202** with `{ runId, state, storeLocation }`

### GET /v1/workflow/run/:id — Get Run

Returns full `WorkflowRun` with per-node states, outputs, and timing.

### GET /v1/workflow/runs?workflowId= — List Runs

Optional `workflowId` filter. Returns array of `{ runId, workflowId, state, startedAt }`.

---

## 11. Type Reference

### WorkflowNodeConfig

```typescript
{
  agentId?: string; prompt?: string;
  proposal?: { title: string; description: string; priority: "low"|"normal"|"high"|"critical"; context?: string };
  endpointId?: string; tool?: string; args?: Record<string, unknown>;
  expression?: string; branches?: number;  // default: 2
  iterSource?: string; maxIterations?: number;  // default: 10
  method?: "GET"|"POST"|"PUT"|"DELETE"|"PATCH";  // default: "GET"
  url?: string; headers?: Record<string, string>; body?: unknown;
  code?: string; language?: string;  // default: "javascript"
  subWorkflowId?: string; passThrough?: Record<string, unknown>;
  graphifyEntity?: string; graphifyPredicate?: string;
  graphifyLimit?: number;  // default: 10
  graphifyAction?: "query"|"add";  // default: "query"
}
```

### WorkflowNode

```typescript
{
  id: string; type: WorkflowNodeType; name: string;
  config: WorkflowNodeConfig; dependsOn: string[];  // default: []
  timeoutMs: number;  // default: 30000
  retryOn: Array<"timeout"|"error">;  // default: ["error"]
  maxRetries: number;  // default: 0
}
```

### WorkflowDefinition

```typescript
{
  id: string; name: string; description: string; version: string;  // "1.0.0"
  nodes: WorkflowNode[]; variables: Record<string, unknown>;
  createdAt: Date; updatedAt: Date;
}
```

### WorkflowRun

```typescript
{
  runId: string; workflowId: string; workflowName: string;
  state: WorkflowState; startedAt: Date; completedAt?: Date;
  nodes: NodeRunState[]; variables: Record<string, unknown>;
  error?: string; triggeredBy: string;  // default: "api"
}
```

### NodeRunState

```typescript
{
  nodeId: string; state: NodeState; startedAt?: Date; completedAt?: Date;
  attempts: number; output?: unknown; error?: string; durationMs: number;
}
```

---

## 12. Testing

Tests in `packages/core/src/__tests__/workflow.test.ts` (569 lines) — **43 tests, 0 skipped**.

| Block | Tests | Coverage |
|-------|-------|----------|
| Types & Validation | 10 | Schema validation, duplicate IDs, unknown deps, cycles, missing configs |
| Engine | 19 | Create, execute, DAG ordering, skip cascade, condition/code/agent/plugin/council/loop/parallel nodes, retry |
| Persistence | 8 | Disk storage, listing, removal, store directory |
| sub_workflow node | 3 | Validation, execution, child run summary |
| graphify node | 3 | Validation, execution, triple queries |

**Test patterns:** Executor mocking via `setNodeExecutor()`/`resetNodeExecutor()`. Temp directory isolation via `__setStoreDir()`. `TALOS_WORKFLOW_CODE_ENABLED=true` set in `beforeEach`.

---

## 13. Source Files

| File | Lines | Purpose |
|------|-------|---------|
| `packages/core/src/workflow/types.ts` | 145 | Zod schemas and TypeScript types |
| `packages/core/src/workflow/engine.ts` | 558 | DAG execution, node executors, retry, CRUD |
| `packages/core/src/workflow/persistence.ts` | 240 | Dual-mode persistence (JSON / Supabase) |
| `packages/core/src/workflow/_test_hooks.ts` | 1 | Test-only `__setStoreDir` export |
| `packages/core/src/workflow/index.ts` | 43 | Barrel re-exports |
| `packages/core/src/__tests__/workflow.test.ts` | 569 | 43 tests |
| `packages/core/src/api/server.ts` | 371 | HTTP API endpoints |
| `packages/db/src/workflows.ts` | 278 | Supabase CRUD |
| `supabase/migrations/0003_workflows.sql` | 93 | Database schema + RLS |

### Dependency Graph

```
workflow/types.ts (no deps)
       ↑
workflow/engine.ts (→ types, persistence, ai-engine/router, plugin/mcp, council/session, graphify/store)
       ↑
workflow/persistence.ts (→ types, @talos/db [dynamic import])
       ↑
workflow/index.ts (barrel)
       ↑
api/server.ts (→ workflow/index)
```

### Design Decisions

| ADR | Decision | Rationale |
|-----|----------|-----------|
| ADR-012 | `code`/`condition` gated behind `TALOS_WORKFLOW_CODE_ENABLED` | Prevents RCE via unauthenticated workflow creation |
| ADR-018 | Dual-mode persistence (JSON default, Supabase opt-in) | Keeps 40+ tests passing without Supabase |
| ADR-019 | `@talos/db` defines structural types locally | Avoids `@talos/db` depending on `@talos/core` |
| ADR-015 | `parallel`/`loop` kept as non-blueprint extensions | Strict blueprint match would break existing tests |
| ADR-011 | `__setStoreDir` in `_test_hooks.ts` (underscore prefix) | Convention for test-only exports |
| ADR-013 | `z.input<typeof Schema>` for function params | Accepts partial data; `z.infer<>` returns post-default type |
