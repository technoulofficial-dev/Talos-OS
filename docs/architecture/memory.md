# Memory System — Cortex + Nornir

## 1. Purpose

The Memory system implements **infinite user memory with 3-layer compression** for Talos OS. It persists across sessions, compresses automatically as conversation history grows, and provides semantic retrieval for relevant past context. The system is split into two cooperating subsystems:

- **Cortex** (`@talos/memory/src/cortex.ts`) — The identity core and rolling conversation window, capped at ~12,000 tokens.
- **Nornir** (`@talos/memory/src/nornir.ts`) — The three fates of memory: maintenance, summarization, and predictive prefetch.

Both are backed by three Supabase tables and exposed through `@talos/db/memory`.

> **Blueprint Reference:** Sections 8.1 (Cortex) and 8.2 (Nornir) of the Talos OS Blueprint.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     @talos/memory                           │
│                                                             │
│  ┌──────────────┐          ┌──────────────────────────────┐ │
│  │   Cortex     │◄────────►│         Nornir               │ │
│  │              │          │                              │ │
│  │ IdentityCore │          │  Urd (Past)                  │ │
│  │ ThreadOfFate │          │  Verdandi (Present)          │ │
│  │ ThreadDigest │          │  Skuld (Future)              │ │
│  └──────┬───────┘          └──────────────┬───────────────┘ │
│         │                                 │                 │
│  ┌──────▼─────────────────────────────────▼──────────┐      │
│  │              @talos/db/memory                      │      │
│  │  getOrCreateCortex · updateCortex · appendToThread │      │
│  │  updateIdentityCore · addNornirMarker             │      │
│  └──────────────────────┬────────────────────────────┘      │
│                         │                                   │
└─────────────────────────┼───────────────────────────────────┘
                          │
              ┌───────────▼───────────┐
              │   Supabase Tables     │
              │  talos_cortex         │
              │  talos_nornir_markers │
              │  talos_memory_vectors │
              └───────────────────────┘
```

---

## 3. Cortex (User Identity Core)

### 3.1 Class: `Cortex`

Location: `packages/memory/src/cortex.ts`

The `Cortex` class is the primary interface for reading and writing user memory. It wraps a `CortexRecord` loaded from Supabase and provides methods for message ingestion, identity updates, compression, and retrieval.

```typescript
export class Cortex {
  private userId: string;
  private record: CortexRecord | null = null;

  constructor(userId: string) {
    this.userId = userId;
  }
}
```

**Key constants:**

| Constant | Value | Description |
|---|---|---|
| `MAX_VERBATIM_TURNS` | 50 | Max full-text messages in recent layer |
| `MAX_MIDRANGE_SUMMARIES` | 8 | Max compressed blocks in mid-range |
| `TOKEN_BUDGET` | 12,000 | Hard token cap for entire Cortex |

### 3.2 Methods

#### `load(): Promise<CortexRecord>`

Loads the Cortex from Supabase, or creates a new one with empty defaults. Called automatically by other methods if not already loaded.

```typescript
async load(): Promise<CortexRecord> {
  this.record = await getOrCreateCortex(this.userId);
  return this.record;
}
```

#### `snapshot(): Promise<CortexSnapshot>`

Returns a read-only snapshot of the current Cortex state with computed token estimates and consolidation flags.

```typescript
export interface CortexSnapshot {
  userId: string;
  identityCore: IdentityCore;
  threadOfFate: ThreadOfFate;
  threadDigest: string;
  estimatedTokens: number;
  budgetUsedPct: number;       // 0-100
  needsConsolidation: boolean;  // true if >80% verbatim or >80% token budget
}
```

The `needsConsolidation` flag is `true` when:
- Verbatim messages exceed 80% of `MAX_VERBATIM_TURNS` (i.e., >40 turns), OR
- Estimated tokens exceed 80% of the 12,000 token budget.

#### `addMessage(message): Promise<CortexSnapshot>`

Appends a new message to the Thread of Fate's verbatim layer. Automatically triggers progressive compression when verbatim count exceeds 80% of `MAX_VERBATIM_TURNS` (40 messages).

```typescript
async addMessage(message: {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: string;
}): Promise<CortexSnapshot>
```

The message is appended via `appendToThread()` in `@talos/db/memory`, which handles the Supabase upsert. After appending, if `verbatim.length > 40`, the oldest 20 messages are compressed into a single mid-range summary.

#### `updateIdentity(updates): Promise<CortexSnapshot>`

Merges partial updates into the Identity Core (goals, personality, heuristics, preferences).

```typescript
async updateIdentity(updates: Partial<IdentityCore>): Promise<CortexSnapshot>
```

Delegates to `updateIdentityCore()` in `@talos/db/memory`.

#### `compressVerbatim(): Promise<void>`

Compresses the oldest 20 verbatim messages into a single mid-range summary block. If mid-range exceeds `2 * MAX_MIDRANGE_SUMMARIES` (16 entries), the oldest 8 summaries are consolidated into a distant episodic marker.

**Compression pipeline:**
1. Splice first 20 messages from `verbatim[]`
2. Create summary string: `[Block of 20 turns: {first.timestamp} → {last.timestamp}]`
3. Push summary to `midRange[]`
4. If `midRange.length > 16`, splice oldest 8 into a distant marker: `[{count} summaries consolidated at {timestamp}]`
5. Persist to Supabase via `updateCortex()`

> **Production note:** In production, step 2 would invoke Nornir's Verdandi to generate an LLM-powered summary instead of the placeholder format string.

#### `retrieveContext(query, topK?): Promise<string[]>`

Searches all Thread of Fate layers by keyword matching. Returns up to `topK` (default 3) results ranked by relevance score.

| Layer | Score |
|---|---|
| Verbatim match | 1.0 |
| Mid-range match | 0.6 |
| Distant | Not searched (markers are too compressed) |

> **Production note:** The production implementation will use vector embeddings stored in `talos_memory_vectors` for semantic search instead of keyword matching.

#### `consolidate(): Promise<void>`

Force-runs a full consolidation cycle. Called by Nornir's nightly cron. Compresses all verbatim beyond 50 turns into mid-range blocks, then caps mid-range to 8 entries (excess becomes distant markers).

---

## 4. Thread of Fate — 3-Layer Memory Model

The Thread of Fate is the core data structure within the Cortex. It implements progressive compression to maintain a bounded token footprint while preserving as much context as possible.

```
Thread of Fate
├── Layer 1: Recent (verbatim)     — Last 50 turns, full text
├── Layer 2: Mid-range (summaries) — 8 blocks × 20 turns = 160 turns
└── Layer 3: Distant (markers)     — >200 turns, episodic markers
```

### 4.1 Layer 1: Recent (Verbatim)

- **Capacity:** 50 messages (configurable via `MAX_VERBATIM_TURNS`)
- **Content:** Full message text (`role`, `content`, `timestamp`)
- **Token cost:** ~`content.length / 4` tokens per message
- **Compression trigger:** When count exceeds 40 (80% of 50), oldest 20 are compressed

This layer provides the AI with exact recent conversation history, enabling coherent multi-turn dialogue.

### 4.2 Layer 2: Mid-range (Compressed Summaries)

- **Capacity:** 8 summary blocks (configurable via `MAX_MIDRANGE_SUMMARIES`)
- **Content:** String summaries, each representing ~20 compressed turns
- **Coverage:** 8 × 20 = 160 turns in compressed form
- **Token cost:** ~`summary.length / 4` tokens per block (significantly less than verbatim)
- **Overflow:** When count exceeds 16 (2× capacity), oldest 8 summaries become distant markers

### 4.3 Layer 3: Distant (Episodic Markers)

- **Capacity:** Unbounded (archival)
- **Content:** One-line markers representing consolidated groups of summaries
- **Token cost:** Minimal (~20-50 tokens per marker)
- **Purpose:** Provides metadata about very old conversations without consuming budget

Example marker: `[8 summaries consolidated at 2026-06-05T15:00:00Z]`

### 4.4 Token Budget

The entire Cortex is capped at **12,000 tokens**. The estimated token breakdown:

| Component | Estimated Tokens |
|---|---|
| Identity Core | ~500 |
| Recent (50 turns) | ~2,500-5,000 (varies) |
| Mid-range (8 blocks) | ~800-1,600 |
| Distant markers | ~100-500 |
| Thread Digest | ~50-100 |
| **Total** | **~4,000-7,700** |

Token estimation uses the heuristic: `Math.ceil(text.length / 4)` (4 characters per token).

---

## 5. Compression Algorithm

The compression follows a **progressive** pattern:

```
New Message → verbatim[49] → verbatim[50] (triggers compression)
                ↓
         splice oldest 20 → create summary → push to midRange
                ↓
         midRange > 16? → splice oldest 8 → create marker → push to distant
```

### 5.1 Compression Flow

1. **Trigger:** `addMessage()` detects `verbatim.length > 40` (80% threshold)
2. **Step 1 — Verbatim → Mid-range:**
   - Remove oldest 20 messages from `verbatim[]`
   - Generate summary: `[Block of 20 turns: {start} → {end}]`
   - Append summary to `midRange[]`
3. **Step 2 — Mid-range → Distant (if needed):**
   - If `midRange.length > 16`, remove oldest 8 summaries
   - Create marker: `[8 summaries consolidated at {timestamp}]`
   - Append marker to `distant[]`
4. **Step 3 — Persist:** Write entire Cortex record to Supabase

### 5.2 Consolidation (Nightly)

The `consolidate()` method enforces hard limits:
- Verbatim is capped at 50 (excess compressed to mid-range)
- Mid-range is capped at 8 (excess archived to distant)

This runs via Nornir's nightly cron at 3 AM.

---

## 6. Nornir (Three Fates of Memory)

### 6.1 Overview

Nornir is the maintenance orchestrator for the Memory system. Named after the three Norns from Norse mythology who control destiny, it runs three phases:

| Fate | Role | Function |
|---|---|---|
| **Urd** | Past | Maintains Identity Core, analyzes episodic markers for patterns |
| **Verdandi** | Present | Progressive summarization, Thread Digest updates |
| **Skuld** | Future | Predictive retrieval, pre-fetches context for scheduled tasks |

### 6.2 Urd (Past) — `runUrdMaintenance()`

```typescript
export async function runUrdMaintenance(userId: string): Promise<{
  updated: boolean;
  markersAdded: number;
}>
```

**What it does:**
1. Loads the user's Cortex
2. Fetches the 20 most recent Nornir markers from `talos_nornir_markers`
3. Detects identity patterns (goal statements, preference expressions)
4. If patterns are found, updates the Identity Core and records a maintenance marker

**Marker event types analyzed:**
- `"goal-stated"` — User has articulated a goal
- `"preference-expressed"` — User has expressed a preference

### 6.3 Verdandi (Present) — `runVerdandiSummarization()`

```typescript
export async function runVerdandiSummarization(userId: string): Promise<{
  compressed: boolean;
  summariesRemoved: number;
  digestUpdated: boolean;
}>
```

**What it does:**
1. Checks if consolidation is needed (`snapshot.needsConsolidation`)
2. If not needed, returns early with no-op
3. If needed, calls `cortex.consolidate()` to compress verbatim
4. Generates a Thread Digest via LLM (using `routeUnlimited` with `talos:fast` model)
5. Returns the number of messages compressed and whether the digest was updated

**Thread Digest generation:**

The digest is a 1-2 sentence summary of the last 10 verbatim messages, generated by calling the AI engine:

```typescript
const response = await routeUnlimited({
  prompt: `Generate a concise thread digest (1-2 sentences) summarizing...`,
  agentId: "nornir-verdandi",
  model: "talos:fast",
  maxTokens: 200,
});
```

### 6.4 Skuld (Future) — `runSkuldPreFetch()`

```typescript
export async function runSkuldPreFetch(userId: string): Promise<{
  preFetched: number;
  tasksAnalyzed: number;
}>
```

**What it does:**
1. Fetches queued tasks with upcoming deadlines from `@talos/db/tasks`
2. For each task, searches the Cortex for relevant context using keyword matching
3. Returns the count of pre-fetched context items and tasks analyzed

This enables the system to proactively load relevant past context before a scheduled task executes.

### 6.5 Nightly Consolidation — `runNightlyConsolidation()`

```typescript
export async function runNightlyConsolidation(userId: string): Promise<ConsolidationResult>
```

**Schedule:** `0 3 * * *` (3 AM daily via cron)

**Stages executed sequentially:**

| Stage | Name | What it does | Failure handling |
|---|---|---|---|
| 1 | Urd | Pattern analysis + Identity Core update | Error recorded, continues |
| 2 | Verdandi | Compression + Digest generation | Error recorded, continues |
| 3 | Skuld | Pre-fetch for upcoming tasks | Error recorded, continues |
| 4 | Cleanup | Force-compress if verbatim > 200 | Error recorded, continues |

Each stage is wrapped in try/catch. Errors are collected and returned in the `errors[]` array without aborting subsequent stages.

**Return type:**

```typescript
export interface ConsolidationResult {
  userId: string;
  stages: {
    urd: { updated: boolean; markersAdded: number };
    verdandi: { compressed: boolean; summariesRemoved: number; digestUpdated: boolean };
    skuld: { preFetched: number; tasksAnalyzed: number };
  };
  durationMs: number;
  errors: string[];
}
```

### 6.6 Episodic Markers — `recordNornirMarker()`

```typescript
export async function recordNornirMarker(marker: NornirMarker): Promise<NornirMarker>
```

Stores an episodic marker in `talos_nornir_markers`. Markers are created by Urd maintenance and can be created by any system component to record significant events.

```typescript
export interface NornirMarker {
  userId: string;
  timestamp: string;
  eventType: string;          // e.g., "goal-stated", "urd-maintenance"
  summary: string;
  entities: string[];
  importanceScore: number;    // 0.0 - 1.0
  embedding?: number[];       // 1536-dimensional vector
}
```

---

## 7. Database Tables

### 7.1 `talos_cortex`

Stores the per-user Cortex record. One row per user.

```sql
CREATE TABLE IF NOT EXISTS talos_cortex (
  user_id uuid PRIMARY KEY,
  identity_core jsonb NOT NULL DEFAULT '{}',
  thread_of_fate jsonb NOT NULL DEFAULT '{"verbatim":[],"midRange":[],"distant":[]}',
  thread_digest text DEFAULT '',
  updated_at timestamptz DEFAULT now()
);
```

**Column mapping (DB → TypeScript):**

| DB Column | TypeScript Field | Type |
|---|---|---|
| `user_id` | `userId` | `string` (UUID) |
| `identity_core` | `identityCore` | `IdentityCore` (JSONB) |
| `thread_of_fate` | `threadOfFate` | `ThreadOfFate` (JSONB) |
| `thread_digest` | `threadDigest` | `string` |
| `updated_at` | `updatedAt` | `string` (ISO timestamp) |

### 7.2 `talos_nornir_markers`

Stores episodic markers for long-term memory. One row per event.

```sql
CREATE TABLE IF NOT EXISTS talos_nornir_markers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  timestamp timestamptz NOT NULL,
  event_type text,
  summary text,
  entities jsonb DEFAULT '[]',
  importance_score float DEFAULT 0.5,
  embedding vector(1536),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nornir_user ON talos_nornir_markers(user_id);
```

**Key features:**
- `embedding vector(1536)` — pgvector column for semantic search (OpenAI ada-002 dimensions)
- `importance_score float` — 0.0 to 1.0, used for retrieval ranking
- Indexed on `user_id` for fast per-user queries

### 7.3 `talos_memory_vectors`

Stores file-based memory chunks with embeddings. Used for knowledge retrieval from project files.

```sql
CREATE TABLE IF NOT EXISTS talos_memory_vectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source_path text NOT NULL,
  chunk_text text NOT NULL,
  embedding vector(1536),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_memory_vectors_user ON talos_memory_vectors(user_id);
```

**Usage:** This table is populated by the graphify system and provides vector search over file contents. The Cortex's `retrieveContext()` method can be extended to query this table for semantic retrieval.

---

## 8. DB Layer (`@talos/db/memory`)

Location: `packages/db/src/memory.ts`

The DB layer provides pure data-access functions with no business logic. All functions accept a userId and return mapped TypeScript types.

### 8.1 Functions

| Function | Description |
|---|---|
| `getOrCreateCortex(userId)` | Get existing Cortex or create empty default |
| `updateCortex(cortex)` | Upsert entire Cortex record |
| `appendToThread(userId, message)` | Append message + auto-compress at 50 turns |
| `updateIdentityCore(userId, updates)` | Merge partial updates into Identity Core |
| `addNornirMarker(marker)` | Insert episodic marker |
| `getNornirMarkers(userId, limit?)` | Get recent markers (default 50) |

### 8.2 Default Values

```typescript
const DEFAULT_THREAD: ThreadOfFate = {
  verbatim: [],
  midRange: [],
  distant: [],
};

const DEFAULT_IDENTITY: IdentityCore = {
  longTermGoals: [],
  personality: {},
  decisionHeuristics: [],
  preferences: {},
};
```

### 8.3 Data Mapping

DB rows use `snake_case` columns; TypeScript uses `camelCase`. The `mapCortexFromDb()` and `mapMarkerFromDb()` functions handle the conversion:

```typescript
function mapCortexFromDb(row: Record<string, unknown>): CortexRecord {
  return {
    userId: row.user_id as string,
    identityCore: (row.identity_core as IdentityCore) ?? { ...DEFAULT_IDENTITY },
    threadOfFate: (row.thread_of_fate as ThreadOfFate) ?? { ...DEFAULT_THREAD },
    threadDigest: (row.thread_digest as string) ?? "",
    updatedAt: row.updated_at as string | undefined,
  };
}
```

---

## 9. API Integration — Memory Context Injection

### 9.1 How Memory Enters AI Requests

The Memory system injects context into AI requests at two points:

**1. Thread of Fate (automatic):**

When an AI agent processes a user message, the current Cortex snapshot is included in the system prompt context. The 12,000 token budget ensures this never exceeds the model's context window.

**2. Retrieved Context (on-demand):**

Agents can call `cortex.retrieveContext(query)` to pull relevant past conversations. This is useful for:
- Answering questions about past discussions
- Maintaining continuity across sessions
- Referencing previously established preferences

### 9.2 Context Budget Tracker

Location: `packages/core/src/cortex/context-budget.ts`

The `checkContextBudget()` function monitors token usage within a session and triggers snapshotting at 95% of the context window:

```typescript
export function checkContextBudget(
  estimatedTokens: number,
  maxContextTokens: number,
  currentUsageTokens: number = 0
): ContextBudget
```

**Severity levels:**

| Threshold | Severity | Action |
|---|---|---|
| <80% | `ok` | No action |
| 80-95% | `warning` | Log warning, suggest wrapping up |
| ≥95% | `snapshot` | Snapshot session to Supabase, reset context |

### 9.3 Session Snapshots

When the context budget hits 95%, the current session state is snapshotted:

```typescript
export interface SessionSnapshot {
  sessionId: string;
  snapshotId: string;
  threadOfFate: unknown;
  identityCore: unknown;
  turnCount: number;
  lastMessageAt: Date;
  reason: string;
  estimatedTokens: number;
}
```

Snapshots are stored in-memory (Phase 1) and will be persisted to Supabase in Phase 2.

---

## 10. Token Estimation

Both the Cortex and the Context Budget Tracker use the same token estimation heuristic:

```typescript
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4); // 4 chars per token
}
```

**Accuracy:** This is a rough approximation. Actual tokenization varies by model (cl100k_base for GPT-4, custom for others). For production accuracy, integrate `tiktoken` or model-specific tokenizers.

**Conversation estimation** adds per-message overhead:

```typescript
function estimateConversationTokens(
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string = ""
): number {
  const msgTokens = messages.reduce((sum, m) => {
    return sum + estimateTokens(m.content) + 10; // ~10 tokens overhead per message
  }, 0);
  const systemTokens = estimateTokens(systemPrompt) + 20;
  return systemTokens + msgTokens;
}
```

---

## 11. Testing

### 11.1 Memory Package Tests

The `@talos/memory` package is tested via `@talos/core` integration tests. Key test coverage areas:

- **Cortex load/create:** Verifying `getOrCreateCortex` creates empty defaults for new users
- **Message ingestion:** Verifying `addMessage` appends to verbatim and triggers compression
- **Compression:** Verifying verbatim → mid-range → distant pipeline
- **Consolidation:** Verifying `consolidate()` enforces hard limits
- **Identity updates:** Verifying partial merge behavior
- **Retrieval:** Verifying keyword search across layers
- **Nornir maintenance:** Verifying Urd pattern detection
- **Nightly consolidation:** Verifying all 4 stages execute and errors are collected

### 11.2 Context Budget Tests

The context budget tracker has its own test suite covering:

- Budget severity calculation at different thresholds
- Snapshot creation and retrieval
- Token estimation accuracy
- Conversation token estimation with system prompts

### 11.3 Test Patterns

Tests use vitest with injected mock Supabase clients:

```typescript
// Mock pattern for DB functions
const mockClient = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } }),
  insert: vi.fn().mockReturnThis(),
  upsert: vi.fn().mockReturnThis(),
};
```

---

## 12. Public API Exports

From `packages/memory/src/index.ts`:

```typescript
export { Cortex, type CortexSnapshot } from "./cortex.js";
export {
  runUrdMaintenance,
  runVerdandiSummarization,
  runSkuldPreFetch,
  runNightlyConsolidation,
  recordNornirMarker,
  type NornirMarker,
  type ConsolidationResult,
} from "./nornir.js";
```

From `packages/db/src/memory.ts`:

```typescript
export {
  getOrCreateCortex,
  updateCortex,
  appendToThread,
  updateIdentityCore,
  addNornirMarker,
  getNornirMarkers,
  type CortexRecord,
  type IdentityCore,
  type ThreadOfFate,
  type NornirMarkerRecord,
}
```

---

## 13. Production Roadmap

| Phase | What changes |
|---|---|
| **Phase 1 (current)** | In-memory snapshots, keyword search, placeholder summaries |
| **Phase 2** | Snapshot persistence to Supabase, vector embeddings via `talos_memory_vectors` |
| **Phase 3** | LLM-powered summarization in Verdandi (replace placeholder format strings), semantic retrieval via pgvector cosine similarity |
| **Phase 4** | Cross-user memory patterns, memory sharing/transfer, memory export/import |

---

## 14. File Reference

| File | Purpose |
|---|---|
| `packages/memory/src/cortex.ts` | Cortex class — identity core + thread of fate |
| `packages/memory/src/nornir.ts` | Nornir — three fates maintenance orchestrator |
| `packages/memory/src/index.ts` | Public API exports |
| `packages/core/src/cortex/context-budget.ts` | Context budget tracker + session snapshots |
| `packages/core/src/types/cortex.ts` | Cortex type definitions |
| `packages/db/src/memory.ts` | DB layer — Supabase CRUD for cortex + nornir |
| `supabase/migrations/0001_init.sql` | Table definitions (lines 112-146) |
