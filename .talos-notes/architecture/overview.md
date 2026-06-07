# Talos OS v8.0 — Architecture Overview

## Mission

Build an Agentic Operating System that hosts internal agents, council, external MCP/ACP attachments, knowledge graphs, visual workflow builder, unified memory, auto-skilling, and plugins.

## Core Principle

Free AI Engine (G0DM0D3 stack) top priority — unlimited zero-cost AI workforce via 4-tier waterfall: Ollama local → G0DM0D3 LAN peers → OpenRouter free → NVIDIA NIM (last resort).

## Package Structure

| Package | Role |
|---------|------|
| `@talos/core` | TypeScript engine — AI router, council, plugins, graphify, workflow |
| `talos` (CLI) | Command-line interface |
| `@talos/db` | Supabase database layer |
| `@talos/memory` | Cortex + Nornir memory |
| `@talos/ui` | Next.js Mission Control |

## Internal Agents (talos-agents/)

13 agents: Loom, Odin, Mimir, Brokkr, opencode, Muninn, Huginn, Sage, Eitri, Bragi, Nornir, Harvester, System.

## Build Chain

- Package manager: pnpm v9.15.0
- Monorepo: pnpm workspaces + turbo v2.5
- Tests: vitest
- Language: TypeScript strict mode, ESM
- Node v20+

## Phase Progress

See `phases.md` for the full phase-by-phase status.

## Key Decisions

See `decisions.md` for the architecture decision log (ADRs).
