# Mission Control UI System

> **Purpose:** Next.js 15 dashboard for monitoring and controlling Talos OS. Load this to understand the UI architecture, components, and data flow.

## 1. Tech Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| Next.js | 15 | React framework with App Router |
| React | 19 | UI library |
| ReactFlow | 11 | Workflow canvas (drag-and-drop DAG editor) |
| Tailwind CSS | 3 | Utility-first styling |
| TypeScript | strict | Type safety |

**Build output:** 54.6 kB (first load JS: 102 kB shared)

## 2. Package Structure

```
packages/ui/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout (html, body, globals)
│   │   ├── page.tsx            # Main page (view router)
│   │   └── globals.css         # Global styles + Linear tokens
│   ├── components/
│   │   ├── Header.tsx          # Top bar with view tabs
│   │   ├── Sidebar.tsx         # Left nav with view list
│   │   ├── StatusBar.tsx       # Bottom bar with system info
│   │   ├── AgentGrid.tsx       # Agent guild grid view
│   │   ├── TaskFlowChart.tsx   # Task flow visualization
│   │   └── WorkflowCanvas.tsx  # ReactFlow workflow editor
│   └── ...
├── tailwind.config.js          # Tailwind + Linear tokens
├── next.config.js              # Next.js config
└── package.json                # @talos/ui dependencies
```

## 3. Views

The app uses a simple view router via React state. Views:

| View | Component | Purpose |
|------|-----------|---------|
| `dashboard` | AgentGrid + TaskFlowChart | Mission Control overview |
| `agents` | AgentGrid (detailed) | Agent management, guild view |
| `tasks` | TaskFlowChart | Task queue visualization |
| `workflows` | WorkflowCanvas | ReactFlow workflow editor |
| `memory` | Placeholder | User Cortex & Nornir (future) |
| `blueprint` | Placeholder | Living Blueprint (future) |

## 4. Component Architecture

### Header
- Top bar with view tabs
- Shows current view name
- Linear-themed styling

### Sidebar
- Left navigation with view list
- Click to switch views
- Active view highlighting
- Workflow list (loads from API)

### StatusBar
- Bottom bar with system info
- Shows connected API server
- Provider status indicators

### AgentGrid
- Displays 13 agents across 5 guilds
- Guild-based grouping (Crown, Forge, Foundry, Sanctum, Vault)
- Live load simulation (random load values)
- Color-coded by guild

### TaskFlowChart
- Task visualization (placeholder for future ReactFlow integration)

### WorkflowCanvas
- Full ReactFlow canvas with 10 node types
- Palette, canvas, config editor
- Save/Run buttons
- State colors for run progress

## 5. Data Flow

```
┌─────────────┐     HTTP      ┌─────────────┐
│  Mission    │ ────────────▶ │  API Server  │
│  Control    │ ◀──────────── │  (port 8642) │
│  (Next.js)  │               └─────────────┘
└─────────────┘                     │
                                    ▼
                              ┌─────────────┐
                              │  Supabase   │
                              │  (Postgres) │
                              └─────────────┘
```

**API integration:**
- `fetch('http://localhost:8642/v1/agents/external')` — List agents
- `fetch('http://localhost:8642/v1/workflow')` — List workflows
- `POST http://localhost:8642/v1/workflow` — Create workflow
- `POST http://localhost:8642/v1/workflow/:id/run` — Execute workflow
- `GET http://localhost:8642/v1/workflow/run/:id` — Poll run status

## 6. WorkflowCanvas Deep Dive

### 10 Node Types in Palette

| Type | Label | Color | Default Config |
|------|-------|-------|----------------|
| `agent` | Agent | #b87333 | `{ agentId: "odin", prompt: "" }` |
| `council` | Council | #cd7f32 | `{ proposal: { title: "Decide", description: "", priority: "normal" } }` |
| `plugin` | Plugin | #a78bfa | `{ tool: "", args: {} }` |
| `http` | HTTP | #00e5ff | `{ url: "https://example.com", method: "GET" }` |
| `code` | Code | #10b981 | `{ code: "return variables;" }` |
| `condition` | Condition | #facc15 | `{ expression: "true" }` |
| `parallel` | Parallel | #f472b6 | `{ branches: 2 }` |
| `loop` | Loop | #fb923c | `{ iterSource: "", maxIterations: 10 }` |
| `sub_workflow` | Sub-Workflow | #38bdf8 | `{ subWorkflowId: "", passThrough: {} }` |
| `graphify` | Graphify | #4ade80 | `{ graphifyAction: "query", entity: "", predicate: "", limit: 10 }` |

### Canvas Features
- **Drag & drop** nodes from palette to canvas
- **Connect** nodes by dragging from output to input handle
- **Minimap** for navigation
- **Controls** for zoom, fit view
- **Background** grid with dots

### Node Config Editor
- Right panel shows selected node's config
- JSON textarea for editing
- Changes applied on valid parse

### Save Flow
1. User clicks "Save"
2. `buildSavePayload()` converts ReactFlow nodes/edges to workflow format
3. `POST /v1/workflow` creates workflow
4. Workflow ID stored in state

### Run Flow
1. User clicks "Run"
2. If not saved, save first
3. `POST /v1/workflow/:id/run` executes workflow
4. Poll `GET /v1/workflow/run/:id` every 1 second
5. Node borders colored by state:
   - pending: gray (#666)
   - running: yellow (#facc15)
   - completed: green (#10b981)
   - failed: red (#ef4444)
   - skipped: blue (#3b82f6)

### Read-Only Mode
- Used for viewing workflow runs
- Palette hidden
- Config editor hidden
- Nodes not draggable or connectable

## 7. Styling

### Linear Tokens (Primary)
- Backgrounds: `bg-linear-bg`, `bg-linear-bg-secondary`
- Borders: `border-linear-border`
- Text: `text-linear-text`, `text-linear-text-secondary`
- Accent: `text-linear-accent`
- Status: `text-linear-status-success`, `text-linear-status-warning`, `text-linear-status-danger`

### Legacy Bronze-Punk (Kept)
- Backgrounds: `bg-gunmetal-500`
- Buttons: `.btn-primary`, `.btn-secondary`, `.btn-bronze`, `.btn-cyan`
- Panels: `.panel`
- Borders: `.accent-border`

### Component Classes (globals.css)
- `.panel` — Dark card with border
- `.btn-primary` — Cyan accent button
- `.btn-secondary` — Muted button
- `.btn-bronze` — Bronze accent button
- `.btn-cyan` — Legacy cyan button
- `.accent-border` — Bronze accent border

## 8. Development

```bash
# Start dev server
pnpm --filter @talos/ui dev

# Build for production
pnpm --filter @talos/ui build

# The UI connects to API server at http://localhost:8642
```

## 9. Future Views

| View | Status | Planned Features |
|------|--------|-----------------|
| Memory | Placeholder | Cortex visualization, Thread of Fate, Nornir markers |
| Blueprint | Placeholder | Living Blueprint diff, plan visualization, rollback |
| Settings | Not started | Agent config, budget settings, provider management |

## 10. Known Limitations

- No authentication (local-only)
- No real-time updates (polling only)
- Memory and Blueprint views are placeholders
- WorkflowCanvas doesn't support node deletion via keyboard
- No undo/redo in canvas
