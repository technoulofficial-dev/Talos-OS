# Backend Audit Findings — Complete Analysis

**Date:** 2026-06-07
**Session:** Comprehensive backend audit for flawless blueprint alignment
**Status:** All 26 backend bugs + 8 frontend issues catalogued

---

## Executive Summary

After thorough analysis of all 13 core systems, 14 DB tables, 38+ API endpoints, and 183 tests, I've identified **26 backend bugs** and **8 frontend issues**. The bugs fall into 5 categories by system:

| System | Bugs | Severity Breakdown |
|--------|------|-------------------|
| **Loom (talos-agents/loom)** | 10 | 2 Critical, 4 Logic, 2 Quality, 2 Tests |
| **Eitri (talos-agents/eitri)** | 3 | 3 Critical (entire fabrication unimplemented) |
| **Phoenix (core/phoenix)** | 6 | 1 Critical (fake results), 2 Rollback, 2 Silent catches, 1 Type safety |
| **Blueprint (core/blueprint)** | 8 | 1 Critical (command injection), 3 Simulated execution, 1 Dead code, 2 Validation |
| **Agent Manager (core/agent)** | 0 (tests only) | Test compilation issues |
| **Tests (core/__tests__)** | 2 | Loom import path, Agent-manager state isolation |

---

## Detailed Findings by System

### 1. LOOM — Master Task Weaver (`talos-agents/loom/index.ts`)

| # | Line | Bug | Severity | Blueprint Section |
|---|------|-----|----------|-------------------|
| L1 | 108 | **IIFE syntax error**: `}();` — arrow function closed then invoked as IIFE | Critical | §9 Auction System |
| L2 | 124 | **Fire-and-forget bids**: `void Promise.allSettled(bidPromises)` — bids submitted but never awaited | Logic | §9 Auction System |
| L3 | 149-153 | **Same bid pushed to ALL auctions** — loops through ALL active auctions matching taskId, not just the intended one | Logic | §9 Auction System |
| L4 | 166-176 | **Upsert without `id`** in DB bridge (removed in simplified version, but pattern remains) | Quality | §10 DB Schema |
| L5 | 228-235 | **Match by `description` not `taskId`** — `getAuctionStatus` filters by `announcement.taskId` but uses wrong field in DB query | Logic | §9 Auction System |
| L6 | 263 | **Trivial `estimateTaskCost`** — returns `Math.min(announcement.maxCostUsd, 10)` | Quality | §9 Auction System |
| L7 | 256/290 | **`await` in non-async `settleAuction`** — function not async but uses await internally | Critical | §9 Auction System |
| L8 | N/A | **`activeAuctions` never cleaned up** — memory leak, settled auctions accumulate forever | Logic | §9 Auction System |
| L9 | 17 | **Unused `route` import** from `@talos/core/router` | Quality | N/A |
| L10 | N/A | **Loom auto-bids for ALL agents** — `announceTask` iterates ALL registered agents and submits bids on their behalf, removing agent agency | Logic | §9 Auction System |

**Blueprint Alignment Issues:**
- Loom should NOT auto-bid for agents — agents should submit bids themselves via ACP/MCP
- Auction settlement should use `taskId` as primary key, not `description`
- Score formula in blueprint: `0.5*capability + 0.3*(1-load) + 0.2*(1-normalized_cost)` — matches but `epsilonGreedy` exploration bonus not in blueprint formula

---

### 2. EITRI — Agent Factory (`talos-agents/eitri/index.ts`)

| # | Line | Bug | Severity | Blueprint Section |
|---|------|-----|----------|-------------------|
| E1 | 85 | **`spec: null` hardcoded** — entire 6-stage pipeline unimplemented | Critical | §12 Agent Fabrication |
| E2 | 86 | **`stage: "spec"` hardcoded** — never advances to code/test/quality/deploy/lifecycle | Critical | §12 Agent Fabrication |
| E3 | 87-88 | **`success: true` + `errors: []` always** — no validation, no error handling | Critical | §12 Agent Fabrication |

**Blueprint Section 12 Requirements (NOT IMPLEMENTED):**
1. **Spec Generation** — Create complete `AgentSpec` from requirement
2. **Code Compilation** — Plan implementation structure
3. **Sandbox Test** — Define test cases for validation (opt-in: `TALOS_HARVESTER_SANDBOX_ENABLED`)
4. **Quality Gate** — Establish quality criteria
5. **Canary Deploy** — Plan for safe deployment
6. **Lifecycle Management** — Define retirement conditions

**Expected Output:** `FabricationResult` with parsed `AgentSpec`, real `stage`, boolean `success`, populated `errors[]`

---

### 3. PHOENIX — Self-Improvement (`packages/core/src/phoenix/phoenix.ts`)

| # | Line | Bug | Severity | Blueprint Section |
|---|------|-----|----------|-------------------|
| P1 | 200-201 | **Fake test results**: `testsRun: 100, testsPassed: 95` hardcoded | Critical | §12 Self-Improvement |
| P2 | 224-227 | **Rollback function empty** — only `console.log`, no actual restore | Critical | §12 Self-Improvement |
| P3 | 261 | **Silent `catch {}`** in `parsePatternsFromOutput` | Logic | §12 Self-Improvement |
| P4 | 287 | **Silent `catch {}`** in `parseMutationsFromOutput` | Logic | §12 Self-Improvement |
| P5 | 218-219 | **Shallow spread breaks nested config** — `[mutation.parameter]` on `...currentParams` loses deep structure | Type Safety | §12 Self-Improvement |
| P6 | 242-256 | **`generateRollbackPlan` returns empty steps** — no snapshot, no restore logic | Critical | §12 Self-Improvement |

**Blueprint Section 12 Requirements:**
- **Task Phoenix**: Learn from task outcomes → patterns → recommendations ✅ (works)
- **Meta Phoenix**: Evolve system params with safety threshold (10%) ✅ (works)
- **Pattern → Policy Compilation**: Sandbox test → promote to cached policy ❌ (fake)
- **Mutation Rollback**: Snapshot + restore ❌ (empty)
- **Human Approval Required** for meta mutations ✅ (enforced)

---

### 4. BLUEPRINT — Living Blueprint (`packages/core/src/blueprint/blueprint.ts`)

| # | Line | Bug | Severity | Blueprint Section |
|---|------|-----|----------|-------------------|
| B1 | 71 | **Command injection**: `execAsync(git diff --name-status ${commitRange} ...)` — `commitRange` unsanitized | Critical (RCE) | §13 Living Blueprint |
| B2 | 311-314 | **`executeStep` simulated** — only `console.log` + 100ms timeout | Critical | §13 Living Blueprint |
| B3 | 317-321 | **`waitForHealthCheck` always returns true** — no real health polling | Critical | §13 Living Blueprint |
| B4 | 165 | **Dead `setTimeout(() => {}, 60000)`** — no await, no side effect | Quality | §13 Living Blueprint |
| B5 | 271-280 | **`extractSemanticChange` ignores `commitRange`** — hardcoded `HEAD~1..HEAD` | Logic | §13 Living Blueprint |
| B6 | 253-267 | **`rollbackPlan` executes arbitrary shell** via `execAsync(step.rollbackAction)` | Critical (RCE) | §13 Living Blueprint |
| B7 | 245-247 | **`approvePlan` no state validation** — can approve already-approved/rolled-back plans | Logic | §13 Living Blueprint |
| B8 | 304-309 | **`assessRisk` never returns "medium"** — only "low", "high", "critical" | Logic | §13 Living Blueprint |

**Blueprint Section 13 Requirements:**
- Parse git diff → semantic changes → affected agents → risk assessment
- Generate reconfiguration plan with ordered steps
- Blue-green deploy with 60s health check window
- Auto-rollback on health failure
- Approval gate for high/critical risk changes

---

### 5. AGENT MANAGER — Tests (`packages/core/src/__tests__/agent-manager.test.ts`)

| # | Issue | Severity |
|---|-------|----------|
| AM1 | **Import path**: `../agent/manager.js` — should resolve but TS strict may complain about `.js` extension in `.ts` import | Test |
| AM2 | **No test isolation** — `agents` Map shared across tests, `beforeEach` doesn't reset store, `seedAgents` test assumes previous tests populated store | Test |
| AM3 | **`listAgents("offline")` test logic flawed** — expects empty but previous `deleteAgent` tests may have created offline agents | Test |

---

### 6. LOOM TESTS — (`packages/core/src/__tests__/loom.test.ts`)

| # | Issue | Severity |
|---|-------|----------|
| LT1 | **Import path**: `../talos-agents/loom/index.ts` resolves to `packages/core/src/talos-agents/loom/index.ts` (WRONG) — should be `../../../../talos-agents/loom/index.ts` | Test |
| LT2 | **Typo**: `aauctionId` (line 47) double 'a' | Test |

---

### 7. FRONTEND — Mission Control UI (`packages/ui/`)

| # | File | Issue | Severity |
|---|------|-------|----------|
| F1 | `page.tsx`, `AgentGrid.tsx`, `StatusBar.tsx`, `ChatView.tsx` | `API_BASE` duplicated 15x across 4 files | Code Quality |
| F2 | `AgentGrid.tsx` | Uses `DEMO_AGENTS` hardcoded array, not real API | Functional |
| F3 | `StatusBar.tsx` | Hardcoded provider status, not real `/health/providers` | Functional |
| F4 | `StatusBadge.tsx`, `MetricCard.tsx`, `SearchBar.tsx`, `DataTable.tsx` | Built, exported, **never used** anywhere | Dead Code |
| F5 | `package.json` | Unused deps: `framer-motion`, `@supabase/supabase-js`, `@talos/db` | Bloat |
| F6 | `globals.css` | Legacy CSS coexists with Linear design tokens | Visual Debt |
| F7 | `__tests__/` | **Zero test files** for UI components | Test Coverage |
| F8 | Various | Poor accessibility — missing ARIA labels, keyboard nav | Accessibility |

---

## Blueprint Alignment Checklist

| Blueprint Section | System | Status | Gaps |
|------------------|--------|--------|------|
| §4 Agent Guild System | agent/manager.ts, types/guild.ts | ✅ Complete | — |
| §5 AI Provider Waterfall | ai-engine/router.ts | ✅ Complete | — |
| §6 Workflow Engine | workflow/engine.ts (10 node types) | ✅ Complete | — |
| §7 Memory (Cortex+Nornir) | memory/src/ | ✅ Complete | — |
| §8 Plugin Architecture | plugin/registry.ts | ✅ Complete | — |
| §9 Loom Auction | talos-agents/loom/ | ❌ **Broken** | L1-L10 |
| §10 Database Schema | supabase/migrations/ | ✅ Complete | — |
| §11 API Surface | api/server.ts (38 endpoints) | ✅ Complete | — |
| §12 Self-Improvement (Phoenix) | phoenix/phoenix.ts | ❌ **Broken** | P1-P6 |
| §12 Agent Fabrication (Eitri) | talos-agents/eitri/ | ❌ **Broken** | E1-E3 |
| §13 Living Blueprint | blueprint/blueprint.ts | ❌ **Broken** | B1-B8 |
| §14 Testing | vitest (183 tests) | ⚠️ 4 AI-skipped | — |

---

## Execution Order (Dependencies Resolved)

```
PHASE 1: Loom Tests (unblocks test suite)
  └─ Fix import path + typo

PHASE 2: Loom Core (foundation for agent system)
  └─ Fix L1-L10 — IIFE, bid logic, cleanup, cost estimation

PHASE 3: Blueprint (security critical - RCE)
  └─ Fix B1 (command injection), B6 (rollback RCE), B2-B3 (execution), B5, B7-B8

PHASE 4: Eitri (agent fabrication)
  └─ Implement 6-stage pipeline, parse spec from LLM output

PHASE 5: Phoenix (self-improvement)
  └─ Fix P1 (fake tests), P2 (rollback), P3-P4 (silent catches), P5 (deep clone), P6 (snapshot)

PHASE 6: Agent Manager Tests
  └─ Fix import, add beforeEach reset, fix test logic

PHASE 7: Frontend (after backend stable)
  └─ Shared API client, wire AgentGrid/StatusBar, remove dead code, clean deps/CSS
```

---

## Verification Gates (Per Phase)

| Phase | Build | Tests | Security | Blueprint Alignment |
|-------|-------|-------|----------|---------------------|
| 1-2 (Loom) | ✅ `pnpm --filter @talos/core build` | ✅ `pnpm --filter @talos/core test` | — | §9 Auction System |
| 3 (Blueprint) | ✅ | ✅ | ✅ **Security review mandatory** | §13 Living Blueprint |
| 4 (Eitri) | ✅ | ✅ New tests for 6 stages | — | §12 Agent Fabrication |
| 5 (Phoenix) | ✅ | ✅ New tests for rollback/snapshot | — | §12 Self-Improvement |
| 6 (Agent Manager) | ✅ | ✅ All 20 tests pass | — | §4 Agent Guild |
| 7 (Frontend) | ✅ `pnpm --filter @talos/ui build` | ⚠️ TBD | — | §15 UI |

---

## ADRs to Create/Update

| ADR | Topic | Decision |
|-----|-------|----------|
| ADR-049 | Loom Auction Design | Agents bid themselves; Loom scores + settles only |
| ADR-050 | Blueprint Security | `commitRange` sanitization + rollback action whitelist |
| ADR-051 | Eitri Pipeline | 6-stage fabrication with LLM output parsing |
| ADR-052 | Phoenix Rollback | Snapshot-based restore, not shell execution |
| ADR-053 | Test Isolation | `beforeEach` must reset module-level state |

---

## Next Steps

**Ready to execute Phase 1** (Loom test fixes) — unblocks entire test suite.
**Phase 2-6** are backend-only, no frontend dependencies.
**Phase 7** requires backend API stability.

**User Decision Needed:** Proceed with Phase 1 → 6 sequentially, or prioritize differently?