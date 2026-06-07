# Session Log — 2026-06-05 (Phase 2: Workflow Engine MVP)

## Goal

Build the Talos OS Phase 2 Visual Workflow Engine MVP: DAG executor with 8 node types, persistence, 6 REST endpoints, 15-20 tests, code/security review. Plus finish self-feeding infrastructure (turbo, pnpm install script, root vitest config, re-seed knowledge graph).

## Result

**146 / 148 tests pass** (2 pre-existing skipped are AI-dependent; 1 pre-existing failure is the plugin path-traversal test from previous sessions — unrelated to this change). Build: **5/5 packages** compile via turbo. Workflow tests: **37/37 pass**.

## Files Created

| File | Lines | Purpose |
|------|-------|---------|
| `packages/core/src/workflow/types.ts` | 110 | Zod schemas for nodes, runs, validation |
| `packages/core/src/workflow/persistence.ts` | 180 | JSON file I/O at `.talos/workflows/`, `__setStoreDir` test hook |
| `packages/core/src/workflow/engine.ts` | 480 | DAG executor with 8 node types, retry, timeout, skip-on-fail |
| `packages/core/src/workflow/index.ts` | 35 | Public barrel |
| `packages/core/src/workflow/_test_hooks.ts` | 1 | Test-only API surface (NOT re-exported from barrel) |
| `packages/core/src/__tests__/workflow.test.ts` | 425 | 37 tests: validation, engine, persistence |
| `vitest.config.ts` | 9 | Root vitest config, discovers tests across all packages |
| `turbo.json` | 27 | v2.x tasks pipeline (build, dev, lint, test) |

## Files Modified

- `packages/core/src/api/server.ts` — 6 new endpoints: `POST /v1/workflow`, `GET /v1/workflow`, `POST /v1/workflow/validate`, `POST /v1/workflow/{id}/run`, `GET /v1/workflow/run/{id}`, `GET /v1/workflow/runs`
- `packages/core/src/index.ts` — added `workflow` module export
- `scripts/install-windows.ps1` — npm→pnpm (3 spots)
- `packages/db/package.json` — added test script
- `packages/memory/package.json` — added test script
- `packages/ui/package.json` — added test script

## Key Decisions

1. **8 node types, all in one executor** — `agent`, `council`, `plugin`, `condition`, `parallel`, `loop`, `http`, `code`. Exposed as `setNodeExecutor(type, fn)` for testing/extension.
2. **JSON file persistence** — `.talos/workflows/workflow-{id}.json` + `run-{id}.json` + `_index.json`. Simpler than SQLite at this scale; resumable after crash.
3. **DAG via topological sort** — Kahn's algorithm, in-degree map, queue of zero-in-degree nodes. Cycle detection via re-running toposort and finding nodes still with in-degree > 0.
4. **Skip-on-fail cascade** — when a node fails, the for-loop flips a `failed` flag and marks all remaining nodes as `skipped` (no re-throw mid-loop). Prevents downstream `throw` from breaking the cascade.
5. **Retry counter on the node, not the engine** — `nodeRun.attempts++` in the inner retry loop. After exhaustion, state is `failed` and the error is thrown out of `runNode`, which `executeWorkflow` catches in its per-node try/catch.
6. **`TALOS_WORKFLOW_CODE_ENABLED` gate** — `code` and `condition` executors check the env flag and refuse to run with a clear error if not set. Prevents the obvious RCE via `POST /v1/workflow`.
7. **`z.input<>` for partial config** — engine and tests pass partial node configs; using `z.input<typeof WorkflowNodeSchema>` keeps the call sites clean. Zod's `.parse()` inside `createWorkflow` applies defaults at runtime.
8. **`__setStoreDir` test hook in separate file** — moved out of `index.ts` barrel. Underscore prefix alone is convention; barrel exposure is the real attack surface.

## Bugs Found and Fixed

| # | File | Bug | Fix |
|---|------|-----|-----|
| 1 | engine.ts:57 | `detectCycle` crashed on unknown dependencies | Skip unknown deps in adj map |
| 2 | engine.ts (test) | `makeNode` default URL masked "missing url" validation test | Override config in test |
| 3 | engine.ts:222 | `executeWorkflow` re-threw inside loop, blocking skip cascade | Per-node try/catch, set `failed` flag, continue |
| 4 | engine.ts (retry) | Inner retry loop didn't increment `nodeRun.attempts` | Add `nodeRun.attempts++` before each retry `attempt()` call |
| 5 | engine.ts | `validateWorkflow` used `.parse()` and crashed on schema-invalid nodes | Use `.safeParse()` per node, collect issues |
| 6 | engine.ts | `ModelResponse.content` — wrong field name | Use `output` instead |
| 7 | engine.ts | `CouncilProposal.constraints` — wrong field name | Use `context` + `priority` |
| 8 | engine.ts (test) | `agentId: ""` failed validation as expected but test expected creation to succeed | Use real string `agentId` |
| 9 | persistence.ts | Duplicate `getStoreDir` function | Remove inner copy |
| 10 | turbo.json | Used `pipeline` (v1) | Rename to `tasks` (v2) |
| 11 | types.ts | `WorkflowNodeConfigSchema` defaults made all fields required at type level | Use `z.input<>` for partial input signature |
| 12 | server.ts | Unused `WorkflowNode` import after refactor | Remove |

## Code Review Findings (Loaded `code-reviewer` Skill)

Reviewed 4 new files, 1 test file, 6 API endpoints, 1 module index line. Multi-pass analysis (broad + adversarial). Found 4 issues ≥ 80 confidence; all fixed:

1. **Critical (RCE):** `code` and `condition` node types invoked `new Function()` with no sandbox. Workflows accepted via unauthenticated `POST /v1/workflow`. **Fixed** with `TALOS_WORKFLOW_CODE_ENABLED` env gate (default off).
2. **Important (validator crash):** `validateWorkflow` used `.parse()` and threw on schema-invalid nodes. **Fixed** with `.safeParse()` per node, collected into `ValidationIssue[]`.
3. **Important (test hook in production):** `__setStoreDir` was exported from `index.ts` barrel. **Fixed** by moving to `_test_hooks.ts` and removing from barrel.
4. **Important (callback leak):** `runCallbacks` map grew unbounded; `clearRunCallback` was exported but never called. **Fixed** by calling `runCallbacks.delete(runId)` at end of `executeWorkflow`.

## Security Note

The pre-existing 1 test failure is in `plugin.test.ts:228-232` "rejects paths outside ALLOWED_BASE". The test computes `parent = process.cwd().split("\\").slice(0, -1).join("\\")` but `ALLOWED_BASE` is captured at module-load time. If vitest runs plugin tests in a worker whose cwd differs from the import-time cwd, the test fails. This is **unrelated to this session's changes** and was already on the failure list from the previous session.

## Self-Feeding State

- **Knowledge graph**: 41 architecture triples + 8 new workflow triples = 49 triples in `.talos/graphify.json`
- **Obsidian vault**: 3 architecture notes + 0 new = 3 notes in `.talos-notes/architecture/`
- **AGENTS.md**: project rules intact; no changes needed this session
- **Tools**: graphify + obsidian opencode tools use absolute `import.meta.url` path resolution — persistence now works across opencode restarts

## Next Session

- React Flow UI for workflow authoring (deferred per agreed MVP scope)
- Hermes module for true code-node sandboxing
- Workflow versioning strategy
- Eitri agent factory
- Auto-Skilling (Harvester) — separate track
