# Workflow Canvas — Talos OS v8.0

ReactFlow-based drag-and-drop workflow authoring interface for the Mission Control UI.

## 1. Purpose

The Workflow Canvas provides a visual interface for creating, editing, and running workflows
in the Talos OS workflow engine. Users drag nodes from a palette, connect them with edges,
configure each node, and execute the workflow — all without writing JSON.

The canvas is implemented in `packages/ui/src/components/WorkflowCanvas.tsx` using
ReactFlow 11 (`reactflow` package).

---

## 2. Architecture

```
WorkflowCanvas.tsx
├── Palette sidebar (left)
│   └── NODE_TYPES[] — 10 node types with labels, colors, default configs
├── ReactFlow canvas (center)
│   ├── Background — dot grid, color #333, gap 16px
│   ├── Controls — zoom, fit, lock
│   └── MiniMap — colored by node type, dark background
├── Config editor sidebar (right)
│   └── NodeConfigForm — JSON textarea for editing node config
└── Save/Run controls
    ├── buildSavePayload() → POST /v1/workflow
    └── onRun() → POST /v1/workflow/:id/run
```

---

## 3. 10 Node Types in Palette

Each node type has a label, color, and default config:

| Type | Label | Color | Default Config |
|------|-------|-------|----------------|
| `agent` | Agent | `#b87333` | `{ agentId: "odin", prompt: "" }` |
| `council` | Council | `#cd7f32` | `{ proposal: { title: "Decide", description: "", priority: "normal" } }` |
| `plugin` | Plugin | `#a78bfa` | `{ tool: "", args: {} }` |
| `http` | HTTP | `#00e5ff` | `{ url: "https://example.com", method: "GET" }` |
| `code` | Code | `#10b981` | `{ code: "return variables;" }` |
| `condition` | Condition | `#facc15` | `{ expression: "true" }` |
| `parallel` | Parallel | `#f472b6` | `{ branches: 2 }` |
| `loop` | Loop | `#fb923c` | `{ iterSource: "", maxIterations: 10 }` |
| `sub_workflow` | Sub-Workflow | `#38bdf8` | `{ subWorkflowId: "", passThrough: {} }` |
| `graphify` | Graphify | `#4ade80` | `{ graphifyAction: "query", entity: "", predicate: "", limit: 10 }` |

### 3.1 Node Type Details

#### Agent (`#b87333`)
Routes a prompt through the AI engine. Requires `config.agentId` (e.g., `"odin"`, `"mimir"`).
The agent is selected by ID and the prompt is sent via `routeUnlimited()`.

#### Council (`#cd7f32`)
Creates a council session with 5 parallel advisors + Chairman.
Requires `config.proposal` with `title`, `description`, and optional `priority`.

#### Plugin (`#a78bfa`)
Executes a registered MCP tool. Requires `config.endpointId` and `config.tool`.
Arguments are passed as `config.args` (object).

#### HTTP (`#00e5ff`)
Makes an HTTP request to a URL. Supports GET, POST, PUT, DELETE, PATCH.
Config includes `url`, `method`, `headers`, and `body`.

#### Code (`#10b981`)
Executes arbitrary JavaScript code. **Disabled by default** — gated behind `TALOS_WORKFLOW_CODE_ENABLED=true` (ADR-012).
Code receives `variables` as its argument.

#### Condition (`#facc15`)
Evaluates a boolean expression. **Disabled by default** — same gate as Code (ADR-012).
Returns `{ branch: 0|1, evaluated: boolean }`. Branch 0 = false, Branch 1 = true.

#### Parallel (`#f472b6`)
Fans out into N branches. Non-blueprint extension (ADR-015).
Config includes `branches` (default: 2).

#### Loop (`#fb923c`)
Iterates over an array from workflow variables. Non-blueprint extension (ADR-015).
Config includes `iterSource` (variable name) and `maxIterations` (default: 10).

#### Sub-Workflow (`#38bdf8`)
Executes another workflow by ID. Requires `config.subWorkflowId`.
Passes variables via `config.passThrough`. Returns child run state.

#### Graphify (`#4ade80`)
Queries or adds triples to the knowledge graph.
Config includes `graphifyAction` (`"query"` or `"add"`), `graphifyEntity`, `graphifyPredicate`, `graphifyLimit`.

---

## 4. Canvas Features

### 4.1 Drag and Drop

Nodes are added to the canvas by clicking a palette entry. Each click creates a new node
at position `{ x: 100 + offset, y: 100 + offset }` where `offset = nodes.length * 30`.

Node IDs are generated as `{type}-{timestamp}-{counter}`.

### 4.2 Edge Connection

Users connect nodes by dragging from a source handle to a target handle.
Edges are styled with:
- **Stroke:** `#b87333` (bronze color)
- **Stroke width:** 1px
- **Marker:** ArrowClosed, color `#b87333`
- **Animated:** `false`

Edges define dependency order. The engine executes nodes in topological order
based on edge directions.

### 4.3 Background

- Dot grid pattern
- Color: `#333`
- Gap: 16px

### 4.4 Controls

Standard ReactFlow controls:
- Zoom in/out
- Fit view
- Lock/unlock

### 4.5 MiniMap

- Node color: derived from node type's palette color
- Mask color: `rgba(0,0,0,0.6)`
- Background: `#1a1a1a`

### 4.6 Fit View

Canvas automatically fits all nodes into the viewport on load.

---

## 5. Node Config Editor

The right sidebar shows a config editor when a node is selected.

### 5.1 NodeConfigForm

The form displays:
- **Type** — read-only, shows node type
- **Label** — read-only (edit via canvas drag)
- **Config (JSON)** — editable textarea, 12 rows

The JSON textarea parses on every keystroke. Invalid JSON is silently ignored
(keeps the last valid config). On valid parse, the config is applied immediately.

### 5.2 Config Schema

Each node type has a different config schema. The config is stored as
`Record<string, unknown>` in `node.data.config`.

Common config fields:

| Field | Type | Used By |
|-------|------|---------|
| `agentId` | string | Agent |
| `prompt` | string | Agent |
| `proposal` | object | Council |
| `endpointId` | string | Plugin |
| `tool` | string | Plugin |
| `args` | object | Plugin |
| `url` | string | HTTP |
| `method` | string | HTTP |
| `headers` | object | HTTP |
| `body` | unknown | HTTP |
| `code` | string | Code |
| `expression` | string | Condition |
| `branches` | number | Parallel |
| `iterSource` | string | Loop |
| `maxIterations` | number | Loop |
| `subWorkflowId` | string | Sub-Workflow |
| `passThrough` | object | Sub-Workflow |
| `graphifyAction` | string | Graphify |
| `graphifyEntity` | string | Graphify |
| `graphifyPredicate` | string | Graphify |
| `graphifyLimit` | number | Graphify |

---

## 6. Save Flow

### 6.1 `buildSavePayload()`

Converts ReactFlow state to a workflow definition:

```typescript
function buildSavePayload(name, nodes, edges) {
  // 1. Build dependency map from edges
  const depMap = new Map<string, string[]>();
  for (const edge of edges) {
    depMap.get(edge.target).push(edge.source);
  }

  // 2. Map nodes to workflow format
  return {
    name,
    description: "",
    variables: {},
    nodes: nodes.map(n => ({
      id: n.id,
      type: n.data.type,
      name: n.data.label,
      config: n.data.config,
      dependsOn: depMap.get(n.id) ?? [],
    })),
  };
}
```

### 6.2 Save Button

- Calls `onSave(name, nodes, edges)` prop
- Returns a workflow ID that is stored in state
- Shows "Saving..." while in progress
- Displays error if save fails

### 6.3 API Call

```
POST /v1/workflow
Content-Type: application/json

{
  "name": "My Workflow",
  "description": "",
  "variables": {},
  "nodes": [
    {
      "id": "agent-1717000000-1",
      "type": "agent",
      "name": "Agent",
      "config": { "agentId": "odin", "prompt": "Hello" },
      "dependsOn": []
    }
  ]
}
```

---

## 7. Run Flow

### 7.1 Run Button

The run flow:
1. If no workflow ID exists, save first
2. Call `onRun(workflowId)` prop
3. Show "Running..." while in progress

### 7.2 Parent Component Integration

The parent component (page) handles the actual API calls:

```typescript
// Save
const response = await fetch("/api/v1/workflow", {
  method: "POST",
  body: JSON.stringify(buildSavePayload(name, nodes, edges)),
});
const { id } = await response.json();

// Run
await fetch(`/api/v1/workflow/${id}/run`, { method: "POST" });

// Poll for status
const poll = setInterval(async () => {
  const res = await fetch(`/api/v1/workflow/run/${runId}`);
  const run = await res.json();
  if (run.state === "completed" || run.state === "failed") {
    clearInterval(poll);
  }
}, 1000);
```

---

## 8. State Colors

Node border colors reflect execution state during a run:

| State | Color | Hex | Meaning |
|-------|-------|-----|---------|
| `pending` | Gray | `#666` | Not yet started |
| `running` | Yellow | `#facc15` | Currently executing |
| `completed` | Green | `#10b981` | Finished successfully |
| `failed` | Red | `#ef4444` | Execution error |
| `skipped` | Blue | `#3b82f6` | Skipped due to upstream failure |

### 8.1 State Color Application

```typescript
const STATE_COLORS = {
  pending: "#666",
  running: "#facc15",
  completed: "#10b981",
  failed: "#ef4444",
  skipped: "#3b82f6",
};

function nodeStyle(type, state?) {
  const paletteEntry = palette.find(p => p.type === type);
  const borderColor = state
    ? STATE_COLORS[state] ?? paletteEntry.color
    : paletteEntry.color;
  return {
    background: "#1a1a1a",
    border: `2px solid ${borderColor}`,
    borderRadius: "2px",
    padding: "8px 12px",
    fontSize: "11px",
    fontFamily: "monospace",
    color: "#e8e8e8",
    width: 180,
  };
}
```

---

## 9. Edge Styling

Edges use bronze color with arrow markers:

```typescript
{
  animated: false,
  style: { stroke: "#b87333", strokeWidth: 1 },
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: "#b87333",
  },
}
```

Edge direction defines dependency order:
- Source → Target means "Target depends on Source"
- The engine executes Source before Target
- Topological sort determines execution order

---

## 10. Read-Only Mode

The canvas supports a read-only mode for viewing workflow runs.

### 10.1 Props

```typescript
interface WorkflowCanvasProps {
  readOnly?: boolean;       // Default: false
  runStates?: Record<string, string>;  // nodeId → state mapping
  onSave: ...;  // Called but UI is hidden
  onRun?: ...;   // Called but UI is hidden
}
```

### 10.2 Read-Only Behavior

- Palette sidebar is hidden
- Config editor sidebar is hidden
- Nodes are not draggable
- Nodes are not connectable
- Elements are not selectable
- `runStates` prop colors nodes by execution state
- Save/Run buttons are hidden

### 10.3 Usage

```tsx
<WorkflowCanvas
  readOnly
  initialNodes={workflowNodes}
  runStates={{
    "agent-1": "completed",
    "council-2": "running",
    "http-3": "pending",
  }}
  onSave={async () => {}}
/>
```

---

## 11. Integration with Workflow Engine

### 11.1 Data Flow

```
Canvas → buildSavePayload() → POST /v1/workflow → engine.createWorkflow()
Canvas → onRun() → POST /v1/workflow/:id/run → engine.executeWorkflow()
Poll → GET /v1/workflow/run/:id → engine.getRun()
```

### 11.2 Engine Execution

The workflow engine (`packages/core/src/workflow/engine.ts`):

1. Validates the workflow (schema + semantic checks)
2. Creates a `WorkflowRun` with per-node state
3. Topologically sorts nodes
4. Executes each node in order with retry support
5. Skips downstream nodes on failure
6. Persists state to JSON files or Supabase (dual-mode, ADR-018)

### 11.3 Node Executors

Each node type has a dedicated executor function:

| Node Type | Executor | Backend |
|-----------|----------|---------|
| `agent` | `executeAgentNode` | `routeUnlimited()` → AI engine |
| `council` | `executeCouncilNode` | `createSession()` + `executeSession()` |
| `plugin` | `executePluginNode` | `executeTool()` → MCP |
| `http` | `executeHttpNode` | `fetch()` |
| `code` | `executeCodeNode` | `new Function()` (gated) |
| `condition` | `executeConditionNode` | `new Function()` (gated) |
| `parallel` | `executeParallelNode` | Fan-out metadata |
| `loop` | `executeLoopNode` | Array iteration metadata |
| `sub_workflow` | `executeSubWorkflowNode` | Recursive `executeWorkflow()` |
| `graphify` | `executeGraphifyNode` | `queryTriples()` / `addTriple()` |

### 11.4 Security Gates

- `code` and `condition` nodes are gated behind `TALOS_WORKFLOW_CODE_ENABLED=true` (ADR-012)
- Default is OFF to prevent RCE via unauthenticated `POST /v1/workflow`
- When disabled, these nodes throw: `"code node is disabled: set TALOS_WORKFLOW_CODE_ENABLED=true to enable arbitrary JS evaluation"`

---

## 12. Validation

The engine validates workflows before creation and execution:

### 12.1 Schema Validation

Each node is validated against `WorkflowNodeSchema` (Zod). Required fields per type:
- `agent`: `config.agentId`
- `council`: `config.proposal` with `title` and `description`
- `plugin`: `config.endpointId` and `config.tool`
- `http`: `config.url`
- `sub_workflow`: `config.subWorkflowId`
- `graphify`: `config.graphifyEntity` or `config.graphifyPredicate`

### 12.2 Semantic Validation

- No empty workflows
- No duplicate node IDs
- No unknown dependencies
- No cycles (Kahn's algorithm)

### 12.3 Validation Result

```typescript
interface WorkflowValidationResult {
  valid: boolean;
  issues: Array<{
    code: "duplicate_node_id" | "unknown_dependency" | "cycle"
         | "missing_required_config" | "empty_workflow";
    message: string;
    nodeIds: string[];
  }>;
}
```

---

## 13. Styling

### 13.1 Node Style

```typescript
{
  background: "#1a1a1a",
  border: `2px solid ${borderColor}`,
  borderRadius: "2px",
  padding: "8px 12px",
  fontSize: "11px",
  fontFamily: "monospace",
  color: "#e8e8e8",
  width: 180,
}
```

### 13.2 Palette Button Style

```tsx
<button className="w-full text-left px-2 py-1.5 font-mono text-xs text-gray-300
  hover:bg-bronze-400/10 border-l-2 border-transparent hover:border-bronze-400
  transition-all">
  <span className="inline-block w-2 h-2 rounded-full mr-2"
    style={{ background: p.color }} />
  {p.label}
</button>
```

### 13.3 Config Editor Style

```tsx
<textarea className="w-full bg-gunmetal-500 border border-bronze-400/30
  px-2 py-1 text-gray-200 font-mono text-[11px]" />
```

---

## 14. Future Enhancements

| Enhancement | Status | Notes |
|-------------|--------|-------|
| Drag from palette to canvas | Planned | Currently click-to-add |
| Node grouping | Planned | Group related nodes |
| Undo/redo | Planned | History stack |
| Node templates | Planned | Save/load node configs |
| Execution logs panel | Planned | Real-time node output |
| Conditional edge styling | Planned | Color edges by branch result |
