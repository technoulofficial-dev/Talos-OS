# Talos OS — System Overview

> **Purpose:** High-level architecture overview. Load this to understand how all pieces fit together before diving into specific system docs.

## 1. What Talos OS Is

Talos OS is a self-hosted AI operating system. It provides:

1. **Free AI routing** — routes requests through 11+ free models via OpenRouter, Ollama local, and LAN peers
2. **Multi-agent orchestration** — 13 specialized agents with guild-based permissions
3. **Infinite memory** — 3-layer compression system (verbatim → mid-range → distant)
4. **Workflow automation** — DAG-based executor with 10 node types
5. **Knowledge graph** — triple store for cross-session knowledge persistence
6. **Mission Control** — Next.js dashboard for monitoring and control

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Mission Control (UI)                   │
│                  Next.js 15 + React 19 + ReactFlow       │
│  Dashboard │ Agents │ Tasks │ Workflows │ Memory │ BP    │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP (port 8642)
┌──────────────────────▼──────────────────────────────────┐
│                     API Server                            │
│               REST endpoints (30+)                        │
│  /health │ /v1/route │ /v1/agents │ /v1/workflow │ ...  │
└──┬───────┬───────┬───────┬───────┬───────┬───────┬──────┘
   │       │       │       │       │       │       │
┌──▼──┐ ┌──▼──┐ ┌──▼──┐ ┌──▼──┐ ┌──▼──┐ ┌──▼──┐ ┌──▼──┐
│ AI  │ │Coun-│ │Work-│ │Plug-│ │Gra- │ │Bud- │ │Ritu-│
│Engi-│ │cil  │ │flow │ │ins  │ │phify│ │get  │ │als  │
│ne   │ │     │ │Eng. │ │     │ │     │ │     │ │     │
└──┬──┘ └─────┘ └──┬──┘ └──┬──┘ └──┬──┘ └──┬──┘ └─────┘
   │               │       │       │       │
┌──▼───────────────▼───────▼───────▼───────▼──────────────┐
│                    @talos/core                            │
│  TypeScript engine — all business logic lives here       │
└──┬──────────────────────────────────────────────────────┘
   │
┌──▼──────────────────────────────────────────────────────┐
│                    @talos/db                              │
│  Supabase DB layer — agents, tasks, memory, workflows   │
└──┬──────────────────────────────────────────────────────┘
   │
┌──▼──────────────────────────────────────────────────────┐
│               Supabase (PostgreSQL)                      │
│  Docker: localhost:5432 (pooler) / 54322 (direct)       │
│  14 tables + RLS + pgvector for embeddings               │
└─────────────────────────────────────────────────────────┘
```

## 3. Request Flow

A typical AI request flows through:

```
User → Mission Control → API Server → AI Engine → Budget Gate → Provider
                                    ↕
                              Council (if approval needed)
                                    ↕
                              Graphify (knowledge retrieval)
                                    ↕
                              Memory (context injection)
```

**Detailed flow:**
1. User sends request via Mission Control or API
2. API server validates request and checks budget
3. AI Engine runs `routeUnlimited()` waterfall
4. Budget gate checks monthly/hourly/per-task limits
5. Provider selected (Ollama → LAN → Owl Alpha → Cloud → NVIDIA)
6. Response returned with token usage logged to budget ledger
7. If council needed, 5 advisors evaluate in parallel
8. Graphify stores relevant knowledge triples
9. Memory updates Thread of Fate with new interaction

## 4. Package Responsibilities

### @talos/core (TypeScript engine)
All business logic. No framework dependencies. Pure TypeScript with Zod validation.

**Modules:**
- `ai-engine/` — Provider routing and failover
- `council/` — Multi-advisor evaluation
- `workflow/` — DAG executor
- `plugin/` — MCP/ACP lifecycle
- `graphify/` — Knowledge graph
- `budget/` — Cost control
- `rituals/` — Session management
- `blueprint/` — System reconfiguration
- `phoenix/` — Self-improvement
- `sandbox/` — Code execution
- `identity/` — User identity
- `config/` — Configuration loading
- `api/` — HTTP server

### @talos/db (Supabase layer)
Database operations. Optional client injection pattern for testing.

**Modules:**
- `agents.ts` — Agent registry
- `tasks.ts` — Task queue
- `auctions.ts` — Loom auction system
- `memory.ts` — Cortex + Nornir persistence
- `plugins.ts` — Plugin registry
- `skills.ts` — Runtime skill registry
- `workflows.ts` — Workflow persistence

### @talos/memory (Infinite memory)
Cortex (user identity core) + Nornir (three fates of memory).

**Modules:**
- `cortex.ts` — 3-layer Thread of Fate with compression
- `nornir.ts` — Nightly consolidation (Urd, Verdandi, Skuld)

### @talos/ui (Mission Control)
Next.js 15 dashboard. React 19 + ReactFlow 11 + Tailwind 3.

**Views:**
- Dashboard — Mission Control overview
- Agents — Agent grid with load simulation
- Tasks — Task queue visualization
- Workflows — ReactFlow canvas (10 node types)
- Memory — User Cortex & Nornir
- Blueprint — Living Blueprint

### @talos/agents (13 internal agents)
Each agent has `config.ts` (role, model, system prompt) and `index.ts` (task config).

See `agents.md` for full agent specs.

## 5. Data Flow Diagrams

### AI Request Flow
```
┌─────────┐    ┌─────────┐    ┌──────────┐    ┌─────────┐
│  User    │───▶│  API    │───▶│AI Engine │───▶│Provider │
│          │    │ Server  │    │ Router   │    │(Ollama/ │
└─────────┘    └─────────┘    └──────────┘    │OpenRouter│
                     │              │          └─────────┘
                     ▼              ▼
                ┌─────────┐   ┌──────────┐
                │ Budget  │   │ Council  │
                │  Gate   │   │(5 advis.)│
                └─────────┘   └──────────┘
```

### Workflow Execution Flow
```
┌──────────┐    ┌──────────┐    ┌──────────┐
│ Workflow │───▶│ Topo     │───▶│ Execute  │
│ Def JSON │    │ Sort     │    │ Nodes    │
└──────────┘    └──────────┘    └──────────┘
                                      │
                     ┌────────────────┼────────────────┐
                     ▼                ▼                ▼
                ┌─────────┐    ┌──────────┐    ┌──────────┐
                │ Agent   │    │  HTTP    │    │Graphify  │
                │ Node    │    │  Node    │    │  Node    │
                └─────────┘    └──────────┘    └──────────┘
```

### Memory Compression Flow
```
┌──────────────────────────────────────────────────┐
│                Thread of Fate                     │
│                                                   │
│  Recent (50 turns) ──▶ Mid-range (8×20) ──▶ Distant │
│   verbatim text        compressed          markers │
│                                                   │
│  Token budget: 12,000 max                        │
└──────────────────────────────────────────────────┘
```

## 6. Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Language | TypeScript | strict mode |
| Runtime | Node.js | v20+ |
| Package manager | pnpm | v9.15.0 |
| Build | turbo | v2.x |
| Test | vitest | latest |
| UI framework | Next.js | 15 |
| UI library | React | 19 |
| Canvas | ReactFlow | 11 |
| Styling | Tailwind CSS | 3 |
| Validation | Zod | v3.24.x |
| Database | Supabase (PostgreSQL) | local Docker |
| AI providers | OpenRouter, Ollama, NVIDIA NIM | — |
| Container | Docker | multi-stage |
| Agent runtime | opencode | custom tools + skills |

## 7. Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `TALOS_PORT` | 8642 | API server port |
| `TALOS_HOST` | 0.0.0.0 | API server host |
| `TALOS_WORKSPACE_ROOT` | process.cwd() | Project root |
| `TALOS_GRAPHIFY_PATH` | .talos/graphify.json | Knowledge graph file |
| `TALOS_VAULT_PATH` | .talos-notes | Obsidian vault path |
| `TALOS_WORKFLOW_DIR` | .talos/workflows | Workflow JSON directory |
| `TALOS_WORKFLOW_DB_ENABLED` | false | Supabase workflow persistence |
| `TALOS_WORKFLOW_CODE_ENABLED` | false | Allow code/condition nodes |
| `TALOS_OWL_ALPHA_ENABLED` | true | Owl Alpha provider (opt-OUT) |
| `OPENROUTER_API_KEY` | — | OpenRouter API key |
| `OLLAMA_HOST` | http://127.0.0.1:11434 | Ollama endpoint |
| `NVIDIA_API_KEY` | — | NVIDIA NIM key |
| `SUPABASE_URL` | — | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | — | Supabase service role key |
| `GITHUB_TOKEN` | — | GitHub API token |
| `TWENTYFIRST_API_KEY` | — | 21st.dev Magic MCP |
| `OD_DAEMON_URL` | http://localhost:7456 | open-design daemon |

## 8. Key Design Decisions

See `docs/decisions/adr-log.md` for full ADR log.

**Most impactful decisions:**
1. **Free AI first** — $0/M tokens via provider waterfall (ADR-026)
2. **Code nodes gated** — `TALOS_WORKFLOW_CODE_ENABLED` prevents RCE (ADR-012)
3. **Dual-mode persistence** — JSON default keeps tests passing (ADR-018)
4. **Optional client pattern** — `@talos/db` modules accept optional client for testing
5. **Test hooks in `_test_hooks.ts`** — never re-exported from production (ADR-011)

## 9. Getting Started

**Quick start:**
```bash
# 1. Install dependencies
pnpm install

# 2. Start local Supabase + Ollama
docker compose up -d

# 3. Build all packages
pnpm build

# 4. Run tests
pnpm test

# 5. Start API server
node packages/core/dist/api/server.js

# 6. Open Mission Control
pnpm --filter @talos/ui dev
```

**Install scripts:**
- Windows: `scripts/install-windows.ps1`
- Ubuntu: `scripts/install-ubuntu.sh`

See `docs/runbooks/local-setup.md` for full setup guide.

## 10. Documentation Index

| Document | Purpose |
|----------|---------|
| `blueprint.md` | Master blueprint (this system) |
| `overview.md` | System overview (this file) |
| `agents.md` | Agent guild system + all 13 agents |
| `ai-engine.md` | Router, G0DM0D3, provider waterfall |
| `council.md` | Multi-advisor evaluation system |
| `workflow-engine.md` | DAG executor, 10 node types |
| `plugin-system.md` | MCP, ACP, lifecycle, registry |
| `graphify.md` | Knowledge graph triple store |
| `memory.md` | Cortex + Nornir (infinite memory) |
| `budget.md` | Budget gate, tokens, rate limiting |
| `identity.md` | User identity, persistence |
| `rituals.md` | Session start/end rituals |
| `blueprint-system.md` | Living Blueprint reconfiguration |
| `phoenix.md` | Self-improvement dual-agent loop |
| `sandbox.md` | Docker-based code execution |
| `database.md` | Supabase schema, migrations, RLS |
| `rest-api.md` | All 30+ REST endpoints |
| `ui-system.md` | Mission Control UI architecture |
| `design-tokens.md` | Linear tokens, Tailwind config |
| `workflow-canvas.md` | ReactFlow canvas, 10 node types |
| `adr-log.md` | All Architecture Decision Records |
