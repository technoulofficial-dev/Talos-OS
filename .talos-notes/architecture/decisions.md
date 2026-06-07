# Architecture Decisions Log

> **Note (2026-06-07):** This file is a brief summary. The canonical, full ADR log is at `D:\Talos OS\docs\decisions\adr-log.md` (ADR-036). New ADRs go there. This file is kept for historical reference only.

## 2026-06-05

### ADR-001: AI Engine Waterfall
Single canonical router at `packages/core/src/ai-engine/router.ts`. 4-tier waterfall: Ollama local → G0DM0D3 LAN peers → OpenRouter free → NVIDIA NIM. Unreliable providers (KeylessAI, FreeTheAI) are opt-in behind `FEAT_*` env flags.

### ADR-002: Budget Gate
Integrated into `routeUnlimited()` — cloud calls go through `budgetDecide()` with monthly ($50), hourly ($5), per-task (100k tokens), rate-limit (30 req/min) checks. Hard kill at 95%.

### ADR-003: Council Parallel Execution
5 advisors (Strategist, Architect, Researcher, Sentinel, Quality) run in parallel via `Promise.allSettled` — no debate phase. Graceful degradation: if AI provider down, advisor returns fallback report with `score: 0`, `recommendation: "defer"`. Chairman synthesizes into structured verdict.

### ADR-004: MCP Handler via HTTP
MCP uses HTTP (not stdio JSON-RPC) for Phase 1 — simpler integration with existing sandbox/hermes patterns. Full stdio MCP deferred.

### ADR-005: Plugin Lifecycle State Machine
`discovered → registered → active → inactive → failed → removed` with health check polling.

### ADR-006: Graphify In-Memory Store
Array-backed with optional JSON file persistence at `.talos/graphify.json`. Supports triple CRUD, multi-field filtering, pagination, DFS path-finding.

### ADR-007: Zod Defaults Bug
`queryTriples()` must coerce `offset`/`limit` with `??` fallback because Zod defaults only apply on schema parse, not on raw object access. Type fix: use `z.input<>` instead of `z.infer<>` for function parameters that accept partial data.

### ADR-008: Self-Feeding Infrastructure
Obsidian vault (`.talos-notes/`) for narrative memory, Graphify for relational memory, MCP Memory for cross-session key-value persistence, AGENTS.md as the canonical instruction manual. Skills loaded proactively by task type.

### ADR-009: Absolute Path Resolution for Opencode Tools
Opencode tools run in a child process whose `process.cwd()` is not the project root. All opencode tools (`graphify`, `obsidian`) MUST resolve paths relative to the workspace root using `import.meta.url` → walk up to find `package.json` with `talos-os` name. Env override `TALOS_GRAPHIFY_PATH` and `TALOS_VAULT_PATH` for customization.

### ADR-010: Workflow Engine First, UI Later
Phase 2 starts with the core DAG executor (engine + persistence + 5 API endpoints + 8 node types + 15-20 tests). React Flow UI is deferred to a later session. The blueprint's 4-6 week estimate is for the full phase; the engine core alone is 1-2 days.

### ADR-011: Workflow Persistence Strategy
Each `WorkflowRun` is checkpointed to `.talos/workflows/<id>.json` on every node state transition. Resumable after crash. JSON format chosen over SQLite for human-readability and zero-dep simplicity at this stage.

## Pending Decisions

- Plugin code execution sandboxing (use Docker? Hermes module? Node's vm?)
- Workflow versioning strategy (append-only? numbered snapshots?)
- Eitri agent fabrication pipeline (separate phase, not yet started)
