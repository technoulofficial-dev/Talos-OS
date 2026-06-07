---
name: talos-architecture
description: Reference for Talos OS v8.0 architecture — package structure, agent system, build chain, and development phases
license: MIT
compatibility: opencode
metadata:
  audience: developer
  project: talos-os
---

## Project Structure

- `packages/` — 5 pnpm workspace packages
  - `core/` — AI engine (unified router, G0DM0D3 stack), council, workflows
  - `db/` — Supabase database layer (agents, auctions, memory, plugins, tasks)
  - `cli/` — CLI commands (agent runner, config, etc.)
  - `memory/` — Unified memory system (Identity Core, Thread of Fate, Episodic Vault)
  - `ui/` — Next.js 15 dashboard (Mission Control)
- `talos-agents/` — Internal agent definitions (Odin, Mimir, Brokkr, etc.)
- `supabase/migrations/` — SQL migrations (single file: 0001_init.sql)
- `talos.config.yaml` — Central configuration
- `BLUEPRINT.md` — 6-phase development roadmap

## Build & Test

- Package manager: pnpm v9.15.0
- Build: `pnpm -r build` (turbo)
- Test: `pnpm test` (vitest)
- TypeScript strict mode, ESM modules

## Key Architecture Decisions

- AI Engine (`packages/core/src/ai-engine/`) is the single canonical router
- Council: 5 parallel advisors + Chairman (no debate, separate context)
- External agents attach via MCP/ACP protocol
- Graphify is the knowledge graph system (Phase 1C)
- G0DM0D3 stack: 3-tier provider waterfall (OpenRouter free → Ollama local → NVIDIA NIM)
- Budget gates: monthly $50, hourly $5, 100k tokens/task, 30 req/min

## Phase Roadmap

- Phase -1: Foundation cleanup (done)
- Phase 0: Free AI Engine (current)
- Phase 1A: Council implementation
- Phase 1B: Plugin system
- Phase 1C: Graphify knowledge graphs
- Phase 2: Visual Workflow Builder
- Phase 3: Auto-Skilling
