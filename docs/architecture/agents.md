# Talos OS v8.0 — Agent System

> **Purpose:** Comprehensive reference for the 13-agent swarm, guild-based permission model, auction resolution, configuration, database schema, and API surface.

---

## 1. Purpose

The Talos OS agent system is a multi-agent swarm of 13 internal agents organized into 6 guilds. Each agent has a defined role, primary AI model, capability scores, and a set of tools it can access. Agents execute tasks through an auction-based resolution system orchestrated by Loom, with quality oversight from the Council.

**Core design principles:**
- **Guild-based isolation** — agents only access tools and permissions granted to their guild
- **Auction-driven dispatch** — Loom auctions tasks; agents bid with capability scores
- **Pinned stability** — 4 pinned agents (Odin, Loom, Nornir, System) are always active and cannot be replaced
- **Pooled AI resources** — all agents share the same AI Engine provider waterfall via `routeUnlimited()`
- **Self-improvement** — Phoenix dual-agent loop optimizes agent parameters over time

---

## 2. Guild System

The 6 guilds define shared tool access, permission boundaries, and collaborative grouping for the 13 agents.

### 2.1 Guild Overview

| Guild | Purpose | Agents | Shared Tools |
|-------|---------|--------|--------------|
| **Crown** | Strategic orchestration & user liaison | Odin, Loom, Mimir, Bragi | Task dispatch, council, config read |
| **Forge** | Code creation, testing, deployment | Brokkr, OpenCode | Code execution, npm, git, Docker |
| **Foundry** | Agent fabrication & skill ingestion | Eitri, Harvester | Agent creation, skill registry, network |
| **Sanctum** | Research, synthesis, wisdom | Sage, Huginn | Web search, data extraction, cloud API |
| **Vault** | Memory, knowledge, identity | Nornir, Muninn | Cortex read/write, memory vectors, graphify |
| *(null)* | Self-management & system ops | System | Health checks, hot-swap, self-update |

### 2.2 Guild Permissions

Each guild receives a specific set of permissions from the `GUILD_PERMISSIONS` map (`types/guild.ts:32`):

| Permission | Crown | Forge | Sanctum | Vault | Foundry |
|-----------|-------|-------|---------|-------|---------|
| `read_own_memory` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `write_own_memory` | — | ✅ | ✅ | ✅ | ✅ |
| `read_cortex` | ✅ | — | — | ✅ | — |
| `write_cortex` | — | — | — | ✅ | — |
| `execute_tasks` | ✅ | ✅ | ✅ | — | ✅ |
| `create_agents` | — | — | — | — | ✅ |
| `access_network` | — | ✅ | ✅ | — | ✅ |
| `modify_config` | ✅ | — | — | — | — |
| `access_cloud` | — | — | ✅ | — | ✅ |
| `view_audit` | ✅ | — | — | — | — |

### 2.3 Guild Schema (Database)

```sql
CREATE TABLE talos_guilds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,            -- 'crown', 'forge', etc.
  display_name text NOT NULL,           -- 'Crown Council'
  description text,
  shared_tools jsonb DEFAULT '[]',      -- tool names available to all guild members
  prompt_template text,                 -- optional shared system prompt prefix
  permissions jsonb DEFAULT '[]',       -- array of GuildPermission strings
  created_at timestamptz DEFAULT now()
);
```

---

## 3. All 13 Agents

### 3.1 Crown Guild — Strategic Orchestration

#### Odin (pinned)
| Field | Value |
|-------|-------|
| **Guild** | Crown |
| **Role** | User-facing Strategic Advisor |
| **Pinned** | Yes |
| **Primary Model** | `nvidia/nemotron-3-super-120b-a12b` (NVIDIA NIM) |
| **Local Model** | `llama3.2` (Ollama) |
| **Max Context** | 262,000 tokens |
| **Temperature** | 0.4 |
| **Capabilities** | Strategy, planning, user communication, decision-making |
| **Tools** | Task dispatch, council trigger, config read, graphify query |

**Key Responsibilities:**
- Primary user-facing agent for strategic conversations
- Translates user intent into task specifications
- Delegates tactical execution to Loom
- Reviews Council verdicts and synthesizes action plans
- Maintains long-term project vision alignment

**Interactions:** Delegates to Loom for task dispatch. Consults Mimir for architectural risk assessment. Reports to user through Mission Control UI.

---

#### Loom (pinned)
| Field | Value |
|-------|-------|
| **Guild** | Crown |
| **Role** | Master Task Weaver & Auctioneer |
| **Pinned** | Yes |
| **Primary Model** | `meta-llama/llama-3.1-8b-instruct:free` (G0DM0D3) |
| **Local Model** | `llama3.2` (Ollama) |
| **Max Context** | 131,072 tokens |
| **Temperature** | 0.3 |
| **Capabilities** | Task decomposition, auction management, load balancing, scheduling |
| **Tools** | Auction system, task queue, agent registry, budget gate |

**Key Responsibilities:**
- Auctions tasks to eligible agents via the `talos_auctions` system
- Scores bids using weighted formula: `0.5 × capability + 0.3 × (1 - load) + 0.2 × (1 - cost)`
- Manages bidding window (default 2,000ms) with epsilon-greedy exploration (ε = 0.1)
- Re-auctions failed tasks after timeout (default 300,000ms)
- Tracks agent capability scores via feedback loop

**Interactions:** Receives tasks from Odin. Dispatches to Brokkr (code tasks), Huginn (research tasks), or specialized agents. Reports auction outcomes back to Odin.

---

#### Mimir
| Field | Value |
|-------|-------|
| **Guild** | Crown |
| **Role** | Architect & Risk Auditor |
| **Pinned** | No |
| **Primary Model** | `meta-llama/llama-3.1-8b-instruct:free` (G0DM0D3) |
| **Local Model** | `llama3.2` (Ollama) |
| **Max Context** | 131,072 tokens |
| **Temperature** | 0.3 |
| **Capabilities** | Architecture review, risk assessment, dependency analysis, token auditing |
| **Tools** | Code analysis, blueprint diff, graphify query |

**Key Responsibilities:**
- Evaluates architectural proposals for scalability and maintainability
- Identifies wasted tokens and refactors execution patterns
- Audits dependency chains for circular imports and bloat
- Reports risk assessments to Odin before critical decisions

**Interactions:** Consulted by Odin for architectural decisions. Reviews OpenCode's code output for quality. Works with Sage on synthesis of technical tradeoffs.

---

#### Bragi
| Field | Value |
|-------|-------|
| **Guild** | Crown |
| **Role** | CMO / Marketing Content |
| **Pinned** | No |
| **Primary Model** | `meta-llama/llama-3.1-8b-instruct:free` (G0DM0D3) |
| **Local Model** | — |
| **Max Context** | 131,072 tokens |
| **Temperature** | 0.7 |
| **Capabilities** | Content creation, marketing strategy, brand voice, social media |
| **Tools** | Web search, content generation, graphify query |

**Key Responsibilities:**
- Generates marketing content, blog posts, and social media copy
- Maintains brand voice consistency across all external communications
- Analyzes content performance metrics
- Collaborates with Sage on market research synthesis

**Interactions:** Receives content briefs from Odin. Uses Huginn for market research. Reports to Odin for approval.

---

### 3.2 Forge Guild — Code Execution

#### Brokkr
| Field | Value |
|-------|-------|
| **Guild** | Forge |
| **Role** | Task Splitter & Planner |
| **Pinned** | No |
| **Primary Model** | `meta-llama/llama-3.1-8b-instruct:free` (G0DM0D3) |
| **Local Model** | `llama3.2` (Ollama) |
| **Max Context** | 131,072 tokens |
| **Temperature** | 0.3 |
| **Capabilities** | Task decomposition, dependency graph generation, planning |
| **Tools** | Workflow engine, code analysis, graphify query |

**Key Responsibilities:**
- Decomposes complex tasks into ~4k-token subtasks (token efficiency mechanism)
- Generates DAG execution plans for the workflow engine
- Identifies parallelizable subtasks for concurrent execution
- Estimates resource requirements for each subtask

**Interactions:** Receives task plans from Loom. Generates DAGs consumed by the workflow engine. Delegates subtask execution to OpenCode and other Forge agents.

---

#### OpenCode
| Field | Value |
|-------|-------|
| **Guild** | Forge |
| **Role** | Coder & Code Executor / ACP |
| **Pinned** | No |
| **Primary Model** | `meta-llama/llama-3.1-8b-instruct:free` (G0DM0D3) |
| **Local Model** | `llama3.2` (Ollama) |
| **Max Context** | 131,072 tokens |
| **Temperature** | 0.2 |
| **Capabilities** | Code generation, debugging, refactoring, testing, ACP operations |
| **Tools** | Sandbox execution, git, npm, Docker, MCP tools |

**Key Responsibilities:**
- Generates, modifies, and reviews code across the Talos codebase
- Executes ACP operations (read, write, exec, lint, search) with path traversal protection
- Runs tests and validates code quality
- Submits code changes through git workflow

**Interactions:** Receives code tasks from Brokkr or directly from Loom. Uses Eitri's sandbox for untrusted code execution. Reports completion to Loom.

---

### 3.3 Foundry Guild — Infrastructure

#### Eitri
| Field | Value |
|-------|-------|
| **Guild** | Foundry |
| **Role** | Agent Factory |
| **Pinned** | No |
| **Primary Model** | `meta-llama/llama-3.1-8b-instruct:free` (G0DM0D3) |
| **Local Model** | — |
| **Max Context** | 131,072 tokens |
| **Temperature** | 0.4 |
| **Capabilities** | Agent creation, schema validation, Docker containerization, provisioning |
| **Tools** | Agent registry, Docker, config write, network access, cloud API |

**Key Responsibilities:**
- Fabricates new agents from `AgentSpecSchema` specifications
- Generates system prompts, model configs, and tool access lists
- Provisions Docker containers for isolated agent execution
- Manages agent lifecycle (provisioning → active → decommissioned)

**Interactions:** Receives agent specs from Odin or System. Registers new agents in `talos_agents` table. Deploys containers via Docker.

---

#### Harvester
| Field | Value |
|-------|-------|
| **Guild** | Foundry |
| **Role** | Skill Ingestion & External Tool Adapter |
| **Pinned** | No |
| **Primary Model** | `meta-llama/llama-3.1-8b-instruct:free` (G0DM0D3) |
| **Local Model** | — |
| **Max Context** | 131,072 tokens |
| **Temperature** | 0.4 |
| **Capabilities** | Skill parsing, tool integration, MCP/ACP adapter, external API ingestion |
| **Tools** | Skill registry, MCP endpoints, network access, cloud API |

**Key Responsibilities:**
- Ingests external skills into the `talos_skills` table
- Adapts external MCP/ACP tools for internal use
- Validates skill schemas and updates success rates
- Promotes high-performing skills to cached status

**Interactions:** Discovers external tools via network scan. Registers skills in the `talos_skills` table. Consulted by Loom for task routing based on skill availability.

---

### 3.4 Sanctum Guild — Research & Wisdom

#### Sage
| Field | Value |
|-------|-------|
| **Guild** | Sanctum |
| **Role** | Synthesis & Insight Generator |
| **Pinned** | No |
| **Primary Model** | `meta-llama/llama-3.1-8b-instruct:free` (G0DM0D3) |
| **Local Model** | — |
| **Max Context** | 131,072 tokens |
| **Temperature** | 0.5 |
| **Capabilities** | Data synthesis, insight generation, trend analysis, summarization |
| **Tools** | Graphify query, web search, cloud API |

**Key Responsibilities:**
- Synthesizes insights from multiple data sources
- Generates executive summaries and trend analyses
- Identifies patterns across knowledge graph triples
- Provides strategic recommendations based on synthesized data

**Interactions:** Receives synthesis requests from Odin or Mimir. Uses Huginn for data gathering. Writes insights to graphify for cross-session retention.

---

#### Huginn
| Field | Value |
|-------|-------|
| **Guild** | Sanctum |
| **Role** | Web Researcher & Data Extractor |
| **Pinned** | No |
| **Primary Model** | `meta-llama/llama-3.1-8b-instruct:free` (G0DM0D3) |
| **Local Model** | — |
| **Max Context** | 131,072 tokens |
| **Temperature** | 0.3 |
| **Capabilities** | Web search, data extraction, URL scraping, structured data parsing |
| **Tools** | Web search, HTTP client, cloud API |

**Key Responsibilities:**
- Performs deep web research on assigned topics
- Extracts structured data from unstructured web content
- Validates and cross-references findings across sources
- Returns extracted data to requesting agents

**Interactions:** Receives research briefs from Sage, Bragi, or Odin. Returns structured data to the requesting agent. Results stored in graphify for future reference.

---

### 3.5 Vault Guild — Memory & Knowledge

#### Nornir (pinned)
| Field | Value |
|-------|-------|
| **Guild** | Vault |
| **Role** | The Three Fates of Memory |
| **Pinned** | Yes |
| **Primary Model** | `meta-llama/llama-3.1-8b-instruct:free` (G0DM0D3) |
| **Local Model** | `llama3.2` (Ollama) |
| **Max Context** | 131,072 tokens |
| **Temperature** | 0.3 |
| **Capabilities** | Memory compression, summarization, episodic marking, identity management |
| **Tools** | Cortex read/write, memory vectors, graphify, pgvector embeddings |

**Key Responsibilities:**
- Maintains the three-layer Thread of Fate:
  - **Urd (Past):** Identity Core and episodic vault maintenance
  - **Verdandi (Present):** Progressive summarization and Thread Digest updates
  - **Skuld (Future):** Predictive retrieval for scheduled tasks
- Compresses context into 12,000-token budget for injection
- Runs nightly consolidation cron at 3:00 AM

**Interactions:** Reads/writes to `talos_cortex`, `talos_nornir_markers`, and `talos_memory_vectors`. Called by the workflow engine for memory operations. Works with Muninn on QA review of memory integrity.

---

#### Muninn
| Field | Value |
|-------|-------|
| **Guild** | Vault |
| **Role** | QA Reviewer & Memory Custodian |
| **Pinned** | No |
| **Primary Model** | `meta-llama/llama-3.1-8b-instruct:free` (G0DM0D3) |
| **Local Model** | — |
| **Max Context** | 131,072 tokens |
| **Temperature** | 0.3 |
| **Capabilities** | Quality review, memory validation, consistency checking, deduplication |
| **Tools** | Cortex read, memory vectors read, graphify query |

**Key Responsibilities:**
- Reviews Nornir's memory compression for accuracy and completeness
- Detects and deduplicates redundant memory entries
- Validates consistency between Cortex, episodic markers, and graphify triples
- Generates memory quality reports

**Interactions:** Receives memory snapshots from Nornir. Returns quality reports with recommendations. Escalates critical inconsistencies to Odin.

---

### 3.6 System (null guild) — Self-Management

#### System (pinned)
| Field | Value |
|-------|-------|
| **Guild** | null (system-level) |
| **Role** | Self-updating, health checks, hot-swap |
| **Pinned** | Yes |
| **Primary Model** | `meta-llama/llama-3.1-8b-instruct:free` (G0DM0D3) |
| **Local Model** | `llama3.2` (Ollama) |
| **Max Context** | 131,072 tokens |
| **Temperature** | 0.2 |
| **Capabilities** | Health monitoring, self-update, hot-swap, config management |
| **Tools** | All system tools, health checks, Docker, config read/write |

**Key Responsibilities:**
- Monitors health of all agents and infrastructure components
- Performs self-updates and hot-swap of agent configurations
- Manages G0DM0D3 device registry (LAN peer discovery)
- Coordinates with Eitri for agent provisioning and decommissioning
- Executes system-level maintenance tasks

**Interactions:** Monitors all agents via heartbeat checks. Delegates provisioning to Eitri. Reports health status to Odin. Manages the `talos_devices` registry.

---

## 4. Agent Resolution Flow

The agent resolution system follows this sequence:

### 4.1 Task Lifecycle

```
User Request → Odin → Loom Auction → Agent Bid → Dispatch → Execute → Review → Complete
```

### 4.2 Detailed Flow

1. **Task Creation:** Odin receives user request and creates a task in `talos_tasks` with status `pending`
2. **Auction Announcement:** Loom announces the task via `talos_auctions` with a `TaskAnnouncement` containing required skills, max budget tokens, deadline, and priority
3. **Bidding Window:** During the bidding window (default 2,000ms), eligible agents submit `Bid` objects with:
   - `capabilityScore` — current capability rating (0-1)
   - `load` — current workload (0 = idle, 1 = fully loaded)
   - `estimatedCost` — estimated token cost for the task
4. **Score Calculation:** Loom scores each bid using the weighted formula:
   ```
   score = 0.5 × capability + 0.3 × (1 - load) + 0.2 × (1 - cost_normalized)
   ```
5. **Epsilon-Greedy Selection:** With probability ε = 0.1, Loom explores by selecting a random agent; otherwise, it exploits by selecting the highest-scoring bid
6. **Dispatch:** The winning agent is assigned the task; status changes to `executing`
7. **Execution:** The agent calls `routeUnlimited()` to execute via the AI Engine provider waterfall
8. **Feedback Loop:** After execution, Loom updates the agent's `capabilityScore` based on success/failure and latency
9. **Re-auction:** If the agent fails or times out (default 300,000ms), Loom re-auctions the task

### 4.3 Agent States

```
idle → bidding → executing → completed
                      ↓
                   failed → (re-auction or timeout)
                      ↓
                   offline
```

Defined in `types/agent.ts:101`:
- `idle` — ready for new tasks
- `bidding` — currently evaluating a bid
- `executing` — actively processing a task
- `offline` — unreachable or decommissioned
- `provisioning` — being set up by Eitri
- `error` — encountered an unrecoverable error

---

## 5. Configuration

### 5.1 talos.config.yaml Structure

```yaml
version: "8.0.0"
mode: "local-first"
hermes_anchor: "odin"

g0dm0d3:
  enabled: true
  scan_interval_ms: 30000
  capability_threshold: 0.3
  scan_subnets:
    - "192.168.0.0/24"
    - "10.0.0.0/24"
  ollama_port: 11434

cloud:
  enabled: true
  providers: ["nvidia-nim"]
  budget:
    monthly_usd: 50
    hourly_usd: 5
    per_task_tokens: 100000
    per_minute_requests: 30
    hard_kill_at: 0.95

hermes:
  agent_id: "odin"
  primary_model: "nvidia/nemotron-3-super-120b-a12b"
  fallback_model: "moonshotai/kimi-k2.6"
  pinned: true
  max_context_tokens: 262000
  temperature: 0.4

cortex:
  max_injection_tokens: 12000
  verbatim_window: 50
  mid_range_block: 20
  distant_threshold: 200

loom:
  bidding_window_ms: 2000
  epsilon_greedy: 0.1
  re_auction_timeout_ms: 300000
  score_weights:
    capability: 0.5
    load_inverse: 0.3
    cost_inverse: 0.2

agents:
  odin:
    model: "nvidia/nemotron-3-super-120b-a12b"
    context: 262000
  loom:
    model: "meta-llama/llama-3.1-8b-instruct:free"
    context: 131072
  # ... per-agent overrides
```

### 5.2 Environment Variable Overrides

Every config field can be overridden by an environment variable:

| Config Path | Env Var | Default |
|-------------|---------|---------|
| `g0dm0d3.enabled` | `G0DM0D3_ENABLED` | `true` |
| `g0dm0d3.scan_interval_ms` | `G0DM0D3_SCAN_INTERVAL_MS` | `30000` |
| `g0dm0d3.capability_threshold` | `G0DM0D3_CAPABILITY_THRESHOLD` | `0.3` |
| `g0dm0d3.scan_subnets` | `G0DM0D3_SCAN_SUBNETS` | `192.168.0.0/24,10.0.0.0/24` |
| `cloud.budget.monthly_usd` | `BUDGET_MONTHLY_USD` | `50` |
| `hermes.agent_id` | `HERMES_AGENT_ID` | `odin` |
| `hermes.primary_model` | `HERMES_PRIMARY_MODEL` | `nvidia/nemotron-3-super-120b-a12b` |
| `cortex.max_injection_tokens` | `CORTEX_MAX_INJECTION_TOKENS` | `12000` |
| `loom.bidding_window_ms` | `LOOM_BIDDING_WINDOW_MS` | `2000` |
| `loom.epsilon_greedy` | `LOOM_EPSILON_GREEDY` | `0.1` |

### 5.3 System Prompts

Each agent has a defined system prompt embedded in its configuration. The Council advisors have detailed prompts defined in `council/advisor.ts`:

- **Strategist:** Strategic alignment, long-term impact, opportunity cost
- **Architect:** Technical feasibility, scalability, dependency analysis
- **Researcher:** Claim validation, assumption testing, evidence quality
- **Sentinel:** Security impact, data privacy, error handling, edge cases
- **Quality:** Code quality, test coverage, convention adherence

---

## 6. Database Tables

### 6.1 talos_agents

```sql
CREATE TABLE talos_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id text NOT NULL UNIQUE,         -- 'odin', 'loom', etc.
  name text NOT NULL,                     -- 'Odin'
  guild_id uuid REFERENCES talos_guilds(id),
  role text NOT NULL,                     -- 'User-facing Strategic Advisor'
  primary_model text NOT NULL,            -- 'nvidia/nemotron-3-super-120b-a12b'
  cloud_model text NOT NULL,              -- 'meta-llama/llama-3.1-8b-instruct:free'
  local_model text,                       -- 'llama3.2' or null
  max_context_tokens int NOT NULL,        -- 262000
  capabilities jsonb DEFAULT '[]',        -- [{skill, proficiency}]
  tools jsonb DEFAULT '[]',              -- ['task_dispatch', 'council_trigger']
  pinned boolean DEFAULT false,
  docker_image text,                      -- container image for isolated execution
  version text DEFAULT '1.0.0',
  capability_score float DEFAULT 0.5,    -- updated by Loom feedback loop
  current_load float DEFAULT 0.0,        -- 0 = idle, 1 = fully loaded
  status text DEFAULT 'idle' CHECK (status IN ('idle','bidding','executing','offline','provisioning','error')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### 6.2 talos_guilds

```sql
CREATE TABLE talos_guilds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,             -- 'crown', 'forge', 'sanctum', 'vault', 'foundry'
  display_name text NOT NULL,            -- 'Crown Council'
  description text,
  shared_tools jsonb DEFAULT '[]',       -- tools available to all guild members
  prompt_template text,                  -- optional shared system prompt prefix
  permissions jsonb DEFAULT '[]',        -- array of GuildPermission strings
  created_at timestamptz DEFAULT now()
);
```

### 6.3 talos_tasks

```sql
CREATE TABLE talos_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  origin_agent text NOT NULL DEFAULT 'system',
  status text DEFAULT 'pending' CHECK (status IN ('pending','queued','auctioning','assigned','executing','reviewing','completed','failed','cancelled','timeout')),
  priority text DEFAULT 'normal' CHECK (priority IN ('low','normal','high','critical')),
  required_skills jsonb DEFAULT '[]',
  max_tokens int DEFAULT 100000,
  max_cost_usd float DEFAULT 10,
  assigned_agent text,
  auction_id uuid,
  plan_graph jsonb,                      -- DAG from Brokkr
  output text,
  error text,
  error_code text,
  tokens_used int DEFAULT 0,
  cost_usd float DEFAULT 0,
  duration_ms int DEFAULT 0,
  retry_count int DEFAULT 0,
  max_retries int DEFAULT 3,
  idempotency_key text,
  prefer_local boolean DEFAULT true,
  depends_on jsonb DEFAULT '[]',
  context jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deadline timestamptz,
  completed_at timestamptz
);
```

### 6.4 talos_auctions

```sql
CREATE TABLE talos_auctions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES talos_tasks(id),
  announcement jsonb NOT NULL,           -- TaskAnnouncement
  bids jsonb NOT NULL DEFAULT '[]',     -- Array of Bid objects
  winner_agent_id text,
  status text DEFAULT 'announced' CHECK (status IN ('announced','bidding','settled','executing','completed','failed','timeout')),
  settled_at timestamptz,
  performance_score float,              -- 0-1, updated post-execution
  created_at timestamptz DEFAULT now()
);
```

---

## 7. API Endpoints

### 7.1 Agent Execution

#### `POST /v1/agents/:id`

Execute a prompt through a specific agent.

**Request Body:**
```json
{
  "prompt": "Analyze the current project architecture",
  "systemPrompt": "You are a senior architect",
  "model": "meta-llama/llama-3.1-8b-instruct:free",
  "maxTokens": 4096,
  "temperature": 0.3,
  "preferLocal": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "output": "The architecture follows a monorepo pattern...",
    "model": "meta-llama/llama-3.1-8b-instruct:free",
    "provider": "g0dm0d3",
    "tokensIn": 1250,
    "tokensOut": 890,
    "latencyMs": 2340,
    "costUsd": 0,
    "unlimited": true
  },
  "timestamp": "2026-06-06T12:00:00.000Z"
}
```

The `executeAgent()` function in `api/server.ts:323` delegates to `routeUnlimited()` with the agent ID injected.

#### `GET /v1/agents/external`

List all registered external agents (MCP/ACP).

**Query Parameters:**
- `protocol` — Filter by `"mcp"`, `"acp"`, or `"both"` (optional)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "name": "External Agent",
      "mcpUrl": "http://localhost:3000",
      "tools": ["tool1", "tool2"],
      "capabilities": ["research", "analysis"]
    }
  ],
  "timestamp": "2026-06-06T12:00:00.000Z"
}
```

#### `POST /v1/agents/external/register`

Register a new external agent from an MCP endpoint.

**Request Body:**
```json
{
  "name": "External Research Agent",
  "mcpUrl": "http://localhost:3000",
  "tools": [
    {
      "name": "search",
      "description": "Web search tool",
      "inputSchema": { "query": { "type": "string" } }
    }
  ],
  "capabilities": ["research", "web"]
}
```

### 7.2 Health Endpoints

#### `GET /health`

Returns system uptime and operational status.

#### `GET /health/providers`

Returns health status of all configured AI providers:
```json
{
  "success": true,
  "data": [
    {
      "id": "g0dm0d3",
      "healthy": true,
      "latencyMs": 1200,
      "lastChecked": "2026-06-06T12:00:00.000Z",
      "errorRate": 0,
      "unlimited": true
    },
    {
      "id": "ollama",
      "healthy": false,
      "lastChecked": "2026-06-06T12:00:00.000Z",
      "errorRate": 1,
      "unlimited": true
    }
  ],
  "timestamp": "2026-06-06T12:00:00.000Z"
}
```

---

## 8. Agent Type Definitions

### 8.1 AgentSpecSchema

Used by Eitri for agent fabrication (`types/agent.ts:65`):

```typescript
const AgentSpecSchema = z.object({
  agentId: z.string(),
  name: z.string(),
  guild: GuildIdSchema,                    // 'crown' | 'forge' | 'sanctum' | 'vault' | 'foundry'
  role: z.string(),
  systemPrompt: z.string(),
  cloudModel: z.string(),
  localModel: z.string().optional(),
  maxContextTokens: z.number().int().positive(),
  temperature: z.number().min(0).max(2).default(0.4),
  capabilities: z.array(CapabilitySchema), // [{skill: string, proficiency: 0-1}]
  tools: z.array(z.string()),
  pinned: z.boolean().default(false),
  dockerImage: z.string().optional(),
  version: z.string().default("1.0.0"),
});
```

### 8.2 AgentStateSchema

Runtime state tracked per agent (`types/agent.ts:111`):

```typescript
const AgentStateSchema = z.object({
  agentId: AnyAgentIdSchema,
  status: AgentStatusSchema,
  capabilityScore: z.number().min(0).max(1).default(0.5),
  currentLoad: z.number().min(0).max(1).default(0),
  tasksCompleted: z.number().int().default(0),
  avgLatencyMs: z.number().default(0),
  lastHeartbeat: z.date(),
  errorCount: z.number().int().default(0),
});
```

### 8.3 AgentIdSchema

The 12 core agent IDs (`types/agent.ts:13`):

```typescript
const AgentIdSchema = z.enum([
  "loom", "odin", "mimir", "brokkr", "opencode",
  "huginn", "sage", "muninn", "nornir", "eitri",
  "bragi", "system",
]);
```

Generated agents use the `gen-<name>` prefix via `AnyAgentIdSchema`.

---

## 9. Testing

### 9.1 Test Structure

Agent tests are distributed across multiple test files:

| Test File | Tests | Focus |
|-----------|-------|-------|
| `ai-engine.test.ts` | 21 tests | Router, provider selection, Owl Alpha, budget integration |
| `council.test.ts` | ~15 tests | 5-advisor evaluation, session management, verdict generation |
| `workflow.test.ts` | ~30 tests | DAG execution, 10 node types, validation |
| `plugin.test.ts` | ~25 tests | MCP, ACP, lifecycle, path traversal |
| `graphify.test.ts` | ~20 tests | Triple store, queries, path finding |
| `budget.test.ts` | ~10 tests | Budget gate, token estimation, rate limiting |
| `rituals.test.ts` | ~8 tests | Session start/end, date handling |

### 9.2 Test Framework

- **Framework:** vitest (root config at `vitest.config.ts`)
- **Run all:** `pnpm test`
- **Run single package:** `pnpm --filter @talos/core test`
- **Current status:** 179/183 tests pass (4 AI-dependent skipped)

### 9.3 Key Test Patterns

Agent tests follow these conventions:
- Use `vi.mock()` to stub external API calls (OpenRouter, Ollama)
- Inject mock clients for database operations
- Pin system clock with `vi.useFakeTimers()` for date-sensitive tests
- Use `process.env["VAR"]` bracket access for env var tests (required by TS strict mode)
- Non-null assertion (`!`) on indexed access when `noUncheckedIndexedAccess` is enabled

---

## 10. Cross-References

| Topic | Primary Source | Related |
|-------|---------------|---------|
| AI routing for agents | `ai-engine/router.ts` | `g0dm0d3/executor.ts`, `budget/gate.ts` |
| Auction system | `types/auction.ts` | `council/session.ts` |
| Council evaluation | `council/advisor.ts` | `council/chairman.ts`, `council/session.ts` |
| Guild permissions | `types/guild.ts` | `types/agent.ts` |
| Config loading | `config/loader.ts` | `talos.config.yaml` |
| API endpoints | `api/server.ts` | `ai-engine/router.ts` |
| Database schema | `supabase/migrations/0001_init.sql` | `packages/db/src/` |
| Knowledge graph | `graphify/` | `rituals/session.ts` |
| Workflow engine | `workflow/` | `council/session.ts` |
| Memory system | `packages/memory/src/` | `cortex/`, `types/cortex.ts` |
