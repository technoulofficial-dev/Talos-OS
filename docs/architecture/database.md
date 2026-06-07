# Talos OS — Supabase Database Layer

> **Version:** 8.0 · **Package:** `@talos/db` · **Schema:** `public` · **Migrations:** 3

---

## 1. Purpose

The `@talos/db` package is the database abstraction layer for Talos OS. It provides typed access to **16 tables** in a Supabase-hosted PostgreSQL database, with Row-Level Security (RLS) on every table, pgvector embeddings for semantic memory search, and a real-time subscription API for live agent/task state changes.

All tables are prefixed with `talos_`. The database serves as the persistence layer for the agent registry, task queue, auction system, user memory (Cortex + Nornir), spend tracking, plugin management, workflow definitions, and the knowledge graph.

### Key Design Principles

- **Service-role only:** All writes use the Supabase `service_role` key (bypasses RLS). Reads are publicly allowed via RLS policies.
- **Optional client injection:** Every DB function accepts an optional `client` parameter for testability. Tests inject mock clients; production uses the singleton from `getSupabaseClient()`.
- **Structural types:** `@talos/db` defines its own types (`AgentRecord`, `TaskRecord`, etc.) without importing from `@talos/core`. The dependency graph flows one way: `core → db`.
- **Dual-mode persistence:** The workflow module operates in JSON-file mode by default, with Supabase as an opt-in backend via `TALOS_WORKFLOW_DB_ENABLED=true`.

---

## 2. Client Management

The Supabase client is managed as a module-level singleton in `packages/db/src/client.ts`.

### `createSupabaseClient(config)`

Initializes the global Supabase client with the service role key. Disables `autoRefreshToken` and `persistSession` (server-side only). Sets the default schema to `public`.

```typescript
import { createSupabaseClient } from "@talos/db";

createSupabaseClient({
  url: process.env.SUPABASE_URL!,
  serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
});
```

### `getSupabaseClient()`

Returns the existing client, or auto-initializes from `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` environment variables. Throws if both are missing.

```typescript
const client = getSupabaseClient();
// Throws: "Supabase client not initialized. Call createSupabaseClient() first or set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars."
```

### `resetSupabaseClient()`

Sets the singleton to `null`. Used in tests to ensure isolation between test cases.

```typescript
afterEach(() => {
  resetSupabaseClient();
});
```

### Exported Types

| Type | Description |
|------|-------------|
| `SupabaseClient` | Re-exported from `@supabase/supabase-js` |
| `SupabaseConfig` | `{ url: string; serviceKey: string }` |

---

## 3. Tables

### 3.1 `talos_guilds` — Agent Guilds

Guilds group agents that share tools, permissions, and prompt templates. An agent belongs to at most one guild.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, `gen_random_uuid()` | Unique identifier |
| `name` | `text` | `NOT NULL, UNIQUE` | Machine name (e.g., `"dev-guild"`) |
| `display_name` | `text` | `NOT NULL` | Human-readable name |
| `description` | `text` | | Optional description |
| `shared_tools` | `jsonb` | `DEFAULT '[]'` | Array of tool names shared by guild members |
| `prompt_template` | `text` | | Shared system prompt template |
| `permissions` | `jsonb` | `DEFAULT '[]'` | Array of permission strings |
| `created_at` | `timestamptz` | `DEFAULT now()` | Creation timestamp |

**RLS:** Read-all for authenticated users; write only via `service_role`.

---

### 3.2 `talos_devices` — G0DM0D3 Device Registry

Tracks LAN peers discovered by the G0DM0D3 decentralized AI protocol. Each device advertises its local AI capabilities, VRAM, and heartbeat status.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, `gen_random_uuid()` | Unique identifier |
| `hostname` | `text` | `NOT NULL` | Device hostname |
| `local_endpoint_url` | `text` | `NOT NULL` | LAN URL (e.g., `http://192.168.1.50:11434`) |
| `has_local_ai` | `boolean` | `DEFAULT true` | Whether device runs local inference |
| `status` | `text` | `CHECK IN ('online','offline','decommissioned')` | Device status |
| `capability_score` | `float` | `DEFAULT 0.5` | Performance score (0–1) |
| `models_available` | `jsonb` | `DEFAULT '[]'` | Array of available model names |
| `vram_estimate_gb` | `float` | | Estimated VRAM in GB |
| `last_heartbeat` | `timestamptz` | `DEFAULT now()` | Last heartbeat timestamp |
| `discovered_at` | `timestamptz` | `DEFAULT now()` | Discovery timestamp |
| `updated_at` | `timestamptz` | `DEFAULT now()` | Last update timestamp |

**Indexes:** `idx_devices_status` on `status`.

---

### 3.3 `talos_agents` — Agent Registry

The central registry for all Talos agents (Odin, Brokkr, Mimir, etc.). Tracks model configuration, capabilities, load, and real-time status.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, `gen_random_uuid()` | Unique identifier |
| `agent_id` | `text` | `NOT NULL, UNIQUE` | Machine name (e.g., `"odin"`) |
| `name` | `text` | `NOT NULL` | Display name |
| `guild_id` | `uuid` | FK → `talos_guilds(id)` | Guild membership |
| `role` | `text` | `NOT NULL` | Agent role (e.g., `"orchestrator"`) |
| `primary_model` | `text` | `NOT NULL` | Default model ID |
| `cloud_model` | `text` | `NOT NULL` | Cloud fallback model |
| `local_model` | `text` | | Optional local model ID |
| `max_context_tokens` | `int` | `NOT NULL` | Maximum context window |
| `capabilities` | `jsonb` | `DEFAULT '[]'` | `[{ skill: string, proficiency: number }]` |
| `tools` | `jsonb` | `DEFAULT '[]'` | Array of tool names |
| `pinned` | `boolean` | `DEFAULT false` | Whether agent is pinned to device |
| `docker_image` | `text` | | Docker image for containerized agents |
| `version` | `text` | `DEFAULT '1.0.0'` | Agent version |
| `capability_score` | `float` | `DEFAULT 0.5` | Composite capability score (0–1) |
| `current_load` | `float` | `DEFAULT 0.0` | Current utilization (0–1) |
| `status` | `text` | `CHECK IN ('idle','bidding','executing','offline','provisioning','error')` | Current state |
| `created_at` | `timestamptz` | `DEFAULT now()` | Creation timestamp |
| `updated_at` | `timestamptz` | `DEFAULT now()` | Last update timestamp |

**Indexes:** None explicit in migration (queried by `agent_id` which is `UNIQUE`).

**DB Module:** `packages/db/src/agents.ts`

| Function | Description |
|----------|-------------|
| `registerAgent(agent)` | Upsert agent by `agent_id` |
| `getAgent(agentId)` | Get single agent by `agent_id` |
| `listAgents(status?)` | List all agents, optionally filtered by status |
| `updateAgentScore(agentId, score)` | Update capability score (clamped 0–1) |
| `updateAgentLoad(agentId, load)` | Update current load (clamped 0–1) |
| `updateAgentStatus(agentId, status)` | Update status |
| `registerGuild(guild)` | Upsert guild by `name` |
| `subscribeToAgents(onChange)` | Real-time subscription to agent changes |

---

### 3.4 `talos_tasks` — Task Queue

The task queue manages the full lifecycle of work items: creation, auctioning, assignment, execution, retry, and completion.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, `gen_random_uuid()` | Unique identifier |
| `description` | `text` | `NOT NULL` | Task description |
| `origin_agent` | `text` | `NOT NULL, DEFAULT 'system'` | Creating agent |
| `status` | `text` | `CHECK IN ('pending','queued','auctioning','assigned','executing','reviewing','completed','failed','cancelled','timeout')` | Current state |
| `priority` | `text` | `CHECK IN ('low','normal','high','critical')` | Priority level |
| `required_skills` | `jsonb` | `DEFAULT '[]'` | Required skill names |
| `max_tokens` | `int` | `DEFAULT 100000` | Token budget |
| `max_cost_usd` | `float` | `DEFAULT 10` | Cost cap in USD |
| `assigned_agent` | `text` | | Assigned agent ID |
| `auction_id` | `uuid` | FK → `talos_auctions(id)` | Associated auction |
| `plan_graph` | `jsonb` | | Execution plan (DAG) |
| `output` | `text` | | Task result |
| `error` | `text` | | Error message |
| `error_code` | `text` | | Error classification |
| `tokens_used` | `int` | `DEFAULT 0` | Consumed tokens |
| `cost_usd` | `float` | `DEFAULT 0` | Actual cost |
| `duration_ms` | `int` | `DEFAULT 0` | Execution time |
| `retry_count` | `int` | `DEFAULT 0` | Current retry number |
| `max_retries` | `int` | `DEFAULT 3` | Maximum retries |
| `idempotency_key` | `text` | | Deduplication key |
| `prefer_local` | `boolean` | `DEFAULT true` | Prefer local execution |
| `depends_on` | `jsonb` | `DEFAULT '[]'` | Dependent task IDs |
| `context` | `jsonb` | `DEFAULT '{}'` | Arbitrary context payload |
| `deadline` | `timestamptz` | | Optional deadline |
| `created_at` | `timestamptz` | `DEFAULT now()` | Creation timestamp |
| `updated_at` | `timestamptz` | `DEFAULT now()` | Last update timestamp |
| `completed_at` | `timestamptz` | | Completion timestamp |

**Indexes:** `idx_tasks_status` on `status`, `idx_tasks_agent` on `assigned_agent`.

**DB Module:** `packages/db/src/tasks.ts`

| Function | Description |
|----------|-------------|
| `createTask(input)` | Create a new task (status: `queued`) |
| `getTask(taskId)` | Get task by ID |
| `listTasks(status?, options?)` | List tasks ordered by creation time, with pagination |
| `claimTask(taskId, agentId)` | Atomic claim: update status to `processing` only if currently `queued` |
| `completeTask(taskId, result)` | Mark as done with output, tokens, cost, duration |
| `failTask(taskId, error)` | Mark as failed; returns `{ willRetry, nextRetryAt }` with exponential backoff |
| `cancelTask(taskId)` | Cancel if still `pending` or `queued` |
| `subscribeToTasks(onChange)` | Real-time subscription to task changes |

**Retry Backoff:** 30s → 5min → 30min (exponential, capped at 3 retries).

---

### 3.5 `talos_auctions` — The Loom Auction System

The Loom is Talos's decentralized task allocation system. When a task enters auctioning, agents bid based on capability, load, and estimated cost.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, `gen_random_uuid()` | Unique identifier |
| `task_id` | `uuid` | FK → `talos_tasks(id)` | Associated task |
| `announcement` | `jsonb` | `NOT NULL` | Task requirements broadcast to agents |
| `bids` | `jsonb` | `NOT NULL, DEFAULT '[]'` | Array of `BidRecord` objects |
| `winner_agent_id` | `text` | | Winning agent ID |
| `status` | `text` | `CHECK IN ('announced','bidding','settled','executing','completed','failed','timeout')` | Auction state |
| `settled_at` | `timestamptz` | | Settlement timestamp |
| `performance_score` | `float` | | Post-execution score |
| `created_at` | `timestamptz` | `DEFAULT now()` | Creation timestamp |

**BidRecord shape:**
```typescript
{
  agentId: string;
  capabilityScore: number;
  load: number;
  estimatedCost: number;
  submittedAt: string;
}
```

**DB Module:** `packages/db/src/auctions.ts`

| Function | Description |
|----------|-------------|
| `createAuction(input)` | Create auction with optional initial bids |
| `getAuction(auctionId)` | Get auction by ID |
| `addBid(auctionId, bid)` | Append a bid (only if status is `bidding`) |
| `settleAuction(auctionId, winnerAgentId, performanceScore?)` | Mark as settled with winner |
| `expireAuction(auctionId)` | Mark as expired (no valid bids) |

---

### 3.6 `talos_cortex` — User Cortex

The Cortex is the persistent user identity store. It holds the user's long-term goals, personality profile, decision heuristics, and the "Thread of Fate" — a conversation memory system with progressive compression.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `user_id` | `uuid` | PK | User identifier |
| `identity_core` | `jsonb` | `NOT NULL, DEFAULT '{}'` | Identity profile (see below) |
| `thread_of_fate` | `jsonb` | `NOT NULL, DEFAULT '{"verbatim":[],"midRange":[],"distant":[]}'` | Three-tier conversation memory |
| `thread_digest` | `text` | `DEFAULT ''` | Hash digest of the thread |
| `updated_at` | `timestamptz` | `DEFAULT now()` | Last update timestamp |

**IdentityCore shape:**
```typescript
{
  userId?: string;
  longTermGoals: string[];
  personality: Record<string, unknown>;
  decisionHeuristics: string[];
  preferences: Record<string, unknown>;
}
```

**ThreadOfFate shape:**
```typescript
{
  verbatim: Array<{ role: "user"|"assistant"|"system"; content: string; timestamp: string }>;
  midRange: string[];   // compressed summaries of older verbatim blocks
  distant: string[];    // long-term summaries
}
```

**Progressive compression:** When `verbatim` exceeds 50 entries, the oldest 20 are compressed into a single `midRange` summary.

**DB Module:** `packages/db/src/memory.ts`

| Function | Description |
|----------|-------------|
| `getOrCreateCortex(userId)` | Get existing cortex or create a new one with defaults |
| `updateCortex(cortex)` | Upsert the entire cortex |
| `appendToThread(userId, message)` | Append message to verbatim; auto-compress if >50 |
| `updateIdentityCore(userId, updates)` | Merge partial updates into identity core |

---

### 3.7 `talos_nornir_markers` — Episodic Markers

The Nornir system records episodic events (user actions, system events, agent decisions) with vector embeddings for semantic search.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, `gen_random_uuid()` | Unique identifier |
| `user_id` | `uuid` | `NOT NULL` | Owner user ID |
| `timestamp` | `timestamptz` | `NOT NULL` | Event timestamp |
| `event_type` | `text` | | Event classification |
| `summary` | `text` | | Human-readable summary |
| `entities` | `jsonb` | `DEFAULT '[]'` | Related entity names |
| `importance_score` | `float` | `DEFAULT 0.5` | Importance weight (0–1) |
| `embedding` | `vector(1536)` | | OpenAI ada-002 embedding vector |
| `created_at` | `timestamptz` | `DEFAULT now()` | Creation timestamp |

**Indexes:** `idx_nornir_user` on `user_id`.

**DB Module:** `packages/db/src/memory.ts`

| Function | Description |
|----------|-------------|
| `addNornirMarker(marker)` | Insert a new episodic marker |
| `getNornirMarkers(userId, limit?)` | Get recent markers for a user (default limit: 50) |

---

### 3.8 `talos_memory_vectors` — File-Based Memory

Stores vector embeddings of file chunks for semantic search across the user's file-based memory (Obsidian vault, docs, etc.).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, `gen_random_uuid()` | Unique identifier |
| `user_id` | `uuid` | `NOT NULL` | Owner user ID |
| `source_path` | `text` | `NOT NULL` | File path (e.g., `vault/notes/idea.md`) |
| `chunk_text` | `text` | `NOT NULL` | Text chunk content |
| `embedding` | `vector(1536)` | | OpenAI ada-002 embedding vector |
| `metadata` | `jsonb` | `DEFAULT '{}'` | Arbitrary metadata (line range, tags, etc.) |
| `created_at` | `timestamptz` | `DEFAULT now()` | Creation timestamp |

**Indexes:** `idx_memory_vectors_user` on `user_id`.

**pgvector usage:** Embeddings are queried using cosine distance (`<=>` operator) for nearest-neighbor search:

```sql
SELECT * FROM talos_memory_vectors
WHERE user_id = $1
ORDER BY embedding <=> $2
LIMIT 10;
```

---

### 3.9 `talos_spend_ledger` — Budget Tracking

Tracks token usage and costs per agent, per provider, per billing period.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, `gen_random_uuid()` | Unique identifier |
| `agent_id` | `text` | `NOT NULL` | Agent that incurred the cost |
| `provider_id` | `text` | `NOT NULL` | AI provider (e.g., `"openai"`, `"ollama"`) |
| `task_id` | `uuid` | | Associated task |
| `tokens_in` | `int` | `DEFAULT 0` | Input tokens |
| `tokens_out` | `int` | `DEFAULT 0` | Output tokens |
| `total_tokens` | `int` | `DEFAULT 0` | Total tokens |
| `cost_usd` | `float` | `DEFAULT 0` | Cost in USD |
| `period_id` | `text` | `NOT NULL` | Billing period (e.g., `"2026-06"`) |
| `created_at` | `timestamptz` | `DEFAULT now()` | Creation timestamp |

**Indexes:** `idx_spend_period` on `period_id`, `idx_spend_agent` on `agent_id`.

---

### 3.10 `talos_settings` — Master Runtime Config

Key-value store for system-wide configuration. Mirrors the `settings.json` file for Supabase-backed deployments.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `key` | `text` | PK | Configuration key |
| `value` | `jsonb` | `NOT NULL` | Configuration value (arbitrary JSON) |
| `updated_at` | `timestamptz` | `DEFAULT now()` | Last update timestamp |

---

### 3.11 `talos_plugins` — Plugin Registry

Tracks installed plugins, their Docker images, configuration schemas, and health endpoints.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, `gen_random_uuid()` | Unique identifier |
| `name` | `text` | `NOT NULL, UNIQUE` | Plugin name |
| `version` | `text` | `NOT NULL` | Installed version |
| `docker_image` | `text` | `NOT NULL` | Docker image reference |
| `config_schema` | `jsonb` | | JSON Schema for plugin config |
| `health_endpoint` | `text` | | Health check URL path |
| `active` | `boolean` | `DEFAULT true` | Whether plugin is enabled |
| `created_at` | `timestamptz` | `DEFAULT now()` | Installation timestamp |
| `updated_at` | `timestamptz` | `DEFAULT now()` | Last update timestamp |

**DB Module:** `packages/db/src/plugins.ts`

| Function | Description |
|----------|-------------|
| `installPlugin(input)` | Install a new plugin (rejects if name exists) |
| `updatePlugin(name, updates)` | Update version and/or config |
| `getPlugin(name)` | Get plugin by name |
| `listPlugins(activeOnly?)` | List all plugins, optionally filtered |
| `deactivatePlugin(name)` | Disable without removing |
| `removePlugin(name)` | Permanently delete |

---

### 3.12 `talos_audit_trail` — Audit Logging

Append-only log of significant system events (agent registrations, task completions, config changes).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, `gen_random_uuid()` | Unique identifier |
| `event_type` | `text` | `NOT NULL` | Event classification |
| `agent_id` | `text` | | Associated agent |
| `task_id` | `uuid` | | Associated task |
| `detail` | `jsonb` | `DEFAULT '{}'` | Event details |
| `created_at` | `timestamptz` | `DEFAULT now()` | Event timestamp |

**Indexes:** `idx_audit_agent` on `agent_id`, `idx_audit_task` on `task_id`.

---

### 3.13 `talos_skills` — Runtime Skill Registry

Tracks skills available to the system, with success-rate tracking and caching promotion. Added in migration `0002_skills.sql` (blueprint §12.2).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, `gen_random_uuid()` | Unique identifier |
| `name` | `text` | `NOT NULL, UNIQUE` | Skill name |
| `description` | `text` | | Human-readable description |
| `source` | `text` | | Origin (e.g., `"hermes"`, `"community"`) |
| `source_tool` | `text` | | Tool that discovered the skill |
| `category` | `text` | | Category (code, research, writing, etc.) |
| `prompt_template` | `text` | | Prompt template for the skill |
| `trigger_phrases` | `jsonb` | `DEFAULT '[]'` | Phrases that activate the skill |
| `success_rate` | `float` | `DEFAULT 0.0, CHECK (0–1)` | Rolling success rate |
| `is_cached` | `boolean` | `DEFAULT false` | Whether skill is promoted to cache |
| `created_at` | `timestamptz` | `DEFAULT now()` | Registration timestamp |
| `updated_at` | `timestamptz` | `DEFAULT now()` | Last update timestamp |

**Indexes:** `idx_skills_category` on `category`, `idx_skills_is_cached` on `is_cached`, `idx_skills_success_rate` on `success_rate DESC`.

**RLS:** Read-all for all users; write only via `service_role`.

**DB Module:** `packages/db/src/skills.ts`

| Function | Description |
|----------|-------------|
| `registerSkill(input, client?)` | Register a new skill |
| `getSkill(name, client?)` | Get skill by name |
| `listSkills(options?, client?)` | List skills ordered by success rate |
| `updateSuccessRate(name, rate, client?)` | Update rolling success rate (validated 0–1) |
| `promoteToCached(name, client?)` | Mark skill as cached |

**Skill Categories:** `code`, `research`, `writing`, `analysis`, `automation`, `communication`, `memory`, `workflow`, `meta`, `uncategorized`.

---

### 3.14 `talos_workflows` — Workflow Definitions

Stores workflow DAG definitions as JSONB. Added in migration `0003_workflows.sql` (blueprint §3.5, §20).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, `gen_random_uuid()` | Unique identifier |
| `name` | `text` | `NOT NULL` | Workflow name |
| `description` | `text` | `DEFAULT ''` | Human-readable description |
| `version` | `text` | `DEFAULT '1.0.0'` | Semantic version |
| `definition` | `jsonb` | `NOT NULL` | Full workflow definition (nodes, edges) |
| `variables` | `jsonb` | `DEFAULT '{}'` | Default variable values |
| `created_at` | `timestamptz` | `DEFAULT now()` | Creation timestamp |
| `updated_at` | `timestamptz` | `DEFAULT now()` | Last update timestamp |

**Indexes:** `idx_workflows_name` on `name`, `idx_workflows_updated_at` on `updated_at DESC`.

---

### 3.15 `talos_workflow_runs` — Workflow Execution Runs

Records each execution of a workflow, including state, variables, and error information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `run_id` | `uuid` | PK, `gen_random_uuid()` | Unique run identifier |
| `workflow_id` | `uuid` | `NOT NULL, FK → talos_workflows(id) ON DELETE CASCADE` | Parent workflow |
| `workflow_name` | `text` | `NOT NULL` | Denormalized workflow name |
| `state` | `text` | `NOT NULL, CHECK IN ('draft','pending','running','completed','failed','cancelled')` | Run state |
| `variables` | `jsonb` | `DEFAULT '{}'` | Runtime variable values |
| `triggered_by` | `text` | `DEFAULT 'api'` | Trigger source |
| `error` | `text` | | Error message if failed |
| `started_at` | `timestamptz` | `DEFAULT now()` | Start timestamp |
| `completed_at` | `timestamptz` | | Completion timestamp |

**Indexes:** `idx_runs_workflow` on `workflow_id`, `idx_runs_state` on `state`, `idx_runs_started` on `started_at DESC`.

---

### 3.16 `talos_run_logs` — Per-Node Execution Logs

Stores per-node execution results for each workflow run. Each row represents one node's execution attempt.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, `gen_random_uuid()` | Unique identifier |
| `run_id` | `uuid` | `NOT NULL, FK → talos_workflow_runs(run_id) ON DELETE CASCADE` | Parent run |
| `node_id` | `text` | `NOT NULL` | Node identifier within the workflow |
| `state` | `text` | `NOT NULL, CHECK IN ('pending','running','completed','failed','skipped')` | Node state |
| `attempts` | `int` | `DEFAULT 0` | Number of execution attempts |
| `output` | `jsonb` | | Node output data |
| `error` | `text` | | Error message if failed |
| `duration_ms` | `int` | `DEFAULT 0` | Execution time in milliseconds |
| `created_at` | `timestamptz` | `DEFAULT now()` | Log entry timestamp |

**Indexes:** `idx_run_logs_run` on `run_id`, `idx_run_logs_node` on `(run_id, node_id)`, `idx_run_logs_state` on `state`.

**RLS (all workflow tables):** Read-all for all users; write only via `service_role`.

**DB Module:** `packages/db/src/workflows.ts`

| Function | Description |
|----------|-------------|
| `saveWorkflowToDb(workflow, client?)` | Persist a workflow definition |
| `loadWorkflowFromDb(id, client?)` | Load a workflow by ID |
| `listWorkflowsFromDb(client?)` | List all workflows (id, name, updatedAt) |
| `deleteWorkflowFromDb(id, client?)` | Delete a workflow |
| `saveRunToDb(run, client?)` | Persist a run + per-node logs |
| `loadRunFromDb(runId, client?)` | Load a run with its node logs |
| `listRunsFromDb(workflowId?, client?)` | List runs, optionally filtered by workflow |

---

## 4. Migrations

All migrations live in `supabase/migrations/` and are applied via `pnpm db:migrate` (which runs `supabase db push`).

| Migration | Tables | Description |
|-----------|--------|-------------|
| `0001_init.sql` | `talos_guilds`, `talos_devices`, `talos_agents`, `talos_tasks`, `talos_auctions`, `talos_cortex`, `talos_nornir_markers`, `talos_memory_vectors`, `talos_spend_ledger`, `talos_settings`, `talos_plugins`, `talos_audit_trail` | Initial schema with 12 tables, indexes, and constraints |
| `0002_skills.sql` | `talos_skills` | Skills registry (blueprint §12.2) with RLS |
| `0003_workflows.sql` | `talos_workflows`, `talos_workflow_runs`, `talos_run_logs` | Workflow persistence (blueprint §3.5, §20) with RLS |

**Applying migrations:**
```bash
pnpm db:migrate    # Push schema to Supabase
pnpm db:generate   # Generate TypeScript types from schema
```

---

## 5. RLS Policies

Every table with user-facing data has Row-Level Security enabled. The policy pattern is consistent across all tables:

```sql
-- Read: anyone can read
CREATE POLICY "talos_<table>_read_all"
  ON talos_<table> FOR SELECT
  USING (true);

-- Write: only service_role
CREATE POLICY "talos_<table>_write_service"
  ON talos_<table> FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
```

This means:
- **Anonymous/authenticated users** can read all data (suitable for dashboards, UI).
- **Only the backend** (using `service_role` key) can write. This prevents client-side writes even if the anon key is exposed.

Tables with RLS enabled:
- `talos_skills` (migration 0002)
- `talos_workflows` (migration 0003)
- `talos_workflow_runs` (migration 0003)
- `talos_run_logs` (migration 0003)

Tables in migration 0001 do **not** have explicit RLS policies in SQL — they rely on the Supabase client using `service_role` key server-side and the API layer handling access control.

---

## 6. Optional Client Pattern

The `skills.ts` and `workflows.ts` modules demonstrate the optional client injection pattern. Every function accepts an optional `client` parameter:

```typescript
export async function registerSkill(
  input: RegisterSkillInput,
  client?: SupabaseClient | SkillsClient
): Promise<Skill> {
  const c = resolveClient(client);
  // ... use c for all DB operations
}
```

The `resolveClient` helper falls back to the global singleton:

```typescript
function resolveClient(client?: SupabaseClient | SkillsClient): SkillsClient {
  return (client ?? getSupabaseClient()) as unknown as SkillsClient;
}
```

This pattern is critical for testing — mock clients are injected directly, bypassing the Supabase connection entirely.

---

## 7. @talos/db Modules

| Module | File | Primary Table(s) | Key Exports |
|--------|------|-------------------|-------------|
| Client | `client.ts` | — | `createSupabaseClient`, `getSupabaseClient`, `resetSupabaseClient` |
| Agents | `agents.ts` | `talos_agents`, `talos_guilds` | `registerAgent`, `getAgent`, `listAgents`, `updateAgentScore`, `updateAgentLoad`, `updateAgentStatus`, `registerGuild`, `subscribeToAgents` |
| Tasks | `tasks.ts` | `talos_tasks` | `createTask`, `getTask`, `listTasks`, `claimTask`, `completeTask`, `failTask`, `cancelTask`, `subscribeToTasks` |
| Auctions | `auctions.ts` | `talos_auctions` | `createAuction`, `getAuction`, `addBid`, `settleAuction`, `expireAuction` |
| Memory | `memory.ts` | `talos_cortex`, `talos_nornir_markers` | `getOrCreateCortex`, `updateCortex`, `appendToThread`, `updateIdentityCore`, `addNornirMarker`, `getNornirMarkers` |
| Plugins | `plugins.ts` | `talos_plugins` | `installPlugin`, `updatePlugin`, `getPlugin`, `listPlugins`, `deactivatePlugin`, `removePlugin` |
| Skills | `skills.ts` | `talos_skills` | `registerSkill`, `getSkill`, `listSkills`, `updateSuccessRate`, `promoteToCached` |
| Workflows | `workflows.ts` | `talos_workflows`, `talos_workflow_runs`, `talos_run_logs` | `saveWorkflowToDb`, `loadWorkflowFromDb`, `listWorkflowsFromDb`, `deleteWorkflowFromDb`, `saveRunToDb`, `loadRunFromDb`, `listRunsFromDb` |
| Store | `store.ts` | — (mock/in-memory) | `searchStore`, `getStorePlugin`, `installFromStore`, `publishToStore`, `getReviews` |

### Barrel Export

`packages/db/src/index.ts` re-exports everything:

```typescript
export { createSupabaseClient, getSupabaseClient, resetSupabaseClient } from "./client.js";
export type { SupabaseClient, SupabaseConfig } from "./client.js";
export * from "./agents.js";
export * from "./tasks.js";
export * from "./auctions.js";
export * from "./memory.js";
export * from "./plugins.js";
export * from "./store.js";
export * from "./skills.js";
export * from "./workflows.js";
```

---

## 8. pgvector

Talos uses [pgvector](https://github.com/pgvector/pgvector) for vector similarity search. Two tables store 1536-dimensional embeddings (OpenAI `text-embedding-ada-002`):

### `talos_nornir_markers`

Episodic event embeddings for semantic memory recall. When a user asks "what did I work on last Tuesday?", the system embeds the query and finds nearest markers:

```sql
SELECT * FROM talos_nornir_markers
WHERE user_id = $1
ORDER BY embedding <=> $2
LIMIT 10;
```

### `talos_memory_vectors`

File chunk embeddings for the user's Obsidian vault and documents. Enables "find notes similar to X" queries:

```sql
SELECT source_path, chunk_text, metadata
FROM talos_memory_vectors
WHERE user_id = $1
ORDER BY embedding <=> $2
LIMIT 5;
```

**Embedding generation** is handled by the Nornir module in `@talos/memory`, which calls the OpenAI embeddings API and stores the results via `@talos/db`.

---

## 9. Real-Time Subscriptions

Supabase Realtime enables live state updates without polling. Two subscription functions are implemented:

### `subscribeToAgents(onChange)`

Listens for any changes (`INSERT`, `UPDATE`, `DELETE`) on `talos_agents`:

```typescript
const { unsubscribe } = subscribeToAgents((agent) => {
  console.log("Agent updated:", agent.agentId, agent.status);
});

// Later: unsubscribe()
```

### `subscribeToTasks(onChange)`

Listens for any changes on `talos_tasks`:

```typescript
const { unsubscribe } = subscribeToTasks((task) => {
  if (task.status === "done") {
    console.log("Task completed:", task.id);
  }
});
```

Both use the `postgres_changes` event type on a named channel, with automatic payload mapping via `mapAgentFromDb` / `mapTaskFromDb`.

---

## 10. Testing

DB tests use injected mock clients instead of connecting to Supabase. This pattern is used in `skills.test.ts` and `workflows.test.ts`.

### Mock Client Pattern

Each test creates an in-memory mock that implements the Supabase query chain:

```typescript
function makeMockClient(): { client: SkillsClient; rows: Row[] } {
  const rows: Row[] = [];
  const client: SkillsClient = {
    from(table: string) {
      return {
        select: () => ({
          eq: (col, val) => ({
            single: async () => {
              const match = rows.find((r) => r[col] === val);
              return { data: match ?? null, error: match ? null : { message: "not found" } };
            },
            // ... order, limit chains
          }),
        }),
        insert: (payload) => {
          rows.push({ id: `id-${rows.length + 1}`, ...payload });
          return { select: () => ({ single: async () => ({ data: rows[rows.length - 1], error: null }) }) };
        },
        // ... update, delete
      };
    },
  };
  return { client, rows };
}
```

### Test Example

```typescript
describe("@talos/db — skills module", () => {
  let mock: ReturnType<typeof makeMockClient>;
  beforeEach(() => { mock = makeMockClient(); });

  it("registerSkill inserts and returns mapped skill", async () => {
    const skill = await registerSkill(
      { name: "summarize", description: "Summarizes text", category: "writing" },
      mock.client  // injected mock
    );
    expect(skill.name).toBe("summarize");
    expect(mock.rows).toHaveLength(1);
  });
});
```

### Test Counts

| Module | Tests | Status |
|--------|-------|--------|
| `skills.test.ts` | 5 | All pass |
| `workflows.test.ts` | 7 | All pass |
| **Total `@talos/db`** | **12** | **All pass** |

The optional client pattern means **zero Supabase connectivity is required** to run these tests. The mock clients simulate the query chain with plain arrays.

---

## Appendix: Entity Relationship Diagram

```
talos_guilds ──< talos_agents
                    │
                    ├──< talos_tasks >── talos_auctions
                    │         │
                    │         └──< talos_spend_ledger
                    │
                    └──< talos_audit_trail

talos_cortex (per user)
talos_nornir_markers (per user) ── pgvector
talos_memory_vectors (per user) ── pgvector

talos_plugins
talos_settings
talos_skills

talos_workflows ──< talos_workflow_runs ──< talos_run_logs
```
