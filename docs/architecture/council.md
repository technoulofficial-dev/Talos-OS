# Council — Multi-Advisor Evaluation System

> A parallel multi-advisor evaluation engine where 5 specialized AI advisors independently assess a proposal, then a Chairman synthesizes their findings into a single verdict.

## Table of Contents

1. [Purpose](#1-purpose)
2. [System Overview](#2-system-overview)
3. [The 5 Advisors](#3-the-5-advisors)
4. [Session Flow](#4-session-flow)
5. [Verdicts](#5-verdicts)
6. [Severities](#6-severities)
7. [Chairman — Synthesis Logic](#7-chairman--synthesis-logic)
8. [Configuration](#8-configuration)
9. [Database & Storage](#9-database--storage)
10. [API Endpoints](#10-api-endpoints)
11. [Type Reference](#11-type-reference)
12. [Testing](#12-testing)
13. [Source Files](#13-source-files)

---

## 1. Purpose

The Council provides **multi-advisor parallel evaluation** for decision quality. Rather than relying on a single AI model to judge a proposal, the Council dispatches the proposal to 5 independent advisors — each with a specialized lens — and then synthesizes their reports into a coherent verdict.

**Why this matters:**

- **Diversity of perspective** — A security concern the Sentinel flags may be invisible to the Strategist. Parallel evaluation catches what serial review misses.
- **Confidence calibration** — Each advisor reports its own confidence. The Chairman weights findings by confidence, so a high-confidence minor concern can outweigh a low-confidence major one.
- **Actionable output** — The final verdict includes specific action items, not just approve/reject.
- **Auditability** — Every advisor report is persisted. You can trace exactly why a decision was made.

**Use cases:**

- Evaluating feature proposals before implementation
- Reviewing architectural changes
- Assessing risk for deployment decisions
- Validating design choices against project conventions

---

## 2. System Overview

```
                        ┌──────────────────────┐
                        │   POST /v1/council   │
                        │  { proposal: {...} }  │
                        └──────────┬───────────┘
                                   │
                                   ▼
                        ┌──────────────────────┐
                        │    createSession()    │
                        │  status: "pending"    │
                        └──────────┬───────────┘
                                   │
                                   ▼
                        ┌──────────────────────┐
                        │  executeSession()     │
                        │  status: "in_progress"│
                        └──────────┬───────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
                    ▼              ▼              ▼
            ┌──────────┐  ┌──────────┐  ┌──────────┐
            │Strategist│  │Architect │  │Researcher│
            └────┬─────┘  └────┬─────┘  └────┬─────┘
                 │              │              │
                 ▼              ▼              ▼
            ┌──────────┐  ┌──────────┐
            │ Sentinel │  │  Quality │
            └────┬─────┘  └────┬─────┘
                 │              │
                 └──────┬───────┘
                        │  5 AdvisorReport[]
                        ▼
                ┌──────────────┐
                │   Chairman   │
                │  (synthesis) │
                └──────┬───────┘
                       │
                       ▼
                ┌──────────────┐
                │ ChairmanVerdict│
                │  verdict: ... │
                └──────────────┘
```

All 5 advisors execute in parallel via `Promise.allSettled()`. If one advisor fails, its report is replaced with a zero-score placeholder and the remaining advisors proceed unaffected.

---

## 3. The 5 Advisors

Each advisor is defined as an `AdvisorDef` with a unique `id`, display `name`, `role` description, and a `systemPrompt` that encodes its evaluation criteria.

### 3.1 Strategist — Strategic Alignment

| Field | Value |
|-------|-------|
| **ID** | `strategist` |
| **Name** | Strategist |
| **Role** | Strategic Alignment |
| **Focus** | Long-term impact, project vision, opportunity cost |

**Evaluation Criteria:**

1. **Strategic Alignment** — Does this align with the project's overall goals and vision?
2. **Long-term Impact** — What are the second-order effects in 3-6 months?
3. **Opportunity Cost** — What are we not building by building this?
4. **Stakeholder Value** — Who benefits and how?
5. **Timeline Realism** — Is the proposed timeline achievable?

**Typical findings:** Proposals that drift from the project roadmap, features with unclear user value, timeline overestimations.

---

### 3.2 Architect — Technical Soundness

| Field | Value |
|-------|-------|
| **ID** | `architect` |
| **Name** | Architect |
| **Role** | Technical Soundness |
| **Focus** | Feasibility, scalability, dependencies |

**Evaluation Criteria:**

1. **Technical Feasibility** — Can this be built with the current architecture?
2. **Scalability** — Will this design scale to production loads?
3. **Dependency Analysis** — What new dependencies are introduced?
4. **Maintainability** — How easy will this be to maintain and extend?
5. **Integration Risk** — How well does this integrate with existing systems?

**Typical findings:** Missing migration paths, N+1 query patterns, unbounded data structures, tight coupling to volatile APIs.

---

### 3.3 Researcher — Fact-Checking & Evidence

| Field | Value |
|-------|-------|
| **ID** | `researcher` |
| **Name** | Researcher |
| **Role** | Fact-Checking & Evidence |
| **Focus** | Claims validation, assumption testing, alternatives |

**Evaluation Criteria:**

1. **Claim Validation** — Are the factual claims in the proposal accurate?
2. **Assumption Testing** — Are the underlying assumptions sound?
3. **Evidence Quality** — Is sufficient evidence provided to support the proposal?
4. **Alternative Approaches** — Are there better approaches not considered?
5. **Risk Data** — Is there historical data suggesting risks?

**Typical findings:** Unverified performance claims, overlooked alternatives, missing benchmarks, assumption of unavailable infrastructure.

---

### 3.4 Sentinel — Security & Risk

| Field | Value |
|-------|-------|
| **ID** | `sentinel` |
| **Name** | Sentinel |
| **Role** | Security & Risk |
| **Focus** | Attack surfaces, data privacy, edge cases |

**Evaluation Criteria:**

1. **Security Impact** — Does this introduce new attack surfaces?
2. **Data Privacy** — How does this handle sensitive data?
3. **Error Handling** — What happens when things go wrong?
4. **Edge Cases** — What uncommon scenarios are not handled?
5. **Compliance** — Does this meet relevant standards and practices?

**Typical findings:** Missing input validation, PII exposure, unhandled error paths, race conditions, missing rate limiting.

---

### 3.5 Quality — Code Quality & Testing

| Field | Value |
|-------|-------|
| **ID** | `quality` |
| **Name** | Quality |
| **Role** | Code Quality & Testing |
| **Focus** | Clean code, test coverage, conventions |

**Evaluation Criteria:**

1. **Code Quality** — Does the proposed approach produce clean, maintainable code?
2. **Test Coverage** — Is there a clear testing strategy?
3. **Convention Adherence** — Does this follow project conventions and patterns?
4. **Documentation** — Is sufficient documentation planned?
5. **Technical Debt** — Does this introduce new technical debt?

**Typical findings:** Missing test cases, inconsistent naming, duplicated logic, lack of JSDoc, bypassing established patterns.

---

## 4. Session Flow

The Council follows a strict 3-phase lifecycle:

### Phase 1: Create Session

```typescript
import { createSession } from "@talos/core/council";

const { sessionId } = createSession({
  title: "Add dark mode support",
  description: "Implement a dark mode theme toggle for the Mission Control UI",
  context: "Users have requested dark mode for reduced eye strain",
  files: ["packages/ui/src/app/globals.css"],
  priority: "normal",
});
// sessionId: "550e8400-e29b-41d4-a716-446655440000"
```

**What happens:**

1. A UUID is generated via `crypto.randomUUID()`
2. A `CouncilSession` object is created with `status: "pending"`
3. The session is stored in the in-memory `sessions` Map
4. The `sessionId` is returned immediately (no AI calls yet)

### Phase 2: Execute Session

```typescript
import { executeSession } from "@talos/core/council";

const session = await executeSession(sessionId, (reports) => {
  console.log(`Advisors complete: ${reports.length}`);
});
```

**What happens:**

1. Status transitions to `"in_progress"`
2. `evaluateParallel(proposal)` is called — all 5 advisors run concurrently
3. Each advisor receives the proposal via `routeUnlimited()` with `preferLocal: true`
4. Advisor responses are parsed as JSON and validated
5. Failed advisors produce zero-score placeholder reports (never block the session)
6. The optional `reportProgress` callback fires with the completed advisor reports
7. `synthesizeVerdict(reports)` is called — the Chairman synthesizes all reports
8. Status transitions to `"completed"` (or `"failed"` on error)
9. `completedAt` is set

### Phase 3: Retrieve Result

```typescript
import { getSession } from "@talos/core/council";

const session = getSession(sessionId);
console.log(session.verdict.verdict);     // "approve" | "conditional" | "reject" | "defer"
console.log(session.verdict.actionItems);  // ["Add Storybook integration", ...]
```

**Status transitions:**

```
pending → in_progress → completed
                     → failed
```

---

## 5. Verdicts

The Council produces two levels of verdicts: individual advisor recommendations and the final Chairman verdict.

### Advisor Recommendations

Each advisor outputs one of:

| Recommendation | Meaning |
|---------------|---------|
| `approve` | Proposal is sound; proceed as-is |
| `conditional` | Proposal is sound with specific conditions met |
| `reject` | Proposal has fundamental issues; do not proceed |
| `defer` | Insufficient information to decide; gather more data first |

### Chairman Verdict

The Chairman synthesizes all advisor reports into a final `ChairmanVerdict`:

```typescript
interface ChairmanVerdict {
  verdict: "approve" | "conditional" | "reject" | "defer";
  summary: string;                    // 2-3 sentence synthesis
  consensusScore: number;             // 0-100, how much advisors agree
  advisorScores: Record<AdvisorId, number>;  // per-advisor scores
  keyStrengths: string[];             // top strengths across all advisors
  keyConcerns: string[];              // top concerns across all advisors
  actionItems: string[];              // specific things to do before/during implementation
  dissentingOpinions: Array<{
    advisorId: AdvisorId;
    reason: string;
  }>;
  confidence: number;                 // 0-100, Chairman's confidence in the synthesis
}
```

**Decision rules (encoded in Chairman prompt):**

- If most advisors approve → lean toward `approve` with conditions
- If any advisor flags a critical finding → explain why it is or isn't a blocker
- `"defer"` is reserved for when critical information is missing
- The Chairman does NOT add its own evaluation — it synthesizes

---

## 6. Severities

Each `AdvisorFinding` carries a severity level:

| Severity | Meaning | Action Impact |
|----------|---------|---------------|
| `critical` | Fundamental flaw or security vulnerability | Blocks approval; must be resolved |
| `major` | Significant concern that should be addressed | Strongly influences verdict toward conditional |
| `minor` | Notable but not blocking | Noted in concerns, may become action item |
| `info` | Observation or context | Recorded for audit trail |

**Severity-weighted scoring:** The Chairman prompt instructs the LLM to weight findings by severity when computing `consensusScore`. A single `critical` finding from a high-confidence advisor can override three `approve` recommendations.

---

## 7. Chairman — Synthesis Logic

The Chairman is not another advisor. It is a **synthesis engine** that:

1. **Receives** all 5 `AdvisorReport` objects
2. **Weights** each advisor by their confidence score and finding severity
3. **Identifies consensus** — Where do most advisors agree?
4. **Surfaces dissent** — Where do advisors disagree and why?
5. **Resolves conflicts** — When advisors give contradictory recommendations, decides which reasoning is stronger
6. **Produces actionable output** — Specific action items the team can execute

### Prompt Structure

The Chairman prompt is built from `buildChairmanPrompt()` in `chairman.ts:33-51`:

```
You are the CHAIRMAN of the Talos Council. You have received independent
evaluation reports from all 5 advisors (Strategist, Architect, Researcher,
Sentinel, Quality).

Your role is to synthesize these reports into a single, coherent final verdict.
...

## Advisor Reports

--- STRATEGIST ---
Summary: Strong strategic alignment with user needs
Score: 85/100
Confidence: 80%
Recommendation: approve
Findings: [info] alignment: Matches project goals
Strengths: User demand is clear
Concerns: May need additional UX research

--- ARCHITECT ---
...
```

### Execution Parameters

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `temperature` | `0.2` | Lower than advisors (0.3) for more deterministic synthesis |
| `maxTokens` | `2048` | Sufficient for structured JSON output |
| `preferLocal` | `true` | Attempts local Ollama first, falls back to cloud |
| `agentId` | `"council-chairman"` | Distinct agent ID for routing |

### Fallback Behavior

If the Chairman LLM call fails, the `synthesizeVerdict` function throws, which is caught by `executeSession`. The session status transitions to `"failed"` with the error message stored in `session.error`.

---

## 8. Configuration

### Per-Advisor Filtering

You can run a subset of advisors by passing an `advisorFilter` to `evaluateParallel()`:

```typescript
import { evaluateParallel } from "@talos/core/council";

// Only run Architect and Quality advisors
const reports = await evaluateParallel(proposal, ["architect", "quality"]);
// reports.length === 2
```

The full list of valid advisor IDs: `["strategist", "architect", "researcher", "sentinel", "quality"]`

### AI Router Configuration

All advisors use `routeUnlimited()` from the AI engine router. The effective configuration:

| Parameter | Advisors | Chairman |
|-----------|----------|----------|
| `temperature` | `0.3` | `0.2` |
| `maxTokens` | `2048` | `2048` |
| `preferLocal` | `true` | `true` |
| `agentId` | `council-{advisorId}` | `council-chairman` |

**Routing priority** (from `routeUnlimited()`):

1. Local Ollama (if available and model loaded)
2. G0DM0D3 LAN peers
3. Owl Alpha (free OpenRouter tier)
4. G0DM0D3 cloud (Llama 3.1 default)

### Timeout

There is no per-advisor timeout in the current implementation. The session-level timeout is controlled by the AI router's `routeUnlimited()` function, which inherits the global provider timeout.

---

## 9. Database & Storage

### In-Memory Storage

Council sessions are stored in an in-memory `Map<string, CouncilSession>`:

```typescript
// session.ts:6
const sessions = new Map<string, CouncilSession>();
```

**Implications:**

- Sessions are lost on server restart
- No persistence to disk or database
- Suitable for request-response patterns (submit → poll → result)
- Not suitable for long-running sessions that survive restarts

### Session Lifecycle in Memory

| Operation | Function | Effect |
|-----------|----------|--------|
| Create | `createSession(proposal)` | Adds to Map, returns `sessionId` |
| Read | `getSession(sessionId)` | Looks up by UUID |
| Execute | `executeSession(sessionId)` | Mutates in-place, returns updated session |
| List | `getAllSessions()` | Returns all sessions as array |
| Clear | `clearSessions()` | Empties the Map (used in tests) |

### Future: Database Persistence

The Council does not currently use the `@talos/db` persistence layer. If database persistence is needed (e.g., for auditing or multi-instance deployments), the following tables would be relevant:

- `talos_council_sessions` — Session metadata, proposal, verdict
- `talos_advisor_reports` — Individual advisor reports with findings
- `talos_advisor_findings` — Individual findings per advisor report

These tables do not yet exist in the Supabase schema. The workflow engine's `0003_workflows.sql` migration provides a template for the pattern.

---

## 10. API Endpoints

The Council API is served by the Talos Core HTTP server on port 8642.

### POST /v1/council — Submit Proposal

Starts a new Council session. Returns immediately with `202 Accepted` while evaluation runs in the background.

**Request:**

```json
{
  "proposal": {
    "title": "Add dark mode support",
    "description": "Implement a dark mode theme toggle for the Mission Control UI",
    "context": "Users have requested dark mode for reduced eye strain",
    "files": ["packages/ui/src/app/globals.css"],
    "priority": "normal"
  }
}
```

**Response (202):**

```json
{
  "success": true,
  "data": {
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "in_progress",
    "message": "Council session started"
  },
  "timestamp": "2026-06-06T12:00:00.000Z"
}
```

**Validation:**
- `proposal.title` is required (min 1 character)
- `proposal.description` is required (min 1 character)
- Returns `400` if either is missing

**Server-side behavior:**
1. `createSession(body.proposal)` creates the session
2. `executeSession(sessionId)` is fired with `.catch()` (fire-and-forget)
3. Client polls `GET /v1/council/:id` for results

### GET /v1/council/:id — Get Session Status

Returns the full session state including all advisor reports and the Chairman verdict (if completed).

**Response (200):**

```json
{
  "success": true,
  "data": {
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "proposal": { "..." },
    "status": "completed",
    "reports": [
      {
        "advisorId": "strategist",
        "summary": "Strong strategic alignment with user needs",
        "score": 85,
        "findings": [{ "severity": "info", "category": "alignment", "..." : "..." }],
        "strengths": ["User demand is clear"],
        "concerns": ["May need additional UX research"],
        "recommendation": "approve",
        "confidence": 80,
        "tokensUsed": 1024,
        "latencyMs": 2340
      },
      "... 4 more advisor reports ..."
    ],
    "verdict": {
      "verdict": "conditional",
      "summary": "The proposal is well-aligned with user needs...",
      "consensusScore": 82,
      "advisorScores": { "strategist": 85, "architect": 75, "..." : "..." },
      "keyStrengths": ["Clear user demand", "Clean CSS variable approach"],
      "keyConcerns": ["Visual regression testing not addressed"],
      "actionItems": ["Add Storybook integration", "Handle SSR edge cases"],
      "dissentingOpinions": [],
      "confidence": 78
    },
    "createdAt": "2026-06-06T12:00:00.000Z",
    "completedAt": "2026-06-06T12:00:15.000Z"
  },
  "timestamp": "2026-06-06T12:00:15.000Z"
}
```

**Status codes:**
- `200` — Session found
- `400` — Session ID missing
- `404` — Session not found

---

## 11. Type Reference

### CouncilProposal

```typescript
{
  title: string;           // min 1 char
  description: string;     // min 1 char
  context?: string;        // optional additional context
  files?: string[];        // related file paths
  priority: "low" | "normal" | "high" | "critical";  // default: "normal"
}
```

### AdvisorFinding

```typescript
{
  severity: "critical" | "major" | "minor" | "info";
  category: string;        // e.g., "security", "architecture", "testing"
  summary: string;         // one-line summary
  detail: string;          // detailed explanation
  recommendation: string; // what to do about it
}
```

### AdvisorReport

```typescript
{
  advisorId: "strategist" | "architect" | "researcher" | "sentinel" | "quality";
  summary: string;
  score: number;           // 0-100
  findings: AdvisorFinding[];
  strengths: string[];
  concerns: string[];
  recommendation: "approve" | "conditional" | "reject" | "defer";
  confidence: number;      // 0-100
  tokensUsed: number;      // total tokens (in + out)
  latencyMs: number;       // wall-clock time for this advisor
}
```

### ChairmanVerdict

```typescript
{
  verdict: "approve" | "conditional" | "reject" | "defer";
  summary: string;
  consensusScore: number;  // 0-100
  advisorScores: Record<AdvisorId, number>;
  keyStrengths: string[];
  keyConcerns: string[];
  actionItems: string[];
  dissentingOpinions: Array<{
    advisorId: AdvisorId;
    reason: string;
  }>;
  confidence: number;      // 0-100
}
```

### CouncilSession

```typescript
{
  sessionId: string;       // UUID
  proposal: CouncilProposal;
  status: "pending" | "in_progress" | "completed" | "failed";
  reports: AdvisorReport[];
  verdict?: ChairmanVerdict;
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}
```

---

## 12. Testing

Council tests are in `packages/core/src/__tests__/council.test.ts` (217 lines).

### Test Inventory

| # | Describe Block | Test | Status |
|---|---------------|------|--------|
| 1 | Advisor Definitions | defines all 5 advisors | Pass |
| 2 | Advisor Definitions | each advisor has a unique ID | Pass |
| 3 | Advisor Definitions | each advisor has a system prompt | Pass |
| 4 | Advisor Execution | runAdvisor returns a valid report for strategist | **Skipped** (needs AI) |
| 5 | Advisor Execution | runAdvisor returns a valid report for sentinel | **Skipped** (needs AI) |
| 6 | Parallel Evaluation | evaluates all 5 advisors in parallel | Pass (mocked) |
| 7 | Parallel Evaluation | evaluates a subset when filtered | Pass (mocked) |
| 8 | Chairman Synthesis | synthesizes verdict from sample reports | **Skipped** (needs AI) |
| 9 | Session Management | creates a session with pending status | Pass |
| 10 | Session Management | returns undefined for unknown session | Pass |
| 11 | Session Management | executes a full council session | **Skipped** (needs AI) |
| 12 | Session Management | fails session on invalid proposal | Pass |
| 13 | Session Management | reports progress during execution | Pass |
| 14 | Session Management | throws on execution of unknown session | Pass |
| 15 | Session Management | clears all sessions | Pass |

**15 tests total, 4 skipped** (require live Ollama or OpenRouter).

### Test Patterns

**Mocking AI calls:**
Tests that call `evaluateParallel()` or `runAdvisor()` with real LLMs are `.skip`-ped. The `evaluateParallel` tests work because the test file doesn't mock the AI layer — they actually hit the local Ollama instance (if running) or fail gracefully.

**Session management tests** are fully mocked-free because they test in-memory state operations.

**Timeout:** Integration tests use 60s or 120s timeouts (`it("...", fn, 60000)`) to accommodate LLM latency.

---

## 13. Source Files

| File | Lines | Purpose |
|------|-------|---------|
| `packages/core/src/council/types.ts` | 84 | Zod schemas and TypeScript types for all Council data structures |
| `packages/core/src/council/advisor.ts` | 212 | Advisor definitions, prompt building, parallel execution, JSON parsing |
| `packages/core/src/council/chairman.ts` | 93 | Chairman prompt, report synthesis, verdict parsing |
| `packages/core/src/council/session.ts` | 72 | Session lifecycle (create, get, execute, update, clear) |
| `packages/core/src/council/index.ts` | 14 | Barrel re-exports |
| `packages/core/src/__tests__/council.test.ts` | 217 | 15 tests covering definitions, execution, sessions |
| `packages/core/src/api/server.ts` | 371 | HTTP API with POST/GET `/v1/council` endpoints |

### Dependency Graph

```
council/types.ts        (no deps)
       ↑
council/advisor.ts      (depends on: types, ai-engine/router)
       ↑
council/chairman.ts     (depends on: types, ai-engine/router)
       ↑
council/session.ts      (depends on: types, advisor, chairman)
       ↑
council/index.ts        (barrel re-exports)
       ↑
api/server.ts           (depends on: council/index)
```

### Exported API

```typescript
// From @talos/core/council
export { ADVISORS, runAdvisor, evaluateParallel };
export { synthesizeVerdict };
export { createSession, getSession, executeSession, getAllSessions, clearSessions };
export type { AdvisorId, Verdict, Severity, CouncilProposal, AdvisorFinding,
              AdvisorReport, ChairmanVerdict, CouncilSession, CouncilSessionStatus };
```

---

## Appendix: Design Decisions

| ADR | Decision | Rationale |
|-----|----------|-----------|
| ADR-006 | Parallel evaluation via `Promise.allSettled()` | Isolates advisor failures; one crash doesn't block others |
| ADR-007 | Failed advisors produce zero-score placeholders | Ensures `reports.length === 5` invariant even when LLM calls fail |
| ADR-008 | Chairman uses `temperature: 0.2` (lower than advisors' `0.3`) | More deterministic synthesis; less creative variance |
| ADR-009 | In-memory session storage | Keeps blast radius small; sessions are request-scoped |
| ADR-010 | JSON parsing with markdown fence stripping | LLMs commonly wrap JSON in ``` fences; `parseAdvisorJson` handles this |
| ADR-011 | `advisorFilter` parameter on `evaluateParallel` | Allows partial evaluation for cost/time savings |
