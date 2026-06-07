# Architecture Decision Records — Talos OS v8.0

Single source of truth for all Architecture Decision Records (ADRs).

## 1. Purpose

ADRs capture significant architectural decisions made during Talos OS development.
Each record provides context, the decision, and its consequences — enabling future
contributors to understand *why* the codebase looks the way it does.

---

## 2. ADR Format

Each ADR follows this structure:

```markdown
### ADR-NNN: Title

- **Status:** Accepted | Deprecated | Superseded by ADR-XXX
- **Date:** YYYY-MM-DD
- **Author:** (who proposed it)

**Context:** What situation or problem prompted this decision?

**Decision:** What was decided.

**Consequences:** What are the trade-offs and implications.
```

---

## 3. ADR Log

### ADR-001: Project Scaffolding

- **Status:** Accepted
- **Date:** 2026-05-01

**Context:** Starting Talos OS v8.0 from scratch. Need a clean monorepo structure.

**Decision:** Create a pnpm workspace monorepo with 5 packages: core, db, cli, memory, ui.
Use TypeScript strict mode, ESM imports, and Zod for validation.

**Consequences:**
- Clean separation of concerns
- Shared tooling (TypeScript, vitest, turbo)
- Dependency graph: core → db → memory; ui → core

---

### ADR-002: Monorepo with pnpm Workspaces

- **Status:** Accepted
- **Date:** 2026-05-01

**Context:** Need to manage multiple interdependent packages efficiently.

**Decision:** Use pnpm workspaces (v9.15.0) with turbo for build orchestration.

**Consequences:**
- Fast installs (strict mode, no phantom deps)
- Workspace protocol for internal deps (`@talos/core@workspace:*`)
- Turbo handles build ordering via `dependsOn: ["^build"]`

---

### ADR-003: TypeScript Strict Mode

- **Status:** Accepted
- **Date:** 2026-05-01

**Context:** Need type safety across the entire codebase.

**Decision:** Enable TypeScript strict mode in all packages.

**Consequences:**
- `strictNullChecks`, `noUncheckedIndexedAccess`, `noImplicitReturns`
- More explicit null handling (required `!` assertions in hot paths)
- Catches bugs at compile time that would otherwise be runtime errors

---

### ADR-004: Zod for Validation

- **Status:** Accepted
- **Date:** 2026-05-01

**Context:** Need runtime validation for API inputs, config, and workflow nodes.

**Decision:** Use Zod for all schema validation. Define schemas as the source of truth; derive TypeScript types from them.

**Consequences:**
- Single source of truth (schema → type)
- Runtime validation at API boundaries
- `z.input<>` for partial data, `z.infer<>` for post-default types (ADR-013)

---

### ADR-005: Vitest for Testing

- **Status:** Accepted
- **Date:** 2026-05-01

**Context:** Need a fast, modern test runner for TypeScript.

**Decision:** Use Vitest with the root config for all packages.

**Consequences:**
- Native ESM support
- Watch mode for development
- Coverage via v8 provider
- `vi.useFakeTimers()` for date-dependent tests (ADR-020)

---

### ADR-006: ESM Imports

- **Status:** Accepted
- **Date:** 2026-05-01

**Context:** Node.js ecosystem is moving to ESM. Need consistent module resolution.

**Decision:** Use ESM (`"module": "NodeNext"` in tsconfig) with `.js` extensions in imports.

**Consequences:**
- `import { foo } from "./bar.js"` (not `./bar.ts` or `./bar`)
- Compatible with Node.js native ESM
- Requires `.js` extension in all import paths

---

### ADR-007: Docker Multi-Stage Builds

- **Status:** Accepted
- **Date:** 2026-05-01

**Context:** Need minimal production Docker images for the Core orchestrator.

**Decision:** Use multi-stage Docker builds: base → deps → builder → runner.

**Consequences:**
- Final image contains only dist + node_modules (no source, no devDeps)
- Smaller attack surface
- Faster pulls and deploys
- 4 stages ensure clean separation

---

### ADR-008: Supabase for Database

- **Status:** Accepted
- **Date:** 2026-05-01

**Context:** Need a PostgreSQL database with auth, real-time, and vector search.

**Decision:** Use Supabase (hosted or self-hosted) for the database layer.

**Consequences:**
- PostgreSQL with pgvector for embeddings
- Row Level Security for multi-tenant isolation
- Supabase JS client for API access
- Local dev via Docker compose (supabase/postgres image)

---

### ADR-009: ReactFlow for Workflow Canvas

- **Status:** Accepted
- **Date:** 2026-05-01

**Context:** Need a visual workflow builder for the Mission Control UI.

**Decision:** Use ReactFlow 11 (`reactflow` package) for the drag-and-drop canvas.

**Consequences:**
- Built-in minimap, controls, background
- Custom node types via `NODE_TYPES` array
- Edge connection defines dependency order
- Read-only mode for viewing workflow runs

---

### ADR-010: Tailwind CSS for Styling

- **Status:** Accepted
- **Date:** 2026-05-01

**Context:** Need a consistent styling system for the Mission Control UI.

**Decision:** Use Tailwind CSS with Linear-themed design tokens.

**Consequences:**
- Utility-first approach
- Design tokens in `tailwind.config.js` (colors, fonts, animations)
- Component classes in `globals.css` (`@layer components`)
- Bronze-Punk legacy palette retained for backward compatibility

---

### ADR-011: Test Hooks in `_test_hooks.ts`

- **Status:** Accepted
- **Date:** 2026-06-05

**Context:** Tests need to override internal state (e.g., `storeDir` for persistence).
Exposing these via the production barrel creates a security and API surface risk.

**Decision:** Place test hooks (e.g., `__setStoreDir`) in `_test_hooks.ts` files, NOT re-exported from the production barrel (`index.ts`).

**Consequences:**
- Test hooks are accessible via direct import (`../workflow/_test_hooks.js`)
- Production bundle does not include test hooks
- Underscore prefix is convention, but barrel exposure is the real attack surface
- Tests that need hooks must import from the `_test_hooks.ts` file directly

---

### ADR-012: Code/Condition Nodes Gated Behind Env Flag

- **Status:** Accepted
- **Date:** 2026-06-05

**Context:** `code` and `condition` node types execute arbitrary JavaScript via `new Function()`.
This is an RCE vector if an unauthenticated user can POST to `/v1/workflow`.

**Decision:** Gate both node types behind `TALOS_WORKFLOW_CODE_ENABLED=true` (default OFF).
When disabled, execution throws: `"code node is disabled: set TALOS_WORKFLOW_CODE_ENABLED=true to enable arbitrary JS evaluation"`.

**Consequences:**
- Prevents RCE via unauthenticated workflow creation
- Default OFF means production is safe out of the box
- Developers can enable locally for testing
- Both `code` and `condition` nodes are affected

---

### ADR-013: Use `z.input<>` for Partial Data

- **Status:** Accepted
- **Date:** 2026-06-05

**Context:** Functions accepting partial data (e.g., `createWorkflow`) need to accept
incomplete objects that Zod will fill with defaults. `z.infer<>` returns the post-default
type where all defaultable fields are required, breaking call sites.

**Decision:** Use `z.input<typeof Schema>` for function parameters accepting partial data.
Reserve `z.infer<>` for post-parse types.

**Consequences:**
- `z.input<>` makes defaultable fields optional
- `z.infer<>` makes all fields required (post-default)
- Call sites can pass partial objects without type errors
- Applied to `createWorkflow`, `validateWorkflow`, and similar functions

---

### ADR-014: `import.meta.url` for Path Resolution

- **Status:** Accepted
- **Date:** 2026-06-05

**Context:** `.opencode/tools/*.ts` files need absolute paths. `process.cwd()` is NOT
the project root in the opencode plugin runtime — it may be the user's home directory.

**Decision:** Use `import.meta.url` + walk-up directory traversal for absolute path resolution.

**Consequences:**
- `new URL("../../..", import.meta.url)` walks up from tool file to project root
- Works regardless of CWD
- More reliable than `process.cwd()` in plugin runtimes
- Pattern documented in `.opencode/tools/*.ts` files

---

### ADR-015: parallel/loop Kept as Non-Blueprint Extensions

- **Status:** Accepted
- **Date:** 2026-06-05

**Context:** The blueprint defines specific node types. `parallel` and `loop` are not in the blueprint
but were implemented for practical workflow needs.

**Decision:** Keep `parallel` and `loop` as non-blueprint extensions. Document them as such.

**Consequences:**
- 10 node types total (8 blueprint + 2 extensions)
- Breaking strict blueprint alignment would have broken existing tests
- Extensions are clearly marked in documentation
- Future blueprint versions may incorporate them officially

---

### ADR-016: Skills Table is CRUD-Only

- **Status:** Accepted
- **Date:** 2026-06-05

**Context:** The `talos_skills` table was created in migration 0002. The Harvester
(Phase 3) that would auto-populate it is not yet implemented.

**Decision:** Skills table is CRUD-only this session. No Harvester integration yet — keep blast radius small.

**Consequences:**
- `packages/db/src/skills.ts` provides: register, get, list, updateSuccessRate, promoteToCached
- Tests use injected mock client
- Harvester integration deferred to Phase 3
- Table schema matches blueprint §12.2

---

### ADR-017: Compact Ritual Must Run Before Drift Fixes

- **Status:** Accepted
- **Date:** 2026-06-05

**Context:** Multi-session development loses context between sessions.
Drift fixes may make wrong assumptions without prior context.

**Decision:** Always run the compact ritual (session_start → work → session_end) before starting drift fixes.

**Consequences:**
- Next session inherits context from session logs
- Prevents duplicate work
- Ensures ADRs are captured before code changes
- Ritual tools: `session_start`, `session_end`, `capture_learning`

---

### ADR-018: Workflow Persistence Dual-Mode

- **Status:** Accepted
- **Date:** 2026-06-05

**Context:** Workflow engine needs persistence but 40+ existing tests use in-memory state.
Adding Supabase dependency would break all existing tests.

**Decision:** Workflow persistence is dual-mode:
- **Default:** JSON files at `.talos/workflows/` (tested, works offline)
- **Opt-in:** Supabase via `TALOS_WORKFLOW_DB_ENABLED=true` (production)

**Consequences:**
- All 40+ existing workflow tests pass without Supabase
- Production can use real DB matching blueprint §3.5/§20
- `persistence.ts` delegates to `@talos/db` when DB mode is enabled
- JSON path unchanged; DB mode returns sentinel `"supabase://talos_workflows"`

---

### ADR-019: `@talos/db` Defines Structural Types Locally

- **Status:** Accepted
- **Date:** 2026-06-05

**Context:** `@talos/db` provides database functions that accept typed parameters.
Importing types from `@talos/core` would create a circular dependency.

**Decision:** `@talos/db` defines structural types (`WorkflowDefinitionDb`, `WorkflowRunDb`,
`NodeRunStateDb`) locally, NOT importing from `@talos/core`.

**Consequences:**
- Clean dependency graph: db is lower-level than core
- `persistence.ts` casts at the boundary (`as unknown as WorkflowDefinitionDb`)
- Structural types match Supabase schema exactly
- Types are in `packages/db/src/skills.ts` and `packages/db/src/workflows.ts`

---

### ADR-020: Date-Brittle Tests Use `vi.useFakeTimers()`

- **Status:** Accepted
- **Date:** 2026-06-05

**Context:** Tests that derive dates from `new Date()` break when the system clock
rolls over midnight during test execution.

**Decision:** Pin the system clock with `vi.useFakeTimers()` in `beforeEach` for any
tests that assert date-dependent values (filenames, timestamps).

**Consequences:**
- `vi.useFakeTimers()` in `beforeEach`, `vi.useRealTimers()` in `afterEach`
- Pin to a specific timestamp (e.g., `new Date("2026-06-05T15:00:00Z")`)
- Applied to `rituals.test.ts` and any future date-dependent tests
- Prevents flaky CI failures

---

### ADR-021: open-design Daemon is Desktop App

- **Status:** Accepted
- **Date:** 2026-06-06

**Context:** The open-design MCP requires a running daemon. The daemon is part of
a desktop application, not a standalone npm package.

**Decision:** `pnpm od:open` launches the desktop GUI; the daemon starts automatically on port 7456.
`pnpm od:install` opens the GitHub releases page for manual download.

**Consequences:**
- `od:start` would be misleading — the daemon is not started separately
- `od:open` is the correct command (launches GUI, daemon comes up)
- `od:install` opens the download page (not an npm install)
- Requires paid subscription (currently disabled in opencode.json)

---

### ADR-022: Use `${env:VAR}` opencode Interpolation Syntax

- **Status:** Accepted
- **Date:** 2026-06-06

**Context:** opencode.json MCP configurations need to pass environment variables.
The syntax for variable interpolation needed to be determined.

**Decision:** Use `${env:VAR}` syntax (not `${VAR}`) for environment variable interpolation in opencode.json.

**Consequences:**
- Matches the existing `github` MCP's `GITHUB_TOKEN` reference
- Verified by reading `opencode.json` line 21
- Environment variables must be set in the shell before running opencode
- No auto-loading of `.env` from opencode.json (ADR-023)

---

### ADR-023: Don't Auto-Load `.env` from opencode.json

- **Status:** Accepted
- **Date:** 2026-06-06

**Context:** Some MCP servers need env vars. Auto-loading `.env` would create
implicit dependencies and potential security issues.

**Decision:** Do not auto-load `.env` from opencode.json. Document env-var setup
in install scripts and require the user to set vars in their shell.

**Consequences:**
- Consistent with existing `GITHUB_TOKEN` flow
- Users must set env vars before running opencode
- Install scripts (PowerShell, Bash) show post-install instructions
- No secrets leaked via `.env` file auto-loading

---

### ADR-024: PowerShell 5.1 Unicode Limitation

- **Status:** Accepted
- **Date:** 2026-06-06

**Context:** `scripts/design-tools.ps1` failed to parse on Windows PowerShell 5.1
with `Unexpected token '{' in expression or statement` errors.

**Decision:** Replace all non-ASCII characters in double-quoted strings with ASCII equivalents.
Use em-dash `—` → `--`, checkmarks `✓` `✗` → `[OK]` `[FAIL]`, arrows `→` -> `->`.

**Consequences:**
- PowerShell 5.1 parser breaks on Unicode chars in double-quoted strings
- PowerShell 7+ does not have this issue
- Talos targets PS 5.1 for maximum Windows compatibility
- Workaround: use ASCII or `-f` format strings for non-trivial formatting

---

### ADR-025: Work on Main Branch

- **Status:** Accepted
- **Date:** 2026-06-06

**Context:** The working tree has 30+ modified and 60+ untracked files from prior MVE drift.
Creating a clean feature branch would require stashing/committing work the user did not ask to commit.

**Decision:** Work on `main` branch (not a feature branch).

**Consequences:**
- Avoids stashing/committing untracked work
- User can branch later if needed
- All changes go directly to main
- Acceptable for solo development with frequent manual backups

---

### ADR-026: Owl Alpha opt-OUT Semantics

- **Status:** Accepted
- **Date:** 2026-06-06

**Context:** Owl Alpha on OpenRouter is a free-tier model optimized for agentic tasks.
The default "opt-in" pattern (`FEAT_*` flags) would leave it disabled by default,
missing $0 agentic inference.

**Decision:** Owl Alpha uses opt-OUT semantics: `TALOS_OWL_ALPHA_ENABLED=true` by default.
Set to `false` to disable. Opposite of `FEAT_*` opt-in pattern.

**Consequences:**
- Costs $0 (free tier)
- Agentic-optimized model
- Users handling sensitive data can disable via env var
- Default ON means most users get agentic inference out of the box

---

### ADR-027: Owl Alpha Uses Existing g0dm0d3 Pipeline

- **Status:** Accepted
- **Date:** 2026-06-06

**Context:** Owl Alpha runs on OpenRouter, which is the same provider as g0dm0d3.
Creating a separate provider would duplicate code and budget tracking.

**Decision:** Owl Alpha uses the existing `executeG0DM0D3Cloud` pipeline.
The `provider` field stays `"g0dm0d3"`; the `model` field shows `openrouter/owl-alpha:free`.

**Consequences:**
- Budget code path unified
- No duplicate g0dm0d3 client
- UI can distinguish via the `model` field
- Same rate limiting and error handling as g0dm0d3

---

### ADR-028: Owl Alpha Inserted After Local + LAN Peers

- **Status:** Accepted
- **Date:** 2026-06-06

**Context:** The router has a waterfall of providers. Owl Alpha's position needed
determination — before or after local inference?

**Decision:** Insert Owl Alpha AFTER local Ollama + G0DM0D3 LAN peers, but BEFORE the existing g0dm0d3 cloud call.

**Consequences:**
- Local-first invariant preserved (Ollama, LAN peers first)
- Owl Alpha is "cloud-free top tier" — best free cloud option
- Existing g0dm0d3 (Llama 3.1) becomes fallback when Owl Alpha fails or is disabled
- Waterfall: Ollama → LAN peers → Owl Alpha → g0dm0d3 → opt-in providers → NVIDIA NIM

---

### ADR-029: Bracket Access for Env Vars in Tests

- **Status:** Accepted
- **Date:** 2026-06-06

**Context:** TypeScript strict mode + `noUncheckedIndexedAccess` + index signature rules
require explicit handling when accessing `process.env`.

**Decision:** Use `process.env["TALOS_OWL_ALPHA_ENABLED"]` (bracket access) and non-null
assertion (`!`) on indexed access in test files.

**Consequences:**
- `process.env["KEY"]` returns `string | undefined` (safe)
- `process.env.KEY` may fail with index signature errors
- Non-null assertion (`!`) used on `G0DM0D3_FREE_MODELS[0]` where invariant is known
- Pattern to back-port to other env-var tests

---

### ADR-030: Tailwind UPPERCASE DEFAULT Key

- **Status:** Accepted
- **Date:** 2026-06-06

**Context:** Tailwind CSS requires `DEFAULT` (uppercase) for bare color values.
Using lowercase `default` generates a sub-key, not a bare color.

**Decision:** All Tailwind color groups must use `DEFAULT` (uppercase) for the default value.

**Consequences:**
- `"linear-bg": { DEFAULT: "#08090A" }` → `bg-linear-bg` works
- `"linear-bg": { default: "#08090A" }` → `bg-linear-bg` does NOT work
- Enforced in `tailwind.config.js` and documented in design-tokens.md
- Common gotcha for new contributors

---

### ADR-031: apply-design-system.js Strip-Then-Insert Pattern

- **Status:** Accepted
- **Date:** 2026-06-06

**Context:** Design tokens need to be injected from `tokens/linear.json` into
`tailwind.config.js` and `globals.css`. Simple string replacement is fragile.

**Decision:** The `scripts/apply-design-system.js` script uses a strip-then-insert pattern:
1. Strip existing token sections from target files
2. Insert fresh tokens from JSON

**Consequences:**
- Tokens are always in sync with the JSON source
- No manual editing of Tailwind config or CSS
- Safe to re-run after manual edits (strips and re-inserts)
- Script is idempotent

---

### ADR-032: Path-Traversal Test Uses `C:\Windows\System32`

- **Status:** Accepted
- **Date:** 2026-06-06

**Context:** The path-traversal test in `plugin.test.ts:228` was flaky.
On Windows, `resolve("D:")` normalizes to `D:\` which may equal `ALLOWED_BASE`,
causing false positives.

**Decision:** Replace the flaky parent-dir test with `C:\Windows\System32` assertion.

**Consequences:**
- `C:\Windows\System32` is genuinely different from `ALLOWED_BASE` on all platforms
- No more false positives from `resolve("D:")` normalization
- Test is deterministic across environments
- Fixed the pre-existing `plugin.test.ts:228` failure

---

### ADR-033: open-design MCP Disabled

- **Status:** Accepted
- **Date:** 2026-06-06

**Context:** The open-design MCP requires a paid subscription desktop app.
The daemon cannot be started without the GUI installed.

**Decision:** Disable the open-design MCP in `opencode.json`. Linear design tokens
are already applied via `tokens/linear.json`.

**Consequences:**
- MCP listed as `"enabled": false` in opencode.json
- Linear design tokens are hand-curated (not extracted from Linear app)
- Can re-enable if user subscribes to open-design later
- No impact on current functionality

---

### ADR-034: Supabase MCP Uses stdio Transport with PAT

- **Status:** Accepted
- **Date:** 2026-06-06

**Context:** Supabase MCP can use remote OAuth or local stdio transport.
Remote MCP requires browser-based OAuth which is less reliable for agent automation.

**Decision:** Use stdio transport with Personal Access Token (PAT) for Supabase MCP.

**Consequences:**
- `SUPABASE_ACCESS_TOKEN` env var required
- stdio is more reliable than remote OAuth
- No browser interaction needed
- PAT can be revoked independently

---

## 4. Pending Decisions

These topics are under discussion or deferred:

| Topic | Status | Notes |
|-------|--------|-------|
| Redis for shared session state | Deferred | Needed for horizontal scaling |
| Harvester Phase 3 integration | Deferred | Will use `talos_skills` table |
| Light mode support | Not planned | Dark-first design (ADR-030) |
| GraphQL API | Under discussion | REST is sufficient for MVE |
| WebSocket for real-time updates | Under discussion | Workflow run status could use WS |
| React 19 migration | Deferred | Current React 18 is stable |

---

## 5. Decision Log

| ADR | Date | Status | Author |
|-----|------|--------|--------|
| ADR-001 | 2026-05-01 | Accepted | Metis Corp |
| ADR-002 | 2026-05-01 | Accepted | Metis Corp |
| ADR-003 | 2026-05-01 | Accepted | Metis Corp |
| ADR-004 | 2026-05-01 | Accepted | Metis Corp |
| ADR-005 | 2026-05-01 | Accepted | Metis Corp |
| ADR-006 | 2026-05-01 | Accepted | Metis Corp |
| ADR-007 | 2026-05-01 | Accepted | Metis Corp |
| ADR-008 | 2026-05-01 | Accepted | Metis Corp |
| ADR-009 | 2026-05-01 | Accepted | Metis Corp |
| ADR-010 | 2026-05-01 | Accepted | Metis Corp |
| ADR-011 | 2026-06-05 | Accepted | opencode |
| ADR-012 | 2026-06-05 | Accepted | opencode |
| ADR-013 | 2026-06-05 | Accepted | opencode |
| ADR-014 | 2026-06-05 | Accepted | opencode |
| ADR-015 | 2026-06-05 | Accepted | opencode |
| ADR-016 | 2026-06-05 | Accepted | opencode |
| ADR-017 | 2026-06-05 | Accepted | opencode |
| ADR-018 | 2026-06-05 | Accepted | opencode |
| ADR-019 | 2026-06-05 | Accepted | opencode |
| ADR-020 | 2026-06-05 | Accepted | opencode |
| ADR-021 | 2026-06-06 | Accepted | opencode |
| ADR-022 | 2026-06-06 | Accepted | opencode |
| ADR-023 | 2026-06-06 | Accepted | opencode |
| ADR-024 | 2026-06-06 | Accepted | opencode |
| ADR-025 | 2026-06-06 | Accepted | opencode |
| ADR-026 | 2026-06-06 | Accepted | opencode |
| ADR-027 | 2026-06-06 | Accepted | opencode |
| ADR-028 | 2026-06-06 | Accepted | opencode |
| ADR-029 | 2026-06-06 | Accepted | opencode |
| ADR-030 | 2026-06-06 | Accepted | opencode |
| ADR-031 | 2026-06-06 | Accepted | opencode |
| ADR-032 | 2026-06-06 | Accepted | opencode |
| ADR-033 | 2026-06-06 | Accepted | opencode |
| ADR-034 | 2026-06-06 | Accepted | opencode |

---

## 6. ADR Categories

### Foundation (ADR-001 — ADR-010)
Project scaffolding, tooling choices, and technology stack.

### Security (ADR-012, ADR-032)
RCE prevention, path-traversal fixes, and secure defaults.

### Type System (ADR-013, ADR-029)
Zod usage patterns, TypeScript strict mode handling.

### Testing (ADR-011, ADR-020)
Test hooks, date-fakery, and test isolation.

### Architecture (ADR-015 — ADR-019, ADR-026 — ADR-028)
Blueprint alignment, persistence modes, provider routing.

### Tooling (ADR-014, ADR-021 — ADR-025, ADR-030, ADR-031, ADR-033, ADR-034)
opencode config, PowerShell compatibility, design tokens, MCP servers.
