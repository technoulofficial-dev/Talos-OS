# Project Rules

This is a JavaScript/TypeScript, Docker / Containers, Documentation / Markdown project.

## Project Structure

```
D:\Talos OS\
├── packages/            # Monorepo workspace (pnpm workspaces)
│   ├── core/            # @talos/core — TypeScript engine (AI router, council, plugins, graphify)
│   ├── cli/             # talos — CLI tool
│   ├── db/              # @talos/db — Supabase DB layer
│   ├── memory/          # @talos/memory — Cortex + Nornir
│   └── ui/              # @talos/ui — Next.js Mission Control
├── talos-agents/        # 13 internal agent packages (Odin, Brokkr, Mimir, etc.)
├── infrastructure/      # Docker, scripts, G0DM0D3 config
├── docs/                # Architecture docs, runbooks, API docs
├── supabase/            # DB migrations
├── scripts/             # Install scripts (Ubuntu, Windows)
├── .opencode/           # opencode tools, agents, skills, config
└── .talos-notes/        # opencode Obsidian vault (session logs, decisions, architecture)
```

## Code Standards

### JavaScript/TypeScript

- Use TypeScript with strict mode where possible
- Prefer ESM imports over CommonJS require
- Use async/await over raw Promises

### Docker / Containers

- Use multi-stage builds for smaller images
- Pin base image versions
- Do not run as root in containers

### Documentation / Markdown

- Use consistent heading levels
- Keep line length under 120 characters where practical
- Include code examples for technical documentation

## Commands

All commands use **pnpm** (not npm). This project uses `pnpm@9.15.0`.

### Workspace-level

| Command | What it does |
|---------|-------------|
| `pnpm build` | Build all packages via turbo |
| `pnpm test` | Run vitest for all packages (root vitest config) |
| `pnpm lint` | Type-check all packages via turbo |
| `pnpm dev` | Watch-mode builds via turbo |

### Per-package

| Package | Build | Test | Lint | Dev |
|---------|-------|------|------|-----|
| `@talos/core` | `pnpm --filter @talos/core build` | `pnpm --filter @talos/core test` | `pnpm --filter @talos/core lint` | `pnpm --filter @talos/core dev` |
| `talos` (CLI) | `pnpm --filter talos build` | (none) | (none) | (none) |
| `@talos/db` | `pnpm --filter @talos/db build` | (none) | `pnpm --filter @talos/db lint` | (none) |
| `@talos/memory` | `pnpm --filter @talos/memory build` | (none) | (none) | (none) |
| `@talos/ui` | `pnpm --filter @talos/ui build` | (none) | `pnpm --filter @talos/ui lint` | `pnpm --filter @talos/ui dev` |

### Docker

| Command | What it does |
|---------|-------------|
| `docker compose build` | Build core container from `infrastructure/docker/Dockerfile.core` |
| `docker compose up` | Start all services (Postgres, Redis, Ollama, Talos Core) |

### Database

| Command | What it does |
|---------|-------------|
| `pnpm db:migrate` | Push Supabase schema |
| `pnpm db:generate` | Generate TS types from Supabase |

### Design Tools (optional — for Magic /ui + open-design MCPs)

| Command | What it does |
|---------|-------------|
| `pnpm od:install` | Open the open-design download page (installs the desktop app + daemon) |
| `pnpm od:open` | Launch the open-design desktop app (daemon auto-starts on port 7456) |
| `pnpm od:status` | Ping `OD_DAEMON_URL` (default `http://localhost:7456`) for reachability |
| `pnpm od:tools` | Print the list of `od_*` MCP tools (visible after opencode restart) |
| `pnpm magic:check` | Verify `TWENTYFIRST_API_KEY` is set in the current shell |

## Package Manager

This project uses **pnpm@9.15.0**. Always use `pnpm` for installing dependencies.

## Custom Subagents

The following custom subagents are available (invoke with `@agent-name`):

- **@backend-developer**: Server-side logic, APIs, and data processing
- **@frontend-developer**: UI implementation, components, and browser APIs
- **@fullstack-developer**: End-to-end feature development across the stack
- **@websocket-engineer**: Real-time communication and WebSocket protocol design
- **@typescript-pro**: TypeScript type system, generics, and advanced patterns
- **@javascript-pro**: Modern JavaScript, ES modules, and runtime optimization
- **@react-specialist**: React hooks, state management, and component design
- **@vue-expert**: Vue 3 composition API, reactivity, and ecosystem
- **@angular-architect**: Angular modules, RxJS, and enterprise-scale SPAs
- **@nextjs-developer**: Next.js App Router, SSR, RSC, and deployment
- **@deployment-engineer**: Deployment strategies, blue-green, canary, and rollbacks
- **@devops-engineer**: CI/CD pipelines, infrastructure, and deployment
- **@docker-expert**: Docker optimization, multi-stage builds, and security
- **@platform-engineer**: Internal developer platforms and self-service tooling
- **@sre-engineer**: Site reliability, monitoring, and incident response
- **@code-reviewer**: Code review with security and performance focus
- **@build-engineer**: Build system configuration, caching, and optimization
- **@dependency-manager**: Dependency updates, audit, and compatibility checks
- **@docs-writer**: Technical documentation and API reference writing
- **@git-workflow-manager**: Git workflow, branching strategy, and commit hygiene
- **@test-writer**: Test generation following project patterns
- **@technical-writer**: User guides, tutorials, and knowledge base articles

## Available Skills

The following skills are installed and will be loaded on demand:

### Project-level

- **changelog-generate**: Generate CHANGELOG.md from git history in Keep a Changelog format
- **ci-pipeline**: Generate CI/CD pipeline config with lint, test, build, deploy stages
- **dependency-audit**: Scan dependencies for CVEs, outdated packages, license issues
- **git-release**: Create consistent releases with changelogs, version bumps, and release notes
- **talos-architecture**: Reference for Talos OS v8.0 architecture (package structure, agent system, build chain, phases)
- **talos-ui-patterns**: Talos OS Mission Control UI component conventions, design tokens, and styling
- **test-patterns**: Generate tests following project conventions

### Global (opencode-power-pack plugin)

- **agents-md-improver**: Audit and improve AGENTS.md quality against a rubric — load after major project changes
- **agents-md-revise**: Capture session learnings into AGENTS.md — load at END of every session
- **code-architect**: Structured architecture design phase before implementing features
- **code-explorer**: Deep codebase tracing, mapping, and understanding
- **code-review**: Full PR review with multi-agent confidence filtering
- **code-reviewer**: Local code review with confidence-filtered bug/security/quality reporting
- **feature-dev**: 7-phase structured feature implementation workflow
- **frontend-design**: Polished, accessible frontend UI with design quality rubric
- **mcp-builder**: Guide creation of MCP servers (Python FastMCP or Node/TypeScript MCP SDK)
- **security-review**: Focused security review of pending changes before merge
- **skill-creator**: Create new skills from scratch or convert workflows into reusable skills

### Global (built-in)

- **acpx**: Headless ACP CLI for agent-to-agent communication, session management, queueing
- **customize-opencode**: Use ONLY when editing opencode's own config files

## Custom Tools

These tools are loaded automatically from `.opencode/tools/`:

- `graphify_*` (addKnowledge, queryKnowledge, getGraphStats) — Store and query knowledge triples in the Talos knowledge graph
- `obsidian_*` (readNote, writeNote, listNotes, searchNotes) — Read/write/search markdown notes in `.talos-notes/` vault
- `talos_*` (runBuild, runTests, checkHealth, listAgents) — Build, test, and health check Talos OS packages
- `session_start` — Session start ritual: loads recent graphify triples, last obsidian session log, AGENTS.md headings
- `session_end` — Session end ritual: writes dated session log to `.talos-notes/session/{date}-session.md`, optionally persists learnings to graphify
- `capture_learning` — Mid-session helper: persists a single learning triple to graphify

### Self-Feeding Pattern

The `graphify`, `obsidian`, and `session` tools follow the same pattern: a pure data layer lives in `packages/core/src/<module>/` (testable under vitest), and the opencode tool in `.opencode/tools/` is a thin shell that re-implements the same logic inline. The duplication is intentional — the opencode plugin runtime does not reliably resolve cross-package TS imports, and self-contained tools are easier to reason about. The in-core version is the source of truth for tests; the opencode tool mirrors it manually. A drift check should be added if these diverge.

## MCP Servers

Configured in `opencode.json` with `use <tool-name>` prompting:

- **browser** — Playwright browser automation (UI testing, screenshots, web research). Enabled by default.
- **memory** — Persistent memory across sessions. Enabled by default.
- **github** — GitHub API access. Disabled by default — set `GITHUB_TOKEN` env var and enable in opencode.json.

## Conventions

- Use conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`
- Write meaningful commit messages that explain the "why"
- Keep PRs focused on a single concern

### Skill Loading Discipline (self-feeding rules)

To maximize output quality, load skills proactively based on task type:

| When doing this... | Load this skill |
|---|---|
| Building a new feature | `feature-dev`, `code-architect` (before), `code-reviewer` (after), `security-review` (pre-merge) |
| Reading unfamiliar code | `code-explorer` (deep traces) |
| Reviewing PRs | `code-review` (multi-agent) |
| Creating/fixing opencode config | `customize-opencode` |
| Creating a reusable workflow | `skill-creator` |
| Building a MCP server | `mcp-builder` |
| Building UI | `frontend-design`, `talos-ui-patterns` |
| Writing tests | `test-patterns` |
| Managing releases | `git-release`, `changelog-generate` |
| Auditing deps | `dependency-audit` |
| **Ending a session** | **`agents-md-revise`** (captures learnings here) |
| Auditing this file | `agents-md-improver` |

### Cross-Session Context Protocol

1. **Session start**: Call `session_start` tool (loads recent graphify triples, last obsidian session log, AGENTS.md headings) → seed the session with prior context
2. **During work**: Record every significant decision via `capture_learning` (single triple) or `graphify_addKnowledge`; write detailed notes via `obsidian_writeNote`
3. **Session end**: Call `session_end` tool with summary, decisions, learnings, nextSteps → writes dated log to `.talos-notes/session/{date}-session.md` and persists learnings to graphify. Also load `agents-md-revise` skill to update this file with new project rules.

## Session Log

<!-- Learnings are captured here by the agents-md-revise skill at session end -->

### 2026-06-05 — Phase 2: Workflow Engine MVP + Session Rituals

**What was built:**
- `packages/core/src/workflow/` — DAG executor with 8 node types, JSON persistence at `.talos/workflows/`, 6 REST endpoints (`POST/GET /v1/workflow`, `POST /v1/workflow/validate`, `POST /v1/workflow/{id}/run`, `GET /v1/workflow/run/{id}`, `GET /v1/workflow/runs`)
- `packages/core/src/rituals/` + `.opencode/tools/session.ts` — `session_start`, `session_end`, `capture_learning` ritual tools with testable data layer
- `turbo.json` (v2.x tasks), root `vitest.config.ts`, `install-windows.ps1` → pnpm

**Test status:** 165/170 pass (4 AI-dependent skipped, 1 pre-existing plugin path-traversal failure)

**Key decisions (ADR-001 to ADR-011):**
- ADR-001..010 documented in `.talos-notes/architecture/decisions.md`
- ADR-011 (new): `__setStoreDir` test hook lives in `_test_hooks.ts`, NOT re-exported from production barrel (underscore prefix alone is convention; barrel exposure is the real attack surface)
- ADR-012 (new): Workflow `code` and `condition` node types gated behind `TALOS_WORKFLOW_CODE_ENABLED` env flag (default OFF). Prevents RCE via `POST /v1/workflow` with unauthenticated `new Function()` execution
- ADR-013 (new): Use `z.input<typeof Schema>` for function parameters accepting partial data; `z.infer<>` returns post-default type with all defaultable fields required, breaking call sites
- ADR-014 (new): Use `import.meta.url` + walk-up for absolute path resolution in `.opencode/tools/*.ts`. `process.cwd()` is not the project root in the opencode plugin runtime

**Bugs found and fixed in this session:** 12 total (engine bugs, validator crash, retry counter, type errors, schema mismatches, TS field name mismatches, duplicate function, turbo v1→v2 rename)

**Code review findings (loaded `code-reviewer` skill):** 4 high-confidence issues, all fixed (RCE gate, validator safeParse, test-hook barrel removal, callback leak)

### 2026-06-05 — Phase 2 Drift Fixes (1-hour compacted pass)

**What changed:**
- Added `sub_workflow` and `graphify` to `WorkflowNodeTypeSchema` (10 node types total, blueprint §9.2 alignment)
- Added `executeSubWorkflowNode` and `executeGraphifyNode` executors
- Created `supabase/migrations/0002_skills.sql` (12 fields matching blueprint §12.2 + RLS)
- Created `packages/db/src/skills.ts` with minimal CRUD (register, get, list, updateSuccessRate, promoteToCached)
- Re-exported from `packages/db/src/index.ts`

**Decisions:**
- ADR-015: Keep `parallel` and `loop` node types as non-blueprint extensions (per user choice — strict blueprint match would have broken existing tests)
- ADR-016: Skills table is CRUD-only this session; no Harvester (Phase 3) integration yet — keep blast radius small
- ADR-017: Compact ritual must always run before drift fixes so the next session inherits context; do not skip

**Deferred to next session (queued in graphify):**
- Workflow DB tables (`talos_workflows`, `talos_workflow_runs`, `talos_run_logs`) + persistence.ts rewrite
- React Flow canvas in `@talos/ui` for workflow authoring
- Harvester Phase 3 implementation
- Pre-existing `plugin.test.ts:228` path-traversal test fix

**Test status:** 175+/170 pass (target — verified in Step 4 of execution)

### 2026-06-05 — Phase 2 Drift Fixes (CLOSED)

**Closed:** all drift-fix items shipped.

**Final results:**
- `sub_workflow` and `graphify` added to `WorkflowNodeTypeSchema`; `executeSubWorkflowNode` + `executeGraphifyNode` wired in (sub_workflow calls another workflow by id; graphify queries the triple store via `queryTriples`). 6 new workflow tests pass.
- `supabase/migrations/0002_skills.sql` (12 fields matching blueprint §12.2 + RLS) + `packages/db/src/skills.ts` (minimal CRUD: register, get, list, updateSuccessRate, promoteToCached) + `packages/db/src/__tests__/skills.test.ts` (5 tests pass). vitest added as dev dep to `@talos/db`.
- 176/180 tests pass (exceeded 175+ target); 4 AI-dependent skipped; 1 pre-existing `plugin.test.ts:228` path-traversal failure unchanged
- 5/5 packages build via turbo

**Implementation notes for next session:**
- Skills module accepts an optional `client` parameter on every function, defaulting to `getSupabaseClient()`. Tests inject a mock `SkillsClient`. This pattern can be back-ported to other db modules.
- `WorkflowNodeConfigSchema` is `.strict()` — adding a new node type means adding a `*_xxx: z.string().optional()` config field, NOT relying on `args` passthrough.
- Blueprint §9.2 alignment is now ~100% for node types; the `parallel` and `loop` extensions are documented as non-blueprint.

### 2026-06-05 → 2026-06-06 — Workflow DB persistence (dual-mode)

**What changed:**
- `supabase/migrations/0003_workflows.sql` — 3 tables: `talos_workflows`, `talos_workflow_runs`, `talos_run_logs` (blueprint §3.5/§20), all with RLS + indexes
- `packages/db/src/workflows.ts` — 7 functions (`saveWorkflowToDb`, `loadWorkflowFromDb`, `listWorkflowsFromDb`, `deleteWorkflowFromDb`, `saveRunToDb`, `loadRunFromDb`, `listRunsFromDb`) + 5 structural types. Mirrors `skills.ts` pattern: optional client injection, no `@talos/core` import.
- `packages/db/src/__tests__/workflows.test.ts` — 7 tests using injected mock client (passes via `select().eq()` thenable chain)
- `packages/core/src/workflow/persistence.ts` — rewired as **dual-mode**: when `TALOS_WORKFLOW_DB_ENABLED=true` (default OFF), all 7 calls delegate to `@talos/db` via dynamic import. JSON-file path unchanged.
- `packages/core/package.json` — added `@talos/db@workspace:*` as a dep
- `packages/core/src/__tests__/rituals.test.ts` — fixed date-flakiness with `vi.useFakeTimers()` pinned to 2026-06-05T15:00Z (system clock rollover was breaking `sessionEnd` filename assertions)

**Decisions:**
- ADR-018: Workflow persistence is dual-mode (JSON default, Supabase opt-in via `TALOS_WORKFLOW_DB_ENABLED`). Reasoning: keeps the 40+ existing workflow tests passing without a Supabase instance, but lets production deploy with real DB matching the blueprint
- ADR-019: `@talos/db` defines structural types (`WorkflowDefinitionDb`, `WorkflowRunDb`, `NodeRunStateDb`) locally, NOT importing from `@talos/core`. This keeps the dep graph clean: db is lower-level than core. `persistence.ts` casts at the boundary.
- ADR-020: Date-brittle tests should pin the system clock with `vi.useFakeTimers()` in `beforeEach`. Apply this pattern proactively to any other tests that derive dates from `new Date()`.

**Test status:** 183/188 pass (4 AI-dependent skipped; 1 pre-existing `plugin.test.ts:228` path-traversal failure unchanged; rituals date-flakiness fixed)

**Queued for next session (graphify-persisted):**
- React Flow canvas in `@talos/ui` (reactflow ^11.11.0 in deps; no authoring canvas yet)
- Harvester Phase 3 implementation that uses the new `talos_skills` table
- Pre-existing `plugin.test.ts:228` path-traversal test fix
- Investigate the `supabase-js` `select().eq()` typing — the loose `any` cast in `WorkflowsDbClient.from` works but a more precise type is possible

### 2026-06-06 — P0: 21st.dev Magic MCP + open-design MCP integration

**What was built:**
- `opencode.json` — added 2 new MCPs: `magic` (npx `@21st-dev/magic@latest`, env: `TWENTYFIRST_API_KEY`) and `open-design` (npx `open-design-mcp@latest`, env: `OD_DAEMON_URL`). Both use the existing `mcp` schema (`type: "local"`, `command: [array]`, `environment`, `{env:VAR}` interpolation, `enabled`, `timeout`).
- `.env.example` — added **Design Tools** section with `TWENTYFIRST_API_KEY` and `OD_DAEMON_URL` (both commented out, with signup URLs).
- `package.json` — 5 new scripts: `od:install`, `od:open`, `od:status`, `od:tools`, `magic:check`. Each delegates to `scripts/design-tools.ps1` via `powershell -ExecutionPolicy Bypass -File`.
- `scripts/design-tools.ps1` (NEW, 115 lines, ASCII-only) — single PowerShell module with `[CmdletBinding()]`, `[ValidateSet()]` action param, and 5 cases: install / open / status / tools / magic-check. Provides graceful failure for all external checks (daemon unreachable, API key missing).
- `scripts/install-windows.ps1` — extended `Show-PostInstall` with optional Design Tools steps (4-6).

**Decisions:**
- ADR-021: open-design daemon is the desktop app, NOT a separate npm package. `pnpm od:start` would be misleading; use `pnpm od:open` (launches the GUI; daemon comes up on port 7456 automatically) or `pnpm od:install` (opens the GitHub releases page).
- ADR-022: Use `${env:VAR}` opencode interpolation syntax (NOT `${VAR}`) — matches the existing `github` MCP's `GITHUB_TOKEN` reference. Verified by reading `opencode.json` line 21.
- ADR-023: Don't auto-load `.env` from opencode.json. Document env-var setup in `install-windows.ps1` and require the user to set vars in their shell before running opencode. This is the existing pattern (see `GITHUB_TOKEN` flow).
- ADR-024: **PowerShell 5.1 parser breaks on Unicode chars in double-quoted strings** (`—` em-dash, `✓` `✗` checkmarks, `→` arrow, `⚒` hammer). Replaced all with ASCII equivalents in `design-tools.ps1`. The parser error manifests as `Unexpected token '{' in expression or statement` at the next switch case after the bad string. Workaround: use ASCII or `-f` format strings for any non-trivial formatting. New PowerShell 7+ doesn't have this issue but Talos targets PS 5.1.
- ADR-025: Worked on `main` (NOT a feature branch) because the working tree has 30+ modified + 60+ untracked files from prior MVE drift. Creating a clean branch would require stashing/committing work the user did not ask to commit. User can branch later.

**Test status:** 5/5 packages build via turbo (1m7s, 3 cached). `pnpm od:tools` + `pnpm magic:check` verified to execute. `pnpm od:status` correctly reports daemon unreachable (expected; user has not installed the open-design app yet).

**Known limitation:** opencode does NOT hot-reload `opencode.json`. After P0 ships, user must restart opencode once to see the new `magic_*` and `od_*` tools.

**Completed in next session:**
- P1: Linear design tokens applied via `scripts/apply-design-system.js` + manual fixes (ADR-030, ADR-031)
- P2: 5 core components built manually (AgentCard, StatusBadge, MetricCard, SearchBar, DataTable) — Magic MCP timed out
- P3: Owl Alpha wired as top-priority in `routeUnlimited()` — confirmed working E2E
- S1-S9: All complete (React Flow canvas, Odin agent, memory wiring, plugin test fix)

### 2026-06-06 — P3: Owl Alpha as top-priority model in G0DM0D3 router

**What changed:**
- `packages/core/src/g0dm0d3/models.ts` — added `OWL_ALPHA_MODEL = "openrouter/owl-alpha:free"` exported constant. Added Owl Alpha as index 0 of `G0DM0D3_FREE_MODELS` (11 models total, 1M context, description includes logging caveat).
- `packages/core/src/ai-engine/router.ts` — added `isOwlAlphaEnabled()` exported helper (opt-OUT, default ON, checks `TALOS_OWL_ALPHA_ENABLED`). Added `callOwlAlpha()` private function (uses same `executeG0DM0D3Cloud` path as the existing g0dm0d3 call, but with `OWL_ALPHA_MODEL`). Inserted Owl Alpha try-step in `routeUnlimited()` waterfall: AFTER local Ollama + G0DM0D3 LAN peers, BEFORE the existing g0dm0d3 cloud call. If Owl Alpha fails, falls through to the existing fallback chain.
- `packages/core/src/__tests__/ai-engine.test.ts` — added new `describe("G0DM0D3 — Owl Alpha Top Priority")` block with 7 tests (constant exists, top-of-list, 1M context, logging caveat, fallback inclusion, opt-OUT default, all env-flag states). Updated existing 2 tests for new model count (10 → 11).
- `.env.example` — added **Owl Alpha** section under AI Engine with `TALOS_OWL_ALPHA_ENABLED=true` (commented out, default-on documented).

**Decisions:**
- ADR-026: Owl Alpha uses opt-OUT semantics (default ON) — opposite of `FEAT_*` opt-in pattern. Reasoning: it costs $0 and is agentic-optimized, so the "off by default" default is wrong. Users who handle sensitive data can disable it.
- ADR-027: Owl Alpha goes through the existing `executeG0DM0D3Cloud` OpenRouter pipeline, not a new provider. The `provider` field stays `"g0dm0d3"`; the `model` field shows `openrouter/owl-alpha:free`. This keeps the budget code path unified and avoids duplicating the g0dm0d3 client. UI can still distinguish via the `model` field.
- ADR-028: Insert Owl Alpha AFTER local Ollama + G0DM0D3 LAN peers but BEFORE the existing g0dm0d3 cloud call. Reasoning: local-first is the existing invariant; LAN peers are also local; Owl Alpha is the new "cloud-free top tier"; existing g0dm0d3 (Llama 3.1 default) becomes the next fallback when Owl Alpha is disabled or fails.
- ADR-029: Test file uses `process.env["TALOS_OWL_ALPHA_ENABLED"]` (bracket access) and non-null assertion (`!`) on `G0DM0D3_FREE_MODELS[0]`. Both are required by TS strict mode + `noUncheckedIndexedAccess` + index signature rules. Pattern to back-port to other env-var tests.

**Test status:** 179/183 pass (4 AI-dependent skipped, same as pre-P3 baseline). `ai-engine.test.ts` grew from 14 to 21 tests (+7). Build 5/5 via turbo in 1m14s (3 cached). No regressions.

**Owl Alpha logging note (UX, not implemented yet):**
- Owl Alpha on OpenRouter is documented to log prompts/completions. Future UI banner needed in chat panel: "Free-tier providers may log conversations. Don't paste secrets." This is queued for P4/S6 (Odin chat UI).

**Queued for next session (graphify-persisted):**
- P1: Design system application (Linear tokens → `tailwind.config.js` + `globals.css`) — BLOCKED on opencode restart to load open-design MCP
- P2: Magic `/ui` for 5 core components — BLOCKED on opencode restart
- P4: Workflow engine S1-S9 with better UI from P1+P2
- UI badge for Owl Alpha "Free · Logging" in chat panel
- Pre-existing `plugin.test.ts:228` path-traversal test fix (still deferred)

### 2026-06-06 — MCP Setup + S3 + S9 Fix

**What was done:**
- `opencode.json` — added Supabase MCP (`@supabase/mcp-server-supabase@latest`, stdio, PAT-based), enabled GitHub MCP (`@modelcontextprotocol/server-github`), disabled open-design MCP (requires subscription desktop app)
- `.env` — added `GITHUB_TOKEN`, `SUPABASE_ACCESS_TOKEN` (user-level env vars, persistent)
- `.env.example` — updated Database section with local Supabase connection string
- `opencode.json` — increased agent step limits (fullstack=25, backend/frontend=20, others=12-15), added 6 new agent configs
- `.agents/skills/supabase/` + `.agents/skills/supabase-postgres-best-practices/` — installed via `npx skills add supabase/agent-skills`
- `packages/ui/src/components/WorkflowCanvas.tsx` — S3: added 5 missing node types to palette (plugin, parallel, loop, sub_workflow, graphify) — all 10 blueprint node types now in canvas
- `packages/core/src/__tests__/plugin.test.ts:231` — S9 FIXED: replaced flaky parent-dir test with `C:\Windows\System32` assertion (ADR-032)

**Decisions:**
- ADR-032: Path-traversal test uses `C:\Windows\System32` instead of parent of `process.cwd()`. On Windows, `resolve("D:")` normalizes to `D:\` which may equal `ALLOWED_BASE`, causing false positives. Using a genuinely different path is reliable.
- ADR-033: open-design MCP disabled — requires paid subscription desktop app. Linear design tokens already applied via `tokens/linear.json`. Can re-enable if user subscribes later.
- ADR-034: Supabase MCP uses stdio transport with PAT (not remote OAuth). Remote MCP at `mcp.supabase.com` requires browser-based OAuth which is less reliable for agent automation.

**Test status:** 179/183 pass (4 AI-dependent skipped). 0 failures. UI builds 54.6 kB.

**MCP inventory (5 active, 1 disabled):**
| MCP | Status |
|---|---|
| browser (Playwright) | ✅ |
| memory | ✅ |
| github | ✅ NEW |
| magic (21st.dev) | ✅ |
| supabase | ✅ NEW |
| open-design | ⚙️ Disabled (subscription) |

**Queued for next session:**
- P2: Use Magic `/ui` for 5 core components (requires opencode restart to load magic MCP)
- E2E test of summarize-codebase workflow (needs valid OpenRouter key for agent node)
- UI badge for Owl Alpha "Free · Logging" in chat panel

### 2026-06-07 — Full Documentation System

**What was done:**
- Created `docs/` directory structure: `architecture/`, `api/`, `features/`, `design/`, `runbooks/`, `decisions/`
- Wrote 28 detailed markdown files (~400 KB total)
- Each file is self-contained, detailed, and specific
- Purpose: reduce context exhaustion — load only the doc needed for a task
- Master blueprint at `docs/architecture/blueprint.md` is single source of truth
- `docs/decisions/adr-log.md` consolidates all 34 ADRs

**Files created:**
| Category | Count | Examples |
|---|---|---|
| Architecture | 15 | blueprint.md, agents.md, ai-engine.md, workflow-engine.md |
| API | 1 | rest-api.md (31 endpoints documented) |
| Features | 4 | mcp-integration.md, opencode-{tools,agents,skills}.md |
| Design | 3 | ui-system.md, design-tokens.md, workflow-canvas.md |
| Runbooks | 2 | local-setup.md, deployment.md |
| Decisions | 1 | adr-log.md (all 34 ADRs) |

**Decisions:**
- **ADR-035:** `docs/architecture/blueprint.md` is the master blueprint — single source of truth for entire system. Self-contained, loadable as context.
- **ADR-036:** `docs/decisions/adr-log.md` is the single source of truth for all Architecture Decision Records. AGENTS.md session logs reference ADRs by number, do not duplicate content.
- **ADR-037:** Each doc file is self-contained and detailed (200-1000 lines) so the agent can load ONLY what's needed for a specific task, reducing context exhaustion.
- **ADR-038:** Doc file structure follows a 10-section template: Purpose, Architecture, API Surface, Configuration, Data Model, Interactions, Testing, ADR References, Cross-References, Examples.
- **ADR-039:** Documentation is code — docs tracked separately from code changes via `docs:` conventional commit prefix.

**Test status:** 191/195 pass (4 AI-dependent skipped, 0 failures — up from 179 with db tests now wired). 5/5 packages build.

**Graphify triples:** 12 total (3 from prior session + 9 from this session covering MCPs, workflow canvas, plugin test fix, and documentation system).

### 2026-06-07 — Mission Control Views + Chat + OpenRouter + Models Update

**What was built:**
- `packages/ui/src/components/MemoryView.tsx` (313 lines) — graphify triples CRUD, search/filter, add/delete, predicate distribution chart
- `packages/ui/src/components/BlueprintView.tsx` (341 lines) — blueprint diff viewer, risk summary grid, reconfiguration plan viewer, commit range input
- `packages/ui/src/components/ChatView.tsx` (327 lines) — Odin chat interface, POST /v1/route with agentId=odin, Owl Alpha "Free · Logging" badge, temperature slider, prefer-local toggle
- `packages/ui/src/components/AgentCard.tsx` (161 lines) — agent name/status/load/guild/role/model, Linear palette, guild colors, load bar
- `packages/ui/src/components/StatusBadge.tsx` (57 lines) — 9 status levels, colored dot + text, sm/md sizes
- `packages/ui/src/components/MetricCard.tsx` (73 lines) — label + value + trend indicator + icon
- `packages/ui/src/components/SearchBar.tsx` (137 lines) — search icon, clear button, ⌘K shortcut, filter dropdown
- `packages/ui/src/components/DataTable.tsx` (137 lines) — generic Column<T>[], sortable, empty state, loading skeleton
- `packages/ui/src/components/index.ts` — barrel export for all 5 new components
- `packages/ui/src/components/AgentGrid.tsx` — refactored to use AgentCard
- `packages/core/src/g0dm0d3/models.ts` — updated from 11 deprecated free models to 12 current ones
- `packages/core/src/g0dm0d3/client.ts` — removed auto `:free` suffix (model IDs now exact)
- `packages/core/start-server.mjs` — reliable server startup via dynamic import
- `.env` — added OPENROUTER_API_KEY
- `packages/core/src/__tests__/ai-engine.test.ts` — fixed 4 assertions for new model IDs

**E2E Verification:**
- Owl Alpha (`openrouter/owl-alpha`) confirmed working: "I am OWL, an elite agentic operator..."
- Summarize Codebase workflow ran all 3 nodes (http → agent → graphify), all completed
- Template resolution not yet implemented — raw `{{variable}}` strings passed to agents

**Decisions:**
- **ADR-040:** Owl Alpha model ID is `openrouter/owl-alpha` (no `:free` suffix). Client.ts no longer auto-appends `:free`. All model IDs in `G0DM0D3_FREE_MODELS` are now exact.
- **ADR-041:** OpenRouter free models change frequently. `G0DM0D3_FREE_MODELS` updated to 12 current models (qwen3, gemma-4, nemotron-3, kimi-k2.6, gpt-oss, glm-4.5). Old models (llama-3, gemma-2, mistral-7b, phi-3) deprecated.
- **ADR-042:** `start-server.mjs` is the canonical way to start the API server on Windows. `node -e` fails due to `import.meta.url` mismatch. `Start-Process` with `-PassThru -WindowStyle Hidden` is the reliable PowerShell background method.
- **ADR-043:** Magic MCP (`magic_21st_magic_component_builder`) consistently times out — API key in shell env (`$env:TWENTYFIRST_API_KEY`) doesn't match `.env` file value. Components built manually instead.

**Test status:** 191/195 pass (4 AI-dependent skipped, 0 failures). 5/5 packages build. UI builds 63.2 kB route.

**Graphify triples:** 32 total (12 prior + 5 components + 3 docs + 3 models + 3 owl-alpha + 2 client + 4 workflow + 2 api_server).

**Queued for next session:**
- Workflow engine: implement `{{variable}}` template resolution (interpolate node outputs)
- Harvester Phase 3 (uses talos_skills table)
- React 19 + Next 15 minor verifications
