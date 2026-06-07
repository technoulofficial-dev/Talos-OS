# Budget System — Cloud API Budget Gate & Rate Limiting

## 1. Purpose

The Budget system implements a **single chokepoint for ALL cloud API calls** in Talos OS. No cloud call bypasses the budget gate. The system enforces monthly/hourly spending caps, per-task token limits, and per-minute rate limiting, with a hard kill switch at 95% of the monthly cap.

> **Blueprint Reference:** SYS-BUDGET (Sections B1-B6) of the Talos OS Blueprint.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     SYS-BUDGET Gate                             │
│                                                                 │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   │
│  │  Gate    │──►│  State   │──►│  Ledger  │──►│  Rate    │   │
│  │ (B3)    │   │  (B1)    │   │  (B2)    │   │  (B5)    │   │
│  └────┬─────┘   └──────────┘   └──────────┘   └──────────┘   │
│       │                                                         │
│  ┌────▼─────┐   ┌──────────┐                                   │
│  │  Alert   │   │  Tokens  │                                   │
│  │  (B6)    │   │  (B4)    │                                   │
│  └──────────┘   └──────────┘                                   │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
  Every cloud API call
  (OpenAI, Anthropic, NVIDIA NIM, etc.)
```

### 2.1 Module Layout

| Module | File | Blueprint ID | Purpose |
|---|---|---|---|
| **State** | `budget/state.ts` | B1 | Load config, build BudgetState |
| **Ledger** | `budget/ledger.ts` | B2 | Track every API call cost |
| **Gate** | `budget/gate.ts` | B3 | Single chokepoint decision |
| **Tokens** | `budget/tokens.ts` | B4 | Token estimation + cost calculation |
| **Rate** | `budget/rate.ts` | B5 | Per-minute sliding window limiter |
| **Alert** | `budget/alert.ts` | B6 | Budget threshold alerts |
| **Types** | `types/budget.ts` | — | Zod schemas + TypeScript types |

All modules are re-exported from `packages/core/src/budget/index.ts`.

---

## 3. Budget Gate (SYS-BUDGET B3)

Location: `packages/core/src/budget/gate.ts`

The `decide()` function is the **single chokepoint** for all cloud API calls. Every cloud call in the system must pass through this function before executing.

```typescript
export async function decide(request: BudgetCheckRequest): Promise<BudgetDecision>
```

### 3.1 Decision Pipeline

The gate evaluates conditions in this exact order:

```
1. channel === "local" ?     → ALLOW (local_task)
2. budget disabled ?         → ALLOW (under_budget)
3. hard kill triggered ?     → DENY  (hard_kill_triggered)
4. monthly cap exceeded ?    → DENY  (monthly_cap_hit)
5. hourly cap exceeded ?     → DENY  (hourly_cap_hit)
6. task too large ?          → DENY  (task_too_large)
7. rate limited ?            → DENY  (rate_limited)
8. otherwise                 → ALLOW (under_budget)
```

### 3.2 Check Details

**1. Local task bypass:**
```typescript
if (request.channel === "local") {
  return { allow: true, reason: "local_task" };
}
```
Tasks flagged as `channel: "local"` (e.g., Ollama inference) bypass all budget checks. They cost $0.

**2. Budget disabled:**
```typescript
if (!state.enabled) {
  return { allow: true, reason: "under_budget" };
}
```
The entire budget system can be disabled via `BudgetState.enabled`. When disabled, all cloud calls are allowed. Default: `true` (enabled).

**3. Hard kill switch:**
```typescript
if (ledger.monthlyUsd / state.monthlyCapUsd >= state.hardKillAt) {
  return { allow: false, reason: "hard_kill_triggered" };
}
```
If 95% of the monthly cap has been consumed, ALL cloud calls are immediately denied. This is a safety mechanism to prevent runaway costs. The threshold is configurable via `BUDGET_HARD_KILL_AT` (default: `0.95`).

**4. Monthly cap:**
```typescript
if (ledger.monthlyUsd + request.estimatedCostUsd > state.monthlyCapUsd) {
  return { allow: false, reason: "monthly_cap_hit" };
}
```
Checks if the current month's spending plus the estimated cost of this call would exceed the monthly cap.

**5. Hourly cap:**
```typescript
if (ledger.hourlyUsd + request.estimatedCostUsd > state.hourlyCapUsd) {
  return { allow: false, reason: "hourly_cap_hit" };
}
```
Checks if the current hour's spending plus the estimated cost would exceed the hourly cap. Prevents burst spending.

**6. Per-task token cap:**
```typescript
if (request.estimatedTokens > state.perTaskTokenCap) {
  return { allow: false, reason: "task_too_large" };
}
```
Rejects individual tasks that exceed the per-task token limit. Prevents a single massive request from consuming the budget.

**7. Rate limiting:**
```typescript
const rateCheck = await checkRateLimit(request.agentId, state.perMinuteRequests);
if (!rateCheck.allowed) {
  return { allow: false, reason: "rate_limited" };
}
```
Per-agent sliding window rate limiter. Default: 30 requests per minute.

### 3.3 Decision Types

```typescript
export const BudgetDecisionSchema = z.discriminatedUnion("allow", [
  z.object({
    allow: z.literal(true),
    reason: z.enum(["under_budget", "local_task", "emergency_override"]),
    overrideBy: z.string().optional(),
  }),
  z.object({
    allow: z.literal(false),
    reason: z.enum([
      "monthly_cap_hit",
      "hourly_cap_hit",
      "rate_limited",
      "task_too_large",
      "hard_kill_triggered",
      "unknown_channel",
    ]),
  }),
]);
```

### 3.4 Request Type

```typescript
export const BudgetCheckRequestSchema = z.object({
  agentId: AnyAgentIdSchema,        // Which agent is making the call
  channel: z.enum(["local", "cloud"]),
  estimatedTokens: z.number().int().positive(),
  estimatedCostUsd: z.number().nonnegative(),
  priority: z.enum(["low", "normal", "high", "critical"]),
  providerId: z.string().optional(),
});
```

---

## 4. Token Estimation (SYS-BUDGET B4)

Location: `packages/core/src/budget/tokens.ts`

### 4.1 Provider Cost Tables

```typescript
const PROVIDER_COSTS: Record<string, { input: number; output: number }> = {
  "nvidia-nim": { input: 0.000001, output: 0.000002 },
  "openai":     { input: 0.000003, output: 0.000012 },
  "anthropic":  { input: 0.000003, output: 0.000015 },
};
```

Costs are in **USD per token** (not per million). For reference:

| Provider | Input $/token | Output $/token | Input $/1M tokens | Output $/1M tokens |
|---|---|---|---|---|
| NVIDIA NIM | $0.000001 | $0.000002 | $1.00 | $2.00 |
| OpenAI | $0.000003 | $0.000012 | $3.00 | $12.00 |
| Anthropic | $0.000003 | $0.000015 | $3.00 | $15.00 |

### 4.2 Functions

#### `estimateTokens(text: string): number`

Estimates token count from text length using the 4-chars-per-token heuristic.

```typescript
const CHARS_PER_TOKEN = 4;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}
```

#### `estimateCost(providerId, inputTokens, outputTokens): number`

Calculates USD cost for a given provider and token counts. Returns `0` for unknown providers.

```typescript
export function estimateCost(
  providerId: string,
  inputTokens: number,
  outputTokens: number
): number {
  const costs = PROVIDER_COSTS[providerId];
  if (!costs) return 0;
  return (
    (inputTokens / 1_000_000) * costs.input +
    (outputTokens / 1_000_000) * costs.output
  );
}
```

#### `buildEstimate(params): TokenEstimate`

Builds a complete token estimate from a conversation setup (system prompt + messages + expected output tokens).

```typescript
export function buildEstimate(params: {
  systemPrompt?: string;
  messages: Array<{ role: string; content: string }>;
  expectedOutputTokens: number;
  providerId: string;
}): TokenEstimate
```

**Returns:**

```typescript
export interface TokenEstimate {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  providerId: string;
  costPerInputToken: number;
  costPerOutputToken: number;
}
```

---

## 5. Budget State (SYS-BUDGET B1)

Location: `packages/core/src/budget/state.ts`

### 5.1 Default Configuration

```typescript
const DEFAULT_CONFIG: BudgetConfig = {
  monthly_usd: 50,
  hourly_usd: 5,
  per_task_tokens: 100000,
  per_minute_requests: 30,
  hard_kill_at: 0.95,
};
```

### 5.2 Configuration Loading

Configuration is loaded from environment variables with fallbacks to defaults:

| Env Variable | Default | Description |
|---|---|---|
| `BUDGET_MONTHLY_USD` | `50` | Monthly spending cap in USD |
| `BUDGET_HOURLY_USD` | `5` | Hourly spending cap in USD |
| `BUDGET_PER_TASK_TOKENS` | `100000` | Max tokens per individual task |
| `BUDGET_PER_MINUTE_REQUESTS` | `30` | Max API calls per minute per agent |
| `BUDGET_HARD_KILL_AT` | `0.95` | Hard kill threshold (95% of monthly cap) |

```typescript
export function loadBudgetConfig(): BudgetConfig {
  const env = (key: string, fallback: number): number => {
    const val = process.env[key];
    return val !== undefined ? parseFloat(val) : fallback;
  };
  const raw = {
    monthly_usd: env("BUDGET_MONTHLY_USD", DEFAULT_CONFIG.monthly_usd),
    hourly_usd: env("BUDGET_HOURLY_USD", DEFAULT_CONFIG.hourly_usd),
    per_task_tokens: parseInt(process.env["BUDGET_PER_TASK_TOKENS"] ?? String(DEFAULT_CONFIG.per_task_tokens), 10),
    per_minute_requests: parseInt(process.env["BUDGET_PER_MINUTE_REQUESTS"] ?? String(DEFAULT_CONFIG.per_minute_requests), 10),
    hard_kill_at: env("BUDGET_HARD_KILL_AT", DEFAULT_CONFIG.hard_kill_at),
  };
  return BudgetConfigSchema.parse(raw);
}
```

### 5.3 BudgetState Construction

```typescript
export function buildBudgetState(config?: BudgetConfig): BudgetState {
  const cfg = config ?? loadBudgetConfig();
  return BudgetStateSchema.parse({
    periodId: getCurrentMonthPeriod(),   // "2026-06"
    period: "monthly",
    monthlyCapUsd: cfg.monthly_usd,
    hourlyCapUsd: cfg.hourly_usd,
    perTaskTokenCap: cfg.per_task_tokens,
    perMinuteRequests: cfg.per_minute_requests,
    hardKillAt: cfg.hard_kill_at,
    enabled: true,
  });
}
```

### 5.4 Period IDs

```typescript
export function getCurrentMonthPeriod(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  // e.g., "2026-06"
}

export function getCurrentHourPeriod(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}T${String(now.getUTCHours()).padStart(2, "0")}`;
  // e.g., "2026-06-05T15"
}
```

---

## 6. Alert System (SYS-BUDGET B6)

Location: `packages/core/src/budget/alert.ts`

### 6.1 Alert Levels

| Level | When | Example reasons |
|---|---|---|
| `warning` | Non-critical denial | (currently unused, reserved) |
| `critical` | Hard kill or monthly cap hit | `hard_kill_triggered`, `monthly_cap_hit` |
| `denied` | Other denial | `hourly_cap_hit`, `rate_limited`, `task_too_large` |

### 6.2 Emission Logic

```typescript
export function emitBudgetAlert(decision: BudgetDecision): void {
  if (decision.allow) return; // No alert for allowed decisions

  let level: BudgetAlert["level"] = "warning";
  if (
    decision.reason === "hard_kill_triggered" ||
    decision.reason === "monthly_cap_hit"
  ) {
    level = "critical";
  } else {
    level = "denied";
  }

  const alert: BudgetAlert = {
    level,
    reason: decision.reason,
    message: `[TALOS BUDGET ${level.toUpperCase()}] Cloud call denied: ${decision.reason}`,
    timestamp: new Date(),
  };

  alerts.push(alert);
  console.warn(alert.message);
}
```

### 6.3 Alert Storage

Phase 1: In-memory array with configurable retention (default: last 50 alerts).

```typescript
export function getRecentAlerts(limit: number = 50): BudgetAlert[]
export function clearAlerts(): void
```

Phase 2+: Will integrate with webhook endpoints for real-time notification.

---

## 7. Spend Ledger (SYS-BUDGET B2)

Location: `packages/core/src/budget/ledger.ts`

### 7.1 Recording Spend

```typescript
export async function recordSpend(params: {
  agentId: string;
  providerId: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  taskId?: string;
  timestamp: Date;
}): Promise<SpendRecord>
```

Each call creates a `SpendRecord` with a UUID, period ID, and total token count. Records are appended to the in-memory ledger (Phase 1) and will be persisted to `talos_spend_ledger` in Phase 2.

### 7.2 Ledger Queries

| Function | Description |
|---|---|
| `getMonthlyRecords()` | All records for current month (matching `periodId`) |
| `getHourlyRecords()` | All records for current hour (ISO prefix match) |
| `getRecentMinutesRecords(n)` | Records from last N minutes |
| `getLedgerSummary()` | Full aggregated summary |

### 7.3 Ledger Summary

```typescript
export interface SpendLedgerSummary {
  currentPeriod: string;       // "2026-06"
  monthlyUsd: number;          // Total USD spent this month
  hourlyUsd: number;           // Total USD spent this hour
  monthlyTokens: number;       // Total tokens used this month
  minuteRequests: number;      // API calls in last minute
  lastRequestAt?: Date;        // Timestamp of last API call
  records: SpendRecord[];      // All monthly records
}
```

### 7.4 Spend Record Schema

```typescript
export interface SpendRecord {
  id?: string;                  // UUID
  agentId: string;              // e.g., "odin", "brokkr"
  providerId: string;           // e.g., "nvidia-nim", "openai"
  tokensIn: number;             // Input tokens
  tokensOut: number;            // Output tokens
  totalTokens: number;          // tokensIn + tokensOut
  costUsd: number;              // Cost in USD
  taskId?: string;              // Associated task UUID
  timestamp: Date;
  periodId: string;             // Monthly period ID
}
```

---

## 8. Rate Limiter (SYS-BUDGET B5)

Location: `packages/core/src/budget/rate.ts`

### 8.1 Implementation

Sliding window rate limiter, in-memory (Phase 1). Tracks request timestamps per agent.

```typescript
interface RateEntry {
  timestamp: number;
}

const requestLog: Map<string, RateEntry[]> = new Map();
```

### 8.2 Rate Check

```typescript
export async function checkRateLimit(
  agentId: string,
  maxPerMinute: number
): Promise<RateLimitCheck>
```

**Logic:**
1. Get all timestamps for this agent
2. Filter to entries within the last 60 seconds
3. If count ≥ max, deny with `retryAfterMs`
4. Otherwise, record the current timestamp and allow

**Return type:**

```typescript
export interface RateLimitCheck {
  allowed: boolean;
  remaining: number;      // Requests remaining in window
  resetAtMs: number;      // When the window resets
  retryAfterMs?: number;  // How long to wait (only if denied)
}
```

### 8.3 Helper Functions

```typescript
export function getRequestCount(agentId: string): number  // Current count in window
export function clearRateLimits(): void                    // Reset all (for testing)
```

---

## 9. Database Table

### 9.1 `talos_spend_ledger`

```sql
CREATE TABLE IF NOT EXISTS talos_spend_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id text NOT NULL,
  provider_id text NOT NULL,
  task_id uuid,
  tokens_in int DEFAULT 0,
  tokens_out int DEFAULT 0,
  total_tokens int DEFAULT 0,
  cost_usd float DEFAULT 0,
  period_id text NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

**Indexes:**
```sql
CREATE INDEX IF NOT EXISTS idx_spend_agent ON talos_spend_ledger(agent_id);
CREATE INDEX IF NOT EXISTS idx_spend_period ON talos_spend_ledger(period_id);
```

### 9.2 Column Descriptions

| Column | Type | Description |
|---|---|---|
| `id` | uuid | Primary key (auto-generated) |
| `agent_id` | text | Agent that made the call (e.g., "odin") |
| `provider_id` | text | Provider used (e.g., "nvidia-nim") |
| `task_id` | uuid | Optional associated task |
| `tokens_in` | int | Input token count |
| `tokens_out` | int | Output token count |
| `total_tokens` | int | Sum of input + output |
| `cost_usd` | float | Cost in USD |
| `period_id` | text | Monthly period (e.g., "2026-06") |
| `created_at` | timestamptz | Record creation timestamp |

---

## 10. Configuration

### 10.1 Environment Variables

| Variable | Type | Default | Description |
|---|---|---|---|
| `BUDGET_MONTHLY_USD` | float | `50` | Monthly spending cap in USD |
| `BUDGET_HOURLY_USD` | float | `5` | Hourly spending cap in USD |
| `BUDGET_PER_TASK_TOKENS` | int | `100000` | Max tokens per task |
| `BUDGET_PER_MINUTE_REQUESTS` | int | `30` | Max requests per minute per agent |
| `BUDGET_HARD_KILL_AT` | float | `0.95` | Hard kill threshold (fraction of monthly cap) |

### 10.2 Budget Config Schema

Validated by Zod on load:

```typescript
export const BudgetConfigSchema = z.object({
  monthly_usd: z.number().nonnegative().default(50),
  hourly_usd: z.number().nonnegative().default(5),
  per_task_tokens: z.number().int().positive().default(100000),
  per_minute_requests: z.number().int().positive().default(30),
  hard_kill_at: z.number().min(0).max(1).default(0.95),
});
```

### 10.3 BudgetState Schema

The runtime state used by the gate:

```typescript
export const BudgetStateSchema = z.object({
  periodId: z.string(),                    // "2026-06"
  period: z.enum(["hourly", "monthly"]),
  monthlyCapUsd: z.number().nonnegative(),
  hourlyCapUsd: z.number().nonnegative(),
  perTaskTokenCap: z.number().int().positive(),
  perMinuteRequests: z.number().int().positive(),
  hardKillAt: z.number().min(0).max(1),
  enabled: z.boolean().default(true),
});
```

---

## 11. API Integration

### 11.1 How the Budget Gate Sits at Every Cloud Call

Every cloud API call in Talos OS must:

1. Build a `BudgetCheckRequest` with the agent ID, channel, estimated tokens, and cost
2. Call `decide(request)` from `budget/gate.ts`
3. If `result.allow === false`, the call is blocked and an alert is emitted
4. If `result.allow === true`, proceed with the API call
5. After the call completes, call `recordSpend()` to log the actual cost

```
Agent Request → buildEstimate() → decide() → [ALLOW] → API Call → recordSpend()
                                    │
                                    └─→ [DENY] → emitBudgetAlert() → Return error
```

### 11.2 Integration Pattern

```typescript
import { budgetDecide, buildEstimate, recordSpend, emitBudgetAlert } from "@talos/core/budget";

async function callCloudProvider(agentId: string, messages: Message[], providerId: string) {
  // 1. Build estimate
  const estimate = buildEstimate({
    systemPrompt: systemPrompt,
    messages: messages,
    expectedOutputTokens: 500,
    providerId: providerId,
  });

  // 2. Check budget
  const decision = await budgetDecide({
    agentId,
    channel: "cloud",
    estimatedTokens: estimate.totalTokens,
    estimatedCostUsd: estimate.costUsd,
    priority: "normal",
    providerId,
  });

  // 3. Handle denial
  if (!decision.allow) {
    emitBudgetAlert(decision);
    throw new Error(`Budget denied: ${decision.reason}`);
  }

  // 4. Execute API call
  const result = await actualApiCall(messages);

  // 5. Record actual spend
  await recordSpend({
    agentId,
    providerId,
    tokensIn: result.usage.input_tokens,
    tokensOut: result.usage.output_tokens,
    costUsd: estimateCost(providerId, result.usage.input_tokens, result.usage.output_tokens),
    timestamp: new Date(),
  });

  return result;
}
```

---

## 12. Error Codes

| Code | Constant | Meaning |
|---|---|---|
| `TAL-B01` | `MONTHLY_CAP_HIT` | Monthly spending cap exceeded |
| `TAL-B02` | `HOURLY_CAP_HIT` | Hourly spending cap exceeded |
| `TAL-B03` | `RATE_LIMITED` | Per-minute request limit hit |
| `TAL-B04` | `TASK_TOO_LARGE` | Single task exceeds token cap |
| `TAL-B05` | `HARD_KILL` | 95% of monthly cap consumed |

```typescript
export const BUDGET_ERROR_CODES = {
  MONTHLY_CAP_HIT: "TAL-B01",
  HOURLY_CAP_HIT: "TAL-B02",
  RATE_LIMITED: "TAL-B03",
  TASK_TOO_LARGE: "TAL-B04",
  HARD_KILL: "TAL-B05",
} as const;
```

---

## 13. Testing

Location: `packages/core/src/__tests__/budget.test.ts`

### 13.1 Test Coverage

| Test Suite | Tests | What it covers |
|---|---|---|
| **Budget Gate** | 3 | Local bypass, cloud allowed, task too large |
| **Budget State** | 3 | Default config, custom config, period ID format |
| **Budget Ledger** | 3 | Record/retrieve, multiple entries, monthly/hourly separation |
| **Token Estimation** | 4 | Text estimation, provider costs, unknown provider, buildEstimate |
| **Rate Limiting** | 2 | Under limit, at boundary |
| **Budget Alerts** | 3 | Denied alert, multiple alerts, no alert on allow |

### 13.2 Key Test Patterns

**Gate test — local bypass:**
```typescript
it("allows local tasks without checking budget", async () => {
  const result = await decide({
    agentId: "odin",
    channel: "local",
    estimatedTokens: 1000,
    estimatedCostUsd: 0,
    priority: "normal",
  });
  expect(result.allow).toBe(true);
  expect(result.reason).toBe("local_task");
});
```

**State test — defaults:**
```typescript
it("loads defaults", () => {
  const state = buildBudgetState();
  expect(state.monthlyCapUsd).toBe(50);
  expect(state.hourlyCapUsd).toBe(5);
  expect(state.perTaskTokenCap).toBe(100000);
  expect(state.perMinuteRequests).toBe(30);
  expect(state.hardKillAt).toBe(0.95);
  expect(state.enabled).toBe(true);
});
```

**Rate limit test — boundary:**
```typescript
it("allows requests at the limit boundary", async () => {
  for (let i = 0; i < 30; i++) {
    const result = await checkRateLimit("odin", 30);
    expect(result.allowed).toBe(true);
  }
});
```

### 13.3 Test Cleanup

Each test suite uses `beforeEach` to clear state:

```typescript
beforeEach(() => {
  clearLedger();       // Reset spend records
  clearRateLimits();   // Reset rate limiter
  clearAlerts();       // Reset alert history
});
```

---

## 14. Public API Exports

From `packages/core/src/budget/index.ts`:

```typescript
export { buildBudgetState, loadBudgetConfig, getCurrentMonthPeriod, getCurrentHourPeriod } from "./state.js";
export { recordSpend, getMonthlyRecords, getHourlyRecords, getLedgerSummary, clearLedger, getRecordCount } from "./ledger.js";
export { decide as budgetDecide } from "./gate.js";
export { estimateTokens, estimateCost, buildEstimate } from "./tokens.js";
export { checkRateLimit, getRequestCount, clearRateLimits } from "./rate.js";
export { emitBudgetAlert, getRecentAlerts, clearAlerts, type BudgetAlert } from "./alert.js";
```

---

## 15. Production Roadmap

| Phase | What changes |
|---|---|
| **Phase 1 (current)** | In-memory ledger, in-memory rate limiter, console.warn alerts |
| **Phase 2** | Persist ledger to `talos_spend_ledger` Supabase table, webhook alerts |
| **Phase 3** | Redis-backed rate limiter for distributed deployments, per-agent budget quotas |
| **Phase 4** | Budget dashboard in `@talos/ui`, cost forecasting, auto-scaling caps |

---

## 16. File Reference

| File | Purpose |
|---|---|
| `packages/core/src/budget/gate.ts` | Budget gate — single chokepoint decision |
| `packages/core/src/budget/state.ts` | Config loading + BudgetState construction |
| `packages/core/src/budget/ledger.ts` | Spend tracking + aggregation |
| `packages/core/src/budget/tokens.ts` | Token estimation + provider cost tables |
| `packages/core/src/budget/rate.ts` | Per-minute sliding window rate limiter |
| `packages/core/src/budget/alert.ts` | Budget threshold alerts |
| `packages/core/src/budget/index.ts` | Public API re-exports |
| `packages/core/src/types/budget.ts` | Zod schemas + TypeScript type definitions |
| `packages/core/src/__tests__/budget.test.ts` | Test suite (18 tests) |
| `supabase/migrations/0001_init.sql` | `talos_spend_ledger` table (lines 148-165) |
