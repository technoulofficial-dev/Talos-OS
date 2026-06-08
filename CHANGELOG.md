# Changelog

All notable changes to Talos OS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.8.1] - 2026-06-07

### Added

#### Foundation Repair (1235 insertions, 14 files)
- **RLS for all orphaned tables** — 0004_rls.sql applies row-level security to 12 tables (bans, council_sessions, council_reports, council_opinions, council_ballots, eitri_fabrications, loom_auctions, loom_auction_bids, loom_task_bounties, loom_tasks, loom_task_assignments, plugin_configs)
- **pgvector extension** enabled for vector search
- **4 new @talos/db modules**: `devices.ts` (197 lines), `spend_ledger.ts` (160 lines), `audit_trail.ts` (135 lines), `settings.ts` (156 lines) — all follow optional-client pattern
- **Dual-mode DB wiring**: `registry.ts`, `ledger.ts`, `trace.ts` — opt-in via env flags, in-memory always runs as fallback
- **Guild permission middleware** (`middleware/permissions.ts`, 99 lines) — `checkGuildPermission()`, `requirePermission()`, `extractAgentId()` enforced on 6 server endpoints
- **Loom DB bridge** — `syncAgentToDb()` on register/load/score changes, auction sync on announce/settle when `TALOS_LOOM_DB_ENABLED=true`

#### AI Capacity Hardening (287 insertions, 5 files)
- **Circuit breaker** — 3 failures in 1 minute → 5-minute cooldown per provider
- **Force-local mode** — `TALOS_FORCE_LOCAL=true` routes everything to Ollama (zero-cost, airgapped)
- **Provider budget tracker** — 500K tokens/day, 500 requests/day per provider (auto-resets daily)
- **Emergency kill switch** — `TALOS_KILL_SWITCH=true` blocks all cloud API calls (local Ollama only), also toggled at runtime via `/v1/capacity`
- **`GET /v1/capacity` endpoint** — circuit states, provider usage, force-local and kill-switch status

#### Workflow Output Compression (128 insertions, 4 files)
- **Node output compression** — outputs >10K chars truncated to save context window
- **Graphify prompt cache** — stores/retrieves frequently-used prompts via knowledge graph
- **Nornir Verdandi LLM fix** — removed invalid `talos:fast` model, added temperature 0.3

#### Harvester Phase 3
- License check (SPDX → allowlist) → LLM extraction → validation → DB registration
- `POST /v1/harvester/ingest` endpoint (returns 422 on extraction failure)

#### Template Resolution
- `{{nodeId.field}}` variable interpolation in workflow node configs
- Node outputs injected flat into `run.variables[node.id]`
- `resolveVariables()` exported for direct use

#### Additional
- 22 memory tests for `@talos/memory`
- 5 reusable UI components (AgentCard, StatusBadge, MetricCard, SearchBar, DataTable)
- Mission Control MemoryView, BlueprintView, ChatView
- OpenRouter models updated to 12 current free models
- Full documentation system (28 files, ~400KB)
- v0.8.0 tagged and GitHub release published

### Changed
- All provider calls in `routeUnlimited` now tracked via `recordTrace()` (structured audit logging)
- `/v1/capacity` response now includes `killSwitch` field
- `.env.example` updated with 9 env flags (4 dual-mode + force-local + kill-switch + owl-alpha + workflow-code + loom-db)
- Build: 5/5 packages via turbo
- Tests: 237 pass, 4 skipped, 1 pre-existing council failure

### Security
- RLS enforced on all 12 orphaned tables (council, bans, eitri, loom, plugin_configs)
- Guild permissions enforced on 6 server endpoints (execute_tasks, create_agents, write_own_memory, access_network, modify_config)
- Emergency kill switch for immediate cloud API shutdown
- Workflow output compression prevents context window overflow

## [0.8.0] - 2026-06-07

### Added

#### Core Engine
- AI Router with multi-provider fallback: Ollama → G0DM0D3 LAN → Owl Alpha → g0dm0d3 cloud → NVIDIA NIM
- Owl Alpha as top-priority free model (openrouter/owl-alpha, $0/M, 1M context, agentic-optimized)
- Council of agents with guild system (Watchers, Smiths, Scribes, Scouts, Wardens, Keepers)
- Plugin sandboxing with `eval()` isolation and RCE prevention
- Graph knowledge store (entity-relation-entity triples)
- Memory system (Cortex + Nornir)

#### Workflow Engine
- DAG executor with 10 node types: task, http, decision, response, code, agent, skill, plugin, sub_workflow, graphify
- 6 REST endpoints: POST/GET /v1/workflow, POST /v1/workflow/:id/run, GET /v1/workflow/run/:runId, GET /v1/workflow/runs
- Dual-mode persistence: JSON default, Supabase opt-in via TALOS_WORKFLOW_DB_ENABLED
- Sub-workflow execution (workflow node type)
- Graphify integration (knowledge graph node type)

#### Database Layer
- @talos/db package with Supabase integration
- Skills CRUD module (register, get, list, updateSuccessRate, promoteToCached)
- Workflows DB module (save, load, list, delete workflows + runs + logs)
- Optional client injection pattern for testability
- 6 Supabase migrations (init, skills, workflows)

#### Rituals & Session Management
- Session start/end rituals (session_start, session_end tools)
- Mid-session learning capture (capture_learning tool)
- Cross-session context protocol via graphify + obsidian

#### OpenCode Integration
- 14 custom agent configurations with increased step limits
- 22 skills loaded (project-level + global)
- 6 MCP servers configured (browser, memory, github, magic, supabase, open-design)
- Self-feeding pattern: AGENTS.md → skills → graphify → obsidian

#### Mission Control UI
- Next.js 15 + Tailwind 3 + React Flow
- 7 views: Dashboard, Agents, Workflows, Plugins, Memory, Chat, Settings
- MemoryView: graphify triples CRUD with search/filter/add/delete
- BlueprintView: blueprint diff viewer, risk summary grid, reconfiguration plan
- ChatView: Odin chat interface with Owl Alpha "Free · Logging" badge
- WorkflowCanvas: React Flow drag-and-drop workflow authoring (10 node types)
- 5 reusable UI components: AgentCard, StatusBadge, MetricCard, SearchBar, DataTable
- Linear design system applied (tokens + tailwind.config.js + globals.css)

#### Design System
- Linear-themed design tokens (linear.json)
- Tailwind 3 color palette (primary, surface, border, text, status)
- Fixed color naming convention (ADR-030)
- apply-design-system.js idempotency (ADR-031)

#### Scripts
- install-windows.ps1: Windows setup script
- install-ubuntu.sh: Ubuntu setup script
- design-tools.ps1: open-design + Magic MCP management
- start-opencode.ps1: opencode launcher
- mcp-call.mjs / mcp-drive.mjs: MCP testing utilities

#### Documentation
- 28 comprehensive docs (~400KB) in docs/ directory
- Master blueprint (docs/architecture/blueprint.md)
- Architecture docs: agents, AI engine, workflow engine, graph store, memory, plugins, rituals, design
- API reference (REST API, 31 endpoints documented)
- Feature docs: MCP integration, opencode tools/agents/skills
- Design docs: UI system, design tokens, workflow canvas
- Runbooks: local setup, deployment
- Decision log: 34 ADRs consolidated

#### Tests
- 191 passing tests across 9 test files
- 4 AI-dependent tests skipped (expected)
- 0 failures
- Test coverage: core engine, workflow, rituals, graphify, plugins, AI engine, skills, workflows DB

### Changed
- Workflow engine expanded from 6 to 10 node types
- OpenRouter free models updated to 12 current models (qwen3, gemma-4, nemotron-3, kimi-k2.6, gpt-oss, glm-4.5)
- Client.ts no longer auto-appends `:free` suffix to model IDs (ADR-040)
- start-server.mjs is canonical server startup on Windows (ADR-042)
- AGENTS.md session logs track all ADRs and decisions

### Fixed
- Path-traversal test flakiness (ADR-032): uses C:\Windows\System32 instead of parent dir
- Rituals date-flakiness: vi.useFakeTimers() pinned to fixed date
- Tailwind color naming: UPPERCASE DEFAULT key required (ADR-030)
- PowerShell 5.1 Unicode parsing: replaced non-ASCII chars (ADR-024)

### Security
- Workflow code/condition nodes gated behind TALOS_WORKFLOW_CODE_ENABLED (default OFF)
- Plugin sandboxing with eval() isolation
- Test-only hooks in _test_hooks.ts, not re-exported from production barrel
- .env files gitignored (ADR-033)
- Supabase MCP uses stdio + PAT for reliability (ADR-034)

### Deprecated
- G0DM0D3 free models: llama-3, gemma-2, mistral-7b, phi-3 (replaced by current 12 models)
- open-design MCP: requires subscription desktop app (disabled)

## [0.7.0] - 2026-06-05

### Added
- Phase 2 Workflow Engine MVP
- 8 node types (task, http, decision, response, code, agent, skill, plugin)
- JSON persistence at .talos/workflows/
- 6 REST endpoints
- Session rituals (session_start, session_end, capture_learning)
- Skills module with CRUD operations
- Workflows DB with dual-mode persistence

### Fixed
- Engine bugs, validator crash, retry counter
- Type errors, schema mismatches
- Turbo v1→v2 rename

## [0.6.0] - 2026-06-04

### Added
- Phase 1B: Plugin system with sandboxing
- Graph knowledge store (graphify)
- AI Router with multi-provider fallback
- Council of agents with guild system

## [0.5.0] - 2026-06-03

### Added
- Phase 1A: Core engine setup
- TypeScript configuration
- Package structure (core, db, memory, ui, cli)
- Build system (turbo, pnpm)

## [0.1.0] - 2026-06-01

### Added
- Initial project setup
- Monorepo structure
- Documentation system
- Development environment
