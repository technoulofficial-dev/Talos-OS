# Talos OS — Definitive Blueprint v8.0

**The Bronze Automaton · Adjustable · Self‑Improving · Bearer of the Digital World**
*Metis Corp · Senior Architect · Final Integrated Design*
*May 29, 2026*

---

## Table of Contents

**PART I — STRATEGIC FOUNDATION**
1. Vision, Philosophy & The Talos Mandate
2. The Progressive 3‑Layer Architecture
3. MVP Boundary & Phase Gates

**PART II — CORE ARCHITECTURE**
4. Hybrid AI Engine & The G0DM0D3 Protocol
5. Multi‑Agent Organization — The Loom, Guilds & Market Swarm
6. The Self‑Building Agent Factory (Eitri) — Loom‑Coordinated
7. Task Queue, Execution Engine & Visual Flow Chart
8. The Infinite Memory & Context System — User Cortex & Nornir
9. The Hallucination‑Immunity Traits (α–ζ)
10. The 10 Research‑Backed Intelligence Traits
11. Autonomy Engine — Safe Vision‑to‑Execution
12. Self‑Improvement System (Phoenix‑Bot) — Metacognitive Upgrade
13. Security, Governance & The Living Blueprint

**PART III — PRESENTATION & DISTRIBUTION**
14. Talos Mission Control — Premium UI/UX Specifications
15. Configuration, Distribution & Self‑Installation
16. Database Schema (Supabase)
17. Implementation Roadmap & Phases
18. Appendix: Technical Contracts, Error Codes & Agent Registry

---

## PART I — STRATEGIC FOUNDATION

### 1. Vision, Philosophy & The Talos Mandate

#### 1.1 Vision
Talos OS is the autonomous, self‑improving AI operating system built by **Metis Corp**. Named after the bronze giant automaton crafted by Hephaestus, Talos never sleeps, never tires. It carries the entire weight of your digital empire—projects, decisions, knowledge, and execution—so you don't have to. Talos is adjustable, updatable, and lives by one rule: **automate every repeatable decision, remember everything worth remembering, and grow stronger with every task.**

Talos is:
- A hybrid (local‑first + cloud‑fallback) multi‑agent AI OS.
- The orchestration layer for the Metis empire — the autonomous factory that builds the products that fund the empire.
- Downloadable, configurable, and self‑installable by anyone.

#### 1.2 The Talos Mandate
- **Bearer of the Weight** – Executes complex multi‑stage digital projects from vision to deploy.
- **Relentless Automation** – Every routine operation is handed to the swarm; you only touch high‑level strategy.
- **Infinite Memory, Sharp Mind** – Talos remembers every conversation, decision, and code change without becoming slower or dumber over time (via the User Cortex).
- **Adjustable Giant** – Every component—agents, models, memory modules, tools—can be hot‑swapped, versioned, and updated with zero downtime.
- **Underdog Engine** – Designed for a single human with a potato PC, leveraging free cloud AI APIs and peer‑device networks (G0DM0D3) to punch like a trillion‑dollar corp.

#### 1.3 The 20‑Year Metis Strategic Mandate

| Phase | Years | Product | Revenue Model | Purpose |
|-------|-------|---------|---------------|---------|
| **Phase 1** | 2026 | **Foundry by Metis** — Premium Next.js SaaS boilerplate | $149 one‑time / $19/mo | Fastest to revenue. Funds the next phase. |
| **Phase 2** | 2026‑2027 | **Merchant by Metis** — AI workflow automation for SMEs | $97‑197/mo per business | Taps $100B agentic AI opportunity. |
| **Phase 3** | 2027‑2028 | **Oracle by Metis** — AI trading signal & portfolio intelligence | $29‑199/mo subscription | Dollar‑denominated. Agents ARE the product. |
| **Phase 4** | 2028‑2030 | **Talos OS Public Release** | Platform licensing + agent marketplace | By 2030, AI agents capture 60%+ of software profits (Goldman Sachs). Talos is the OS. |
| **Phase 5** | 2030‑2040 | **The Metis Agent Economy** | Revenue share + platform fees | $3‑5 trillion global agent economy. |
| **Phase 6** | 2040‑2046 | **Metis Industries** | Equity, licensing, sovereign contracts | Multi‑trillion‑dollar tech empire. |

**Core Principle:** Build in rupiah‑cost living. Earn in dollars. Compounding over heroics.

---

### 2. The Progressive 3‑Layer Architecture

| Layer | What It Is | Build Time | Status |
|-------|-----------|-----------|--------|
| **Layer 1: Hermes Agent Core** | Personal project manager (Odin) with Notion integration, OpenCode coding agent, single Nemotron 3 Super 120B model | Today | Already operational |
| **Layer 2: Talos Forge** | Multi‑agent build pipeline (Planner→Coder→Tester→Debugger→Critic) with per‑agent models, shared memory, Docker sandbox, The Loom auction system | 1‑2 weeks | Pending deployment |
| **Layer 3: Talos Kernel (Custom)** | Own autonomous AI OS built from scratch — agent loop, tool system, memory, skills, MCP gateway, RL‑based self‑evolution, G0DM0D3 protocol, User Cortex, Living Blueprint | 4‑8 weeks | Post‑Foundry income |

---

### 3. MVP Boundary & Phase Gates

#### 3.1 Phase 1 — Core Assistant (MVP)
- ✅ Hybrid AI provider (localhost Ollama + cloud fallback via NVIDIA NIM)
- ✅ Single‑chat interface with session persistence
- ✅ One default Orchestrator agent (Odin) with plan card generation
- ✅ Manual task dispatch to Mimir (Architect) and OpenCode (Coder)
- ✅ Flow‑chart visualisation of a plan
- ✅ Settings page for model selection and PIN gate
- ❌ No autonomous execution, no self‑modification, no distributed brain

#### 3.2 Phase 2 — Enhanced Agent System
- Multi‑device LAN fallback (G0DM0D3 Protocol)
- Agent management full CRUD
- Job queue with retry (pg‑boss)
- Context injection with token compression
- Notes & basic vector memory

#### 3.3 Phase 3 — Autonomous Mode (Heavily Guarded)
- Goal Manager, projects, milestones
- Budget control & cost estimation
- Phoenix‑Bot metacognitive self‑improvement
- Sandboxed skill execution (Docker isolation)
- Kill switch & heartbeats
- The Loom dynamic auction + Guilds
- User Cortex & Nornir infinite memory

#### 3.4 Phase 4 — Distribution & Polish
- `talos` CLI binary (Level 3 kernel extraction)
- Talos Mission Control (Next.js web dashboard)
- Self‑installer scripts (Ubuntu + Windows PowerShell)
- Plugin registry & Talos Store
- Living Blueprint auto‑update system

---

## PART II — CORE ARCHITECTURE

### 4. Hybrid AI Engine & The G0DM0D3 Protocol

#### 4.1 Local Core (The Foundry)
Talos uses **Ollama** to run GGUF models 100% locally, providing the free, unlimited execution layer.

#### 4.2 Cloud Fallback
If a local model fails, Talos routes the request to NVIDIA NIM. The provider selection logic (`lib/ai-provider.ts`) tries localhost, then the G0DM0D3 network, then cloud.

```typescript
async function getOptimalProvider(task: TaskConfig): Promise<ProviderResult> {
  // 1. Try localhost Ollama
  if (await alive('http://127.0.0.1:11434', 5000)) {
    return { type: 'local', endpoint: 'http://127.0.0.1:11434', model: agent.local_model };
  }
  // 2. Scan network for G0DM0D3 devices
  const devices = await supabase
    .from('talos_devices')
    .select('local_endpoint_url, capability_score')
    .eq('has_local_ai', true)
    .eq('status', 'online')
    .order('capability_score', { ascending: false });
  
  for (const d of devices) {
    if (await alive(d.local_endpoint_url, 3000)) {
      return { type: 'local', endpoint: d.local_endpoint_url, model: agent.local_model, deviceId: d.id };
    }
  }
  // 3. Cloud fallback
  return { type: 'cloud', endpoint: "https://integrate.api.nvidia.com/v1", model: agent.cloud_model };
}
```

#### 4.3 The G0DM0D3 Protocol — Model Hijacking
Talos scans the local network for other Ollama endpoints (port 11434). With explicit permission, it borrows idle compute, turning every device into a distributed AI cluster.

#### 4.4 NVIDIA NIM Model Registry

| Agent | Primary Model | Model ID | Context |
|-------|---------------|----------|---------|
| **The Loom** | DeepSeek V4 Pro | `deepseek-ai/deepseek-v4-pro` | 1M |
| Odin (Orchestrator) | Nemotron 3 Super 120B | `nvidia/nemotron-3-super-120b-a12b` | 262K |
| Mimir (Architect) | Nemotron 3 Super 120B | `nvidia/nemotron-3-super-120b-a12b` | 262K |
| Brokkr (Task Splitter) | Kimi K2.6 | `moonshotai/kimi-k2.6` | 256K |
| OpenCode (Coder) | MiniMax M2.7 | `minimaxai/minimax-m2.7` | 200K |
| Huginn (Researcher) | Mistral Large 3 675B | `mistralai/mistral-large-3-675b-instruct-2512` | 256K |
| Muninn (Reviewer/Memory) | GLM-5.1 | `z-ai/glm-5.1` | 198K |
| Eitri (Agent Factory) | DeepSeek V4 Pro | `deepseek-ai/deepseek-v4-pro` | 1M |
| Nornir | Mistral Large 3 675B | `mistralai/mistral-large-3-675b-instruct-2512` | 256K |
| Sage | Kimi K2.6 | `moonshotai/kimi-k2.6` | 256K |
| Bragi (CMO) | Nemotron 3 Super 120B | `nvidia/nemotron-3-super-120b-a12b` | 262K |
| System Agent | Qwen3.5-397B | `qwen/qwen3.5-397b-a17b` | 256K |

---

### 5. Multi‑Agent Organization — The Loom, Guilds & Market Swarm

#### 5.1 The Loom — Master Weaver
**Model:** `deepseek-ai/deepseek-v4-pro` (1M context).

The Loom runs a continuous auction:
1. **Task Announcement** – Each task is posted with a requirements vector (skills, budget, deadline).
2. **Bidding Window (2 s)** – All active agents may submit a bid containing: `capability_score` (0-1), `load`, `estimated_cost`.
3. **Auction Settlement** – The Loom picks the winner using: `score = 0.5 * capability + 0.3 * (1 - load) + 0.2 * (1 - normalized_cost)`, plus an exploration bonus (ε-greedy).
4. **Task Dispatch** – Winner gets exclusive job ID. Heartbeat monitored; timeout triggers re-auction.
5. **Feedback Loop** – Performance updates the agent's capability score.
6. **Gap Trigger** – If no agent bids with capability > 0.3, The Loom invokes Eitri to fabricate a new specialist.

#### 5.2 Agent Guilds — Domain Clusters

| Guild | Domain | Shared Tools | Core Agents |
|-------|--------|--------------|-------------|
| **The Crown** | Strategy, governance, user liaison | Plan-card generator, budget tracker | Odin, Mimir, Bragi, The Loom |
| **The Forge** | Code creation, testing, deployment | Docker sandbox, linters, ACP | OpenCode, Brokkr, Muninn (QA) |
| **The Sanctum** | Research, data synthesis | Web browser, data extractor, summarizer | Huginn, Sage |
| **The Vault** | Memory, knowledge, identity | Vector DB, summarizer, Cortex API | Muninn, Nornir |
| **The Foundry** | Agent fabrication (Eitri's domain) | Agent spec compiler, Docker builder, test harness | Eitri, all generated agents |

#### 5.3 Complete Agent Registry (v8.0)

| # | Agent | Guild | Role | Primary Model | Context |
|---|-------|-------|------|---------------|---------|
| 0 | **The Loom** | Crown | Master Task Weaver, Auctioneer | DeepSeek V4 Pro | 1M |
| 1 | **Odin** | Crown | User-facing Strategic Advisor | Nemotron 3 Super 120B | 262K |
| 2 | **Mimir** | Crown | Architect & Risk Auditor | Nemotron 3 Super 120B | 262K |
| 3 | **Brokkr** | Forge | Task Splitter, creates tasks.json | Kimi K2.6 | 256K |
| 4 | **OpenCode** | Forge | Coder (via ACP), writes files | MiniMax M2.7 | 200K |
| 5 | **Muninn** | Forge / Vault | QA Reviewer & Memory Custodian | GLM-5.1 | 198K |
| 6 | **Huginn** | Sanctum | Web Researcher & Data Extractor | Mistral Large 3 675B | 256K |
| 7 | **Sage** | Sanctum | Synthesis & Insight Generator | Kimi K2.6 | 256K |
| 8 | **Eitri** | Foundry | Agent Factory (spec->code->deploy) | DeepSeek V4 Pro | 1M |
| 9 | **Bragi** | Crown | CMO / Marketing Content | Nemotron 3 Super 120B | 262K |
| 10 | **Nornir** | Vault | The Three Fates of Memory | Mistral Large 3 675B | 256K |
| 11 | **System Agent** | (none) | Self-updating, health checks, hot-swap | Qwen3.5-397B | 256K |

---

### 6. The Self‑Building Agent Factory (Eitri)

**Model:** `deepseek-ai/deepseek-v4-pro` (1M context).

Eitri Fabrication Pipeline:
1. **Spec Generation** – Generates `AgentSpec` (name, guild, system prompt, tool list, model).
2. **Code Compilation** – Compiled into a Docker container using a templated skeleton.
3. **Sandbox Test** – Tested with a synthetic version of the triggering task.
4. **Quality Gate** – Muninn evaluates the test output.
5. **Canary Deploy** – If passed, joins the auction with a probationary capability score.
6. **Lifecycle** – Idle for 30 days → decommissioned, memory merged into a generalist agent by Nornir.

---

### 7. Task Queue, Execution Engine & Visual Flow Chart

#### 7.1 Job Queue
- **Phase 1:** Simple polling — `talos_tasks` with `status = 'queued'`. Loop polls every 2 seconds.
- **Phase 3+:** `pg-boss` with exactly-once delivery.

#### 7.2 Task Lifecycle & Retry Policy
- Retries: 3 attempts with exponential backoff (30s, 5min, 30min).
- Idempotency: `idempotency_key`.
- Timeout: 15-minute hard timeout.

#### 7.3 Visual Flow Chart
- Plan graph stored as JSON in `talos_tasks.plan_graph`.
- React Flow renders nodes; colours update via Supabase Realtime.
- Nodes colour-coded: blue (queued), yellow (processing), green (done), red (failed).

---

### 8. The Infinite Memory & Context System — User Cortex & Nornir

#### 8.1 The User Cortex Structure
Stored in `talos_cortex`, capped at ~12K tokens.

1. **Identity Core** (~500 tokens) — Long-term goals, personality, decision heuristics.
2. **The Thread of Fate** (rolling window with progressive compression)
   - Recent (last 50 turns): verbatim messages.
   - Mid-range (51-200 turns): compressed into one abstract paragraph per 20-turn block.
   - Distant (>200 turns): episodic markers.
3. **Retrieved Context (on-demand)** — Top-3 past relevant conversations via semantic search.

#### 8.2 Nornir — The Three Fates of Memory
**Model:** `mistralai/mistral-large-3-675b-instruct-2512` (256K context).

- **Urd (Past)** – Maintains Identity Core and long-term episodic vault.
- **Verdandi (Present)** – Performs progressive summarization and updates Thread Digest.
- **Skuld (Future)** – Predictive retrieval; pre-fetches relevant memories before sessions.

**Nightly consolidation (cron `0 3 * * *`):**
1. Verdandi locks Cortex for write.
2. Urd updates Identity Core.
3. Skuld pre-fetches for scheduled tasks.
4. Old verbatims beyond 200 turns deleted from active store.

---

### 9. The Hallucination‑Immunity Traits (α–ζ)

| Trait | Name | Core Mechanism | Effect |
|-------|------|----------------|--------|
| **α** | SSRP Separation Gate | Hard gate between Plan and Execute. Executive cannot modify plan. | 715x Resilience Lift |
| **β** | Ghost-Context Detection | Context provenance tagging + mask-and-rerun detection | Eliminates cross-context hallucination |
| **γ** | Lexical-Graph Hybrid Memory | GAAMA concept-mediated graph | 65.8% win rate vs RAG |
| **δ** | Multi-Anchor Persistent Identity | Identity distributed across 4 anchors | Survives partial memory corruption |
| **ε** | Context-Aware Token Budgeting | Checks before every LLM call; 4-tier compression | Prevents "lost in the middle" |
| **ζ** | Reasoning-Depth Guard | Monitors reasoning tokens per task | Prevents model laziness |

---

### 10. The 10 Research‑Backed Intelligence Traits

1. **Chain-of-Thought Prompting** — Step-by-step reasoning before conclusions.
2. **Tree-of-Thought Exploration** — Multiple reasoning branches evaluated in parallel.
3. **Retrieval-Augmented Generation (RAG)** — External knowledge retrieval before generation.
4. **ReAct (Reason+Act)** — Interleaved reasoning and tool-use loops.
5. **Reflexion** — Self-critique and iterative improvement of outputs.
6. **Toolformer** — Learned tool selection and composition.
7. **HyperAgents** — Self-modifying improvement loops (Phoenix-Bot).
8. **Society of Mind** — Agent collaboration and emergent collective intelligence.
9. **Sleep-Phase Consolidation** — Background memory reorganization (Nornir).
10. **Emergent Self-Organization** — Market-based dynamic allocation (The Loom).

---

### 11. Autonomy Engine — Safe Vision-to-Execution

- Scope restriction: agents cannot act outside their declared scope.
- Goal Manager: hierarchical goals with milestones.
- Budget cap: per-goal and per-task spending limits.
- Action allowlist: only approved actions can be executed.
- Kill switch: instant halt of all autonomous operations.
- Heartbeat-based liveness: agents must ping within timeout or get flagged.

---

### 12. Self‑Improvement System (Phoenix‑Bot)

Dual-agent loop:
- **Task Phoenix** — Optimizes individual task strategies.
- **Meta Phoenix** — Mutates system-wide parameters (Loom weights, Nornir prompts).

Safety: sandbox execution, human approval for core changes, rollback snapshots, kill switch.

---

### 13. Security, Governance & The Living Blueprint

#### 13.1 Docker Sandboxes
Every task runs in an isolated Docker container (no network by default, destroyed after completion).

#### 13.2 MCP Gateway with Zero-Trust
All tool access routed through MCP Gateway with cryptographic identity, permission gating, and immutable audit trail.

#### 13.3 The Living Blueprint
- System Agent watches for blueprint changes (git diff on `main`).
- Parses semantic diff to generate a Reconfiguration Plan.
- Presents plan with [Apply] button.
- On approval: spins up new Docker containers, runs integration tests, blue-green cutover.
- Auto-rollback if health checks fail within 60 seconds.

#### 13.4 Plugin Architecture
Every agent, tool, and memory module is a versioned Docker container registered in `talos_plugins`.

---

## PART III — PRESENTATION & DISTRIBUTION

### 14. Talos Mission Control — UI/UX

**Design Persona:** Bronze-Punk — dark gunmetal backgrounds (`#1a1a1a`), copper/bronze accents (`#b87333`, `#cd7f32`), glowing cyan runes (`#00e5ff`), gear-motif borders, CRT scanline overlays.

**Tech Stack:** Next.js 16, TypeScript, Tailwind CSS, Framer Motion, Shadcn UI, React Flow, Supabase Realtime.

---

### 15. Configuration, Distribution & Self-Installation

- **Binary:** `talos` CLI with bronze-punk TUI banner
- **Dashboard:** `http://localhost:3000`
- **API:** `http://localhost:8642`

---

### 16. Database Schema (Supabase)

All tables prefixed `talos_*` with Row-Level Security on `user_id`:
`talos_devices`, `talos_agents`, `talos_guilds`, `talos_tasks`, `talos_auctions`, `talos_cortex`, `talos_nornir_markers`, `talos_memory_vectors`, `talos_plugins`, `talos_settings`, `talos_audit_trail`

---

### 17. Implementation Roadmap

| Phase | Name | Timeline | Key Deliverables |
|-------|------|----------|-----------------|
| **Phase 0** | Personal Core | Today | Hermes Agent, OpenCode, Notion integration |
| **Phase 1** | Core Assistant (MVP) | 2-4 weeks | Hybrid AI, chat + plan cards, manual dispatch, flow chart, PIN gate |
| **Phase 2** | Enhanced Agent System | Weeks 5-8 | G0DM0D3, AgentForge, job queue, token compression, memory |
| **Phase 3** | Autonomous Mode | Weeks 9-16 | The Loom, Guilds, Cortex, Nornir, Phoenix-Bot, Eitri, Docker sandboxes |
| **Phase 4** | Distribution & Polish | Weeks 17-24 | CLI, Mission Control, installers, Living Blueprint, plugin store |

---

### 18. Appendix

#### 18.1 AI Provider Contract
```typescript
interface TaskConfig { agentId: string; maxTokens: number; temperature: number; }
interface ProviderResult { type: 'local' | 'cloud'; endpoint: string; model: string; deviceId?: string; }
```

#### 18.2 Error Codes
- `TAL-001` through `TAL-010` — Standard operation errors
- `TAL-011` — Auction timeout
- `TAL-012` — Agent fabricator failure
- `TAL-013` — Cortex integrity check failed
- `TAL-014` — Plugin version conflict
- `TAL-015` — Living blueprint plan rejected

#### 18.3 Agent Registry File Tree
```
talos-agents/
├── loom/       # Master Weaver — DeepSeek V4 Pro
├── odin/       # Strategic Advisor — Nemotron Super 120B
├── mimir/      # Architect — Nemotron Super 120B
├── brokkr/     # Task Splitter — Kimi K2.6
├── opencode/   # Coder (ACP) — MiniMax M2.7
├── huginn/     # Researcher — Mistral Large 3 675B
├── sage/       # Synthesis — Kimi K2.6
├── muninn/     # QA/Memory — GLM-5.1
├── nornir/     # Three Fates of Memory — Mistral Large 3 675B
├── eitri/      # Agent Factory — DeepSeek V4 Pro
├── bragi/      # CMO — Nemotron Super 120B
├── system/     # Self-updating — Qwen3.5-397B
└── generated/  # Temporary project-specific agents