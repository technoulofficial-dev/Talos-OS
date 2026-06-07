# Talos OS v8.0 — Master Blueprint

> **Purpose:** Single source of truth for the entire Talos OS architecture. Load this file when you need to understand the full system without reading individual component docs.

## 1. System Identity

**Talos OS** is a self-hosted, privacy-first AI operating system built on a pnpm monorepo. It routes AI requests through a free-tier provider waterfall, manages multi-agent workflows via a DAG engine, maintains infinite user memory through a three-layer compression system, and exposes everything through a single HTTP API server (port 8642) + a Next.js Mission Control dashboard.

**Core principles:**
- **Free AI first** — $0/M tokens via OpenRouter, Ollama local, and LAN peer devices
- **Local-first** — all data on your machine (Supabase local in Docker, JSON persistence)
- **Agent autonomy** — 13 internal agents with guild-based permissions
- **Self-improving** — Phoenix dual-agent loop optimizes system parameters

---

## 2. Package Architecture

```
@talos/core        — TypeScript engine (AI router, council, plugins, graphify, workflow, budget, rituals)
@talos/db          — Supabase DB layer (agents, tasks, auctions, memory, plugins, skills, workflows)
@talos/memory      — Cortex + Nornir (infinite memory with 3-layer compression)
@talos/ui          — Next.js 15 Mission Control (React 19, ReactFlow 11, Tailwind 3)
@talos/cli         — CLI tool (talos command)
@talos/agents      — 13 internal agent packages (Odin, Loom, Nornir, etc.)
```

**Dependency graph:**
```
@talos/ui → @talos/core → @talos/db
@talos/memory → @talos/core → @talos/db
@talos/agents → @talos/core
@talos/cli → @talos/core
```

**Build chain:** pnpm workspaces + turbo (v2.x tasks). `pnpm build` builds all 5 packages. `pnpm test` runs vitest for all packages.

---

## 3. Core Systems Map

| System | Location | Purpose | Docs |
|--------|----------|---------|------|
| AI Engine | `packages/core/src/ai-engine/` | Free AI provider routing with failover | `ai-engine.md` |
| G0DM0D3 | `packages/core/src/g0dm0d3/` | Local/Cloud AI network (11 free models) | `ai-engine.md` |
| Council | `packages/core/src/council/` | 5-advisor parallel evaluation | `council.md` |
| Workflow Engine | `packages/core/src/workflow/` | DAG executor with 10 node types | `workflow-engine.md` |
| Plugin System | `packages/core/src/plugin/` | MCP + ACP lifecycle | `plugin-system.md` |
| Graphify | `packages/core/src/graphify/` | Knowledge graph triple store | `graphify.md` |
| Memory | `packages/memory/src/` | Cortex (user core) + Nornir (3 fates) | `memory.md` |
| Budget | `packages/core/src/budget/` | Cloud API budget gate + rate limiting | `budget.md` |
| Blueprint | `packages/core/src/blueprint/` | Living Blueprint reconfiguration | `blueprint-system.md` |
| Phoenix | `packages/core/src/phoenix/` | Self-improvement dual-agent loop | `phoenix.md` |
| Sandbox | `packages/core/src/sandbox/` | Docker-based untrusted code execution | `sandbox.md` |
| Identity | `packages/core/src/identity/` | Persistent user identity | `identity.md` |
| Rituals | `packages/core/src/rituals/` | Session start/end rituals | `rituals.md` |
| Router | `packages/core/src/router/` | Cloud provider registry + health | `ai-engine.md` |
| Config | `packages/core/src/config/` | YAML + env config loader | `overview.md` |
| API Server | `packages/core/src/api/` | HTTP REST API (port 8642) | `rest-api.md` |
| Database | `packages/db/src/` | Supabase DB layer (14 tables) | `database.md` |

---

## 4. Agent Guild System

| Guild | Purpose | Agents |
|-------|---------|--------|
| **Crown** | Strategic orchestration | Odin (pinned), Loom (pinned), Mimir, Bragi |
| **Forge** | Code execution | Brokkr, OpenCode |
| **Foundry** | Infrastructure | Eitri, Harvester |
| **Sanctum** | Research & wisdom | Sage, Huginn |
| **Vault** | Memory & knowledge | Nornir (pinned), Muninn |
| *(null)* | System management | System (pinned) |

**Pinned agents** (4): Odin, Loom, Nornir, System — always active, cannot be deactivated.

**Agent resolution:** Loom auctions tasks → agents bid → Loom dispatches to winner → agent executes via AI Engine → Council evaluates if needed.

See `agents.md` for full agent specs, system prompts, and interaction patterns.

---

## 5. AI Provider Waterfall

The `routeUnlimited()` function in `ai-engine/router.ts` implements a priority-based failover:

```
1. Local Ollama (localhost:11434)          — $0, fastest
2. G0DM0D3 LAN peers (capability > 0.3)   — $0, local network
3. Owl Alpha via OpenRouter                — $0, 1M context, opt-OUT
4. G0DM0D3 cloud (Llama 3.1 8B)           — $0, OpenRouter free tier
5. Opt-in providers (keylessai, etc.)      — $0, unreliable
6. NVIDIA NIM cloud                        — PAID, last resort
```

**Budget gate** sits at every cloud API call. Hard kill at 95% of monthly cap.

See `ai-engine.md` for full provider specs, health checks, and failover logic.

---

## 6. Workflow Engine

**10 node types** in a DAG executor with topological sort:

| Node Type | Purpose | Config Key Fields |
|-----------|---------|-------------------|
| `agent` | Route to AI agent | `agentId`, `prompt` |
| `council` | Trigger council evaluation | `proposal` |
| `plugin` | Execute MCP tool | `tool`, `args` |
| `condition` | Branching (gated) | `expression` |
| `parallel` | Fan-out branches | `branches` |
| `loop` | Iterate over array | `iterSource`, `maxIterations` |
| `http` | HTTP request | `url`, `method`, `headers`, `body` |
| `code` | Execute JS (gated) | `code`, `language` |
| `sub_workflow` | Execute another workflow | `subWorkflowId` |
| `graphify` | Query/add knowledge graph | `graphifyAction`, `graphifyEntity` |

**Persistence:** JSON files (default) or Supabase DB (opt-in via `TALOS_WORKFLOW_DB_ENABLED`).

**Security:** `code` and `condition` nodes gated behind `TALOS_WORKFLOW_CODE_ENABLED` (default OFF) to prevent RCE.

See `workflow-engine.md` for full execution model, retry logic, and validation.

---

## 7. Memory System (Cortex + Nornir)

**Cortex** — User identity core with 3-layer Thread of Fate:
1. **Recent (verbatim):** Last 50 turns, full text
2. **Mid-range:** Compressed summaries (8 blocks × 20 turns = 160 turns)
3. **Distant:** Episodic markers (>200 turns)

**Token budget:** 12,000 tokens max per context injection.

**Nornir** — Three Fates of Memory (nightly cron at 3 AM):
- **Urd** (Past): Maintains Identity Core and episodic vault
- **Verdandi** (Present): Progressive summarization and Thread Digest updates
- **Skuld** (Future): Predictive retrieval for upcoming scheduled tasks

See `memory.md` for full compression algorithm, token budgeting, and consolidation logic.

---

## 8. Plugin Architecture

**MCP (Model Context Protocol):** Standard for tool integration. Register endpoints, execute tools, health checks.

**ACP (Agent Communication Protocol):** Inter-agent communication. Operations: read, write, exec, lint, search. Path traversal protection enforced.

**Plugin lifecycle:** install → activate → healthCheck → deactivate → uninstall

**Statuses:** `active`, `inactive`, `failed`, `removed`

See `plugin-system.md` for full lifecycle, MCP tool execution, and ACP security.

---

## 9. Knowledge Graph (Graphify)

**Triple store:** `subject → predicate → object` with optional context and weight.

**Functions:**
- `addTriple()` — Store a knowledge fact
- `queryTriples()` — Filter by entity/predicate/subject/object with pagination
- `findPath()` — BFS path-finding through the graph
- `getStats()` — Graph statistics

**Persistence:** JSON file at `.talos/graphify.json` (80+ triples as of v8.0).

**Used by:** Rituals (session start/end), Workflow engine (graphify node), opencode tools.

See `graphify.md` for full query API, schema, and integration points.

---

## 10. Database Schema (14 tables)

| Table | Purpose |
|-------|---------|
| `talos_guilds` | Agent guilds (shared tools, permissions) |
| `talos_devices` | G0DM0D3 device registry |
| `talos_agents` | Agent registry (model, capabilities, load, status) |
| `talos_tasks` | Task queue (status, priority, skills, retries) |
| `talos_auctions` | The Loom auction system |
| `talos_cortex` | User Cortex (identity, thread of fate) |
| `talos_nornir_markers` | Episodic markers with pgvector embeddings |
| `talos_memory_vectors` | File-based memory with vector embeddings |
| `talos_spend_ledger` | Budget tracking |
| `talos_settings` | Master runtime config |
| `talos_plugins` | Plugin registry |
| `talos_audit_trail` | Audit logging |
| `talos_skills` | Runtime skill registry (12 fields) |
| `talos_workflows` | Workflow definitions (JSONB) |
| `talos_workflow_runs` | Workflow execution runs |
| `talos_run_logs` | Per-node execution logs |

**Migrations:** `supabase/migrations/0001_init.sql`, `0002_skills.sql`, `0003_workflows.sql`

See `database.md` for full schema, RLS policies, and indexes.

---

## 11. API Surface

**REST API** on port 8642 (configurable via `TALOS_PORT`):

| Category | Endpoints | Count |
|----------|-----------|-------|
| Health | `/health`, `/health/providers` | 2 |
| AI Route | `/v1/route` | 1 |
| Agents | `/v1/agents/:id`, `/v1/agents/external` | 3 |
| Council | `/v1/council`, `/v1/council/:id` | 2 |
| Plugins | `/v1/plugins`, `/v1/plugins/:id`, `/v1/plugins/health` | 5 |
| MCP | `/v1/mcp/endpoints`, `/v1/mcp/execute` | 2 |
| ACP | `/v1/acp` | 1 |
| Graphify | `/v1/graphify/*` | 7 |
| Workflows | `/v1/workflow`, `/v1/workflow/:id/run`, `/v1/workflow/run/:id`, `/v1/workflow/runs` | 6 |
| Blueprint | `/v1/blueprint/diff`, `/v1/blueprint/plan` | 2 |

**Total: 30+ endpoints**

See `rest-api.md` for full request/response schemas, authentication, and error handling.

---

## 12. Configuration

**Sources:** `talos.config.yaml` (primary) + environment variables (env overrides YAML).

| Config Section | Purpose |
|----------------|---------|
| `g0dm0d3` | Scan interval, capability threshold, subnets, ollama port |
| `cloud` | Enabled providers, budget caps (monthly/hourly/per-task) |
| `hermes` | Agent model, context tokens, temperature |
| `cortex` | Max injection tokens, verbatim window, compression thresholds |
| `loom` | Bidding window, epsilon greedy, re-auction timeout |
| `agents` | Per-agent model and context config |

**Key env vars:**
- `TALOS_PORT` — API server port (default 8642)
- `TALOS_HOST` — API server host (default 0.0.0.0)
- `TALOS_OWL_ALPHA_ENABLED` — Owl Alpha opt-OUT (default true)
- `TALOS_WORKFLOW_DB_ENABLED` — Supabase workflow persistence (default false)
- `TALOS_WORKFLOW_CODE_ENABLED` — Code/condition nodes (default false)
- `TALOS_WORKSPACE_ROOT` — Project root path
- `TALOS_GRAPHIFY_PATH` — Graphify JSON path
- `TALOS_VAULT_PATH` — Obsidian vault path
- `TALOS_WORKFLOW_DIR` — Workflow JSON directory

---

## 13. Infrastructure

**Docker:** Multi-stage build (`Dockerfile.core`). Base: `node:20-alpine` + pnpm@9.15.0. Exposes port 8642.

**Local dev:** `docker compose up` starts Postgres, Redis, Ollama, Talos Core.

**Install scripts:** `scripts/install-windows.ps1` (Windows), `scripts/install-ubuntu.sh` (Ubuntu).

**opencode integration:** Custom tools (graphify, obsidian, session, talos), 22 subagents, 7+ skills.

---

## 14. Testing

- **179/183 tests pass** (4 AI-dependent skipped)
- **0 failures** (pre-existing path-traversal test fixed in ADR-032)
- **5/5 packages build** via turbo
- **Test framework:** vitest (root config)
- **Per-package:** `pnpm --filter @talos/core test`

**Test files:**
- `ai-engine.test.ts` — Router, provider selection, Owl Alpha
- `budget.test.ts` — Budget gate, token estimation
- `council.test.ts` — 5-advisor evaluation, session management
- `graphify.test.ts` — Triple store, queries, path finding
- `plugin.test.ts` — MCP, ACP, lifecycle, path traversal
- `rituals.test.ts` — Session start/end, date handling
- `workflow.test.ts` — DAG execution, 10 node types, validation

---

## 15. Development Phases

| Phase | Status | Description |
|-------|--------|-------------|
| Phase -1 | ✅ Done | Project scaffolding |
| Phase 0 | ✅ Done | Core engine (AI router, council, plugins) |
| Phase 1A | ✅ Done | Graphify + Budget |
| Phase 1B | ✅ Done | Workflow Engine MVP |
| Phase 1C | ✅ Done | Self-feeding layer (AGENTS.md, skills, graphify) |
| Phase 2 | ✅ Done | Workflow Engine full (10 node types, DB persistence) |
| Phase 3 | ⏳ Next | Harvester (skill ingestion), Memory consolidation |
| Phase 4 | ⏳ Queued | UI polish, Phoenix self-improvement, Sandbox |
| Phase 5 | ⏳ Queued | Production hardening, multi-tenant, monitoring |

---

## 16. Architecture Decision Records

All ADRs are in `docs/decisions/adr-log.md`. Key decisions:

- **ADR-012:** `code`/`condition` nodes gated behind `TALOS_WORKFLOW_CODE_ENABLED` (RCE prevention)
- **ADR-018:** Workflow persistence dual-mode (JSON default, Supabase opt-in)
- **ADR-026:** Owl Alpha opt-OUT semantics (default ON, costs $0)
- **ADR-030:** Tailwind color naming — UPPERCASE `DEFAULT` key required
- **ADR-032:** Path-traversal test uses `C:\Windows\System32` (Windows-specific fix)
- **ADR-034:** Supabase MCP uses stdio transport with PAT (not remote OAuth)

---

## 17. Cross-References

| Topic | Primary Doc | Related |
|-------|-------------|---------|
| AI routing | `ai-engine.md` | `budget.md`, `database.md` |
| Agent execution | `agents.md` | `ai-engine.md`, `council.md` |
| Workflow execution | `workflow-engine.md` | `ai-engine.md`, `plugin-system.md`, `graphify.md` |
| Memory compression | `memory.md` | `database.md`, `rituals.md` |
| Plugin lifecycle | `plugin-system.md` | `rest-api.md`, `database.md` |
| Knowledge graph | `graphify.md` | `rituals.md`, `workflow-engine.md` |
| Budget enforcement | `budget.md` | `ai-engine.md`, `rest-api.md` |
| Database schema | `database.md` | `rest-api.md`, `workflow-engine.md` |
| UI components | `ui-system.md` | `design-tokens.md`, `workflow-canvas.md` |
| opencode tools | `opencode-tools.md` | `opencode-agents.md`, `opencode-skills.md` |
