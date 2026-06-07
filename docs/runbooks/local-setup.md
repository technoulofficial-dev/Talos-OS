# Local Development Setup — Talos OS v8.0

Step-by-step guide for setting up a local development environment.

## 1. Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| Node.js | v20+ | Runtime |
| pnpm | v9.15.0 | Package manager (enforced via `packageManager` field) |
| Docker Desktop | Latest | Supabase, Redis, Ollama containers |
| Git | Latest | Version control |
| Windows | 10/11 | Primary dev platform (Ubuntu scripts also available) |

### 1.1 Check Versions

```powershell
node --version    # v20.x.x or higher
pnpm --version    # 9.15.0
docker --version  # Docker version 24.x+
git --version     # git version 2.x+
```

---

## 2. Quick Start

```powershell
# 1. Clone the repository
git clone https://github.com/metis-corp/talos-os.git
cd talos-os

# 2. Install dependencies
pnpm install

# 3. Start infrastructure services
docker compose up -d

# 4. Build all packages
pnpm build

# 5. Run tests
pnpm test

# 6. Start the UI dev server
pnpm --filter @talos/ui dev
```

The UI will be available at `http://localhost:3000`.

---

## 3. Install Scripts

### 3.1 Windows (`scripts/install-windows.ps1`)

PowerShell script that automates setup on Windows:

```powershell
# Full install
powershell -ExecutionPolicy Bypass -File scripts/install-windows.ps1

# What it does:
# 1. Checks Node.js v20+
# 2. Checks pnpm v9.15.0
# 3. Checks Docker Desktop
# 4. Runs pnpm install
# 5. Starts docker compose
# 6. Runs pnpm build
# 7. Shows post-install instructions
```

Post-install steps (shown by the script):
1. Set environment variables in `.env`
2. Run `pnpm test` to verify
3. Run `pnpm --filter @talos/ui dev` to start UI

### 3.2 Ubuntu (`scripts/install-ubuntu.sh`)

Bash script for Ubuntu/Debian setup:

```bash
chmod +x scripts/install-ubuntu.sh
./scripts/install-ubuntu.sh
```

---

## 4. Environment Setup

### 4.1 Create `.env` File

```bash
cp .env.example .env
```

### 4.2 Required Variables

| Variable | Required | Purpose | Default |
|----------|----------|---------|---------|
| `OLLAMA_URL` | No | Ollama endpoint | `http://127.0.0.1:11434` |
| `NVIDIA_API_KEY` | No | NVIDIA NIM cloud fallback | — |
| `GITHUB_TOKEN` | No | GitHub MCP server | — |
| `SUPABASE_ACCESS_TOKEN` | No | Supabase MCP server | — |
| `TWENTYFIRST_API_KEY` | No | 21st.dev Magic MCP | — |
| `TALOS_OWL_ALPHA_ENABLED` | No | Owl Alpha model (default ON) | `true` |
| `TALOS_WORKFLOW_CODE_ENABLED` | No | Code/condition nodes (default OFF) | `false` |
| `TALOS_WORKFLOW_DB_ENABLED` | No | Supabase workflow persistence (default OFF) | `false` |

### 4.3 Optional Variables

| Variable | Purpose |
|----------|---------|
| `TALOS_WORKFLOW_DIR` | Custom workflow JSON storage directory |
| `TALOS_PORT` | Core API port (default: 8642) |
| `PUTER_AUTH_TOKEN` | Puter AI provider |
| `FREETHEAI_API_KEY` | FreeTheAI provider |

---

## 5. Supabase Local

### 5.1 Docker Compose

The project includes Supabase in `docker-compose.yml`:

```yaml
services:
  supabase-db:
    image: supabase/postgres:15.6.1
    ports:
      - "5432:5432"
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: talos

  supabase-api:
    image: supabase/postgrest:12.2.3
    ports:
      - "54321:3000"
    depends_on:
      - supabase-db

  supabase-studio:
    image: supabase/studio:latest
    ports:
      - "54322:3000"
```

### 5.2 Ports

| Port | Service | URL |
|------|---------|-----|
| 5432 | PostgreSQL | `postgresql://postgres:postgres@localhost:5432/talos` |
| 54321 | PostgREST API | `http://localhost:54321` |
| 54322 | Supabase Studio | `http://localhost:54322` |

### 5.3 Start Supabase

```powershell
docker compose up -d supabase-db supabase-api supabase-studio
```

### 5.4 Verify

```powershell
# Check containers
docker compose ps

# Test connection
psql -h localhost -p 5432 -U postgres -d talos -c "SELECT 1;"
```

---

## 6. Database Migrations

### 6.1 Push Migrations

```powershell
pnpm db:migrate
```

This runs `supabase db push` which applies all pending migrations from `supabase/migrations/`.

### 6.2 Migration Files

| File | Purpose |
|------|---------|
| `0001_init.sql` | Core tables: guilds, devices, agents, tasks, auctions, cortex, memory, spend, settings, plugins, audit |
| `0002_skills.sql` | Skills registry table (blueprint §12.2) |
| `0003_workflows.sql` | Workflow definitions, runs, and per-node logs (blueprint §3.5, §20) |

### 6.3 Generate Types

```powershell
pnpm db:generate
```

Generates TypeScript types from the Supabase schema into `packages/db/src/types.ts`.

### 6.4 Tables Overview

| Table | Purpose | RLS |
|-------|---------|-----|
| `talos_guilds` | Agent guilds | No |
| `talos_devices` | G0DM0D3 device registry | No |
| `talos_agents` | Agent definitions | No |
| `talos_tasks` | Task queue | No |
| `talos_auctions` | Task auctions | No |
| `talos_cortex` | User cortex memory | Yes (user_id) |
| `talos_nornir_markers` | Episodic markers | No |
| `talos_memory_vectors` | Vector embeddings | No |
| `talos_spend_ledger` | Budget tracking | No |
| `talos_settings` | Runtime config | No |
| `talos_plugins` | Plugin registry | No |
| `talos_audit_trail` | Audit events | No |
| `talos_skills` | Skills registry | Yes (service_role) |
| `talos_workflows` | Workflow definitions | Yes (service_role) |
| `talos_workflow_runs` | Workflow runs | Yes (service_role) |
| `talos_run_logs` | Per-node execution logs | Yes (service_role) |

---

## 7. Ollama Setup

### 7.1 Install Ollama

```powershell
# Windows (winget)
winget install Ollama.Ollama

# Or download from https://ollama.com/download
```

### 7.2 Pull Models

```bash
# Default model used by Talos
ollama pull llama3.2

# Optional: larger model for better quality
ollama pull llama3.1:8b

# Optional: code-specialized model
ollama pull codellama:7b
```

### 7.3 Verify

```bash
# Check Ollama is running
curl http://127.0.0.1:11434/api/tags

# Test inference
ollama run llama3.2 "Hello, world!"
```

### 7.4 Configure Endpoint

Default: `http://127.0.0.1:11434`

Override with `OLLAMA_URL` env var if using a different port or remote instance.

---

## 8. opencode Setup

### 8.1 MCP Servers

Configured in `opencode.json`. After install, restart opencode to load them.

| MCP | Status | Purpose |
|-----|--------|---------|
| browser | Enabled | Playwright browser automation |
| memory | Enabled | Persistent memory across sessions |
| github | Enabled | GitHub API access |
| magic | Enabled | 21st.dev UI component builder |
| supabase | Enabled | Supabase database access |
| open-design | Disabled | Requires subscription desktop app |

### 8.2 Tools

Custom tools loaded from `.opencode/tools/`:

| Tool | Purpose |
|------|---------|
| `graphify_addKnowledge` | Store knowledge triples |
| `graphify_queryKnowledge` | Query knowledge graph |
| `graphify_getGraphStats` | Graph statistics |
| `obsidian_readNote` | Read markdown notes |
| `obsidian_writeNote` | Write markdown notes |
| `obsidian_listNotes` | List all notes |
| `obsidian_searchNotes` | Search notes |
| `talos_runBuild` | Build packages |
| `talos_runTests` | Run tests |
| `talos_checkHealth` | Health check |
| `talos_listAgents` | List agent directories |
| `session_start` | Session start ritual |
| `session_end` | Session end ritual |
| `capture_learning` | Persist learning triple |

### 8.3 Skills

Skills are loaded on demand from `.opencode/skills/` and the opencode-power-pack plugin.
See `AGENTS.md` for the full skill inventory and loading discipline.

---

## 9. Running Tests

### 9.1 All Tests

```powershell
pnpm test
```

Runs vitest for all packages. Uses the root `vitest.config.ts`.

### 9.2 Per-Package Tests

```powershell
# Core (has most tests)
pnpm --filter @talos/core test

# DB
pnpm --filter @talos/db test
```

### 9.3 Watch Mode

```powershell
pnpm test:watch
```

### 9.4 Test Structure

Tests are in `__tests__/` directories within each package:

| Package | Test Files | Count |
|---------|-----------|-------|
| `@talos/core` | `ai-engine.test.ts`, `plugin.test.ts`, `rituals.test.ts`, `workflow.test.ts`, `persistence.test.ts`, `graphify.test.ts`, `council.test.ts`, `budget.test.ts` | ~180 |
| `@talos/db` | `skills.test.ts`, `workflows.test.ts` | ~12 |

### 9.5 Expected Results

- **Pass:** ~176/180 (4 AI-dependent tests skipped)
- **Known failure:** 1 pre-existing `plugin.test.ts:228` path-traversal test (fixed in ADR-032)
- **Skip reason:** Tests requiring live AI providers are skipped in CI

---

## 10. Building

### 10.1 All Packages

```powershell
pnpm build
```

Uses turbo for parallel builds with dependency ordering.

### 10.2 Per-Package Build

```powershell
pnpm --filter @talos/core build
pnpm --filter @talos/db build
pnpm --filter @talos/ui build
pnpm --filter talos build
pnpm --filter @talos/memory build
```

### 10.3 Build Outputs

| Package | Output | Entry |
|---------|--------|-------|
| `@talos/core` | `packages/core/dist/` | `api/server.js` |
| `@talos/db` | `packages/db/dist/` | `index.js` |
| `@talos/memory` | `packages/memory/dist/` | `index.js` |
| `talos` | `packages/cli/dist/` | `cli.js` |
| `@talos/ui` | `packages/ui/.next/` | Next.js build |

### 10.4 Dev Mode

```powershell
# Watch mode for all packages
pnpm dev

# Watch mode for UI only
pnpm --filter @talos/ui dev
```

---

## 11. Docker Development

### 11.1 Core Container

```powershell
# Build the core container
docker compose build

# Start all services
docker compose up -d

# View logs
docker compose logs -f talos-core
```

### 11.2 Dockerfile Stages

The `infrastructure/docker/Dockerfile.core` uses multi-stage builds:

| Stage | Purpose |
|-------|---------|
| `base` | Node.js 20 Alpine + pnpm |
| `deps` | Install dependencies |
| `builder` | Build TypeScript |
| `runner` | Production image (dist + node_modules) |

### 11.3 Container Ports

| Port | Service |
|------|---------|
| 8642 | Talos Core API |
| 5432 | PostgreSQL |
| 54321 | PostgREST |
| 54322 | Supabase Studio |
| 11434 | Ollama |

---

## 12. IDE Setup

### 12.1 VS Code Extensions

Recommended extensions:
- ESLint
- Prettier
- Tailwind CSS IntelliSense
- Docker
- PostgreSQL (by Chris Kolkman)

### 12.2 TypeScript

The project uses TypeScript strict mode. The root `tsconfig.json` sets:

```json
{
  "compilerOptions": {
    "strict": true,
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022",
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

---

## 13. Troubleshooting

### 13.1 `pnpm install` fails

**Cause:** Node.js version too old or pnpm version mismatch.

```powershell
# Check versions
node --version   # Must be v20+
pnpm --version   # Must be 9.15.0

# Fix pnpm version
corepack enable
corepack prepare pnpm@9.15.0 --activate
```

### 13.2 Docker containers won't start

**Cause:** Port already in use.

```powershell
# Check what's using the port
netstat -ano | findstr :5432

# Kill the process or change ports in docker-compose.yml
```

### 13.3 `pnpm build` fails with type errors

**Cause:** Stale build cache.

```powershell
# Clean and rebuild
Remove-Item -Recurse -Force packages/*/dist
Remove-Item -Recurse -Force packages/ui/.next
pnpm build
```

### 13.4 Tests fail with "AI provider not available"

**Expected:** Some tests require live AI providers. These are skipped in CI.

```powershell
# Run only local tests
pnpm --filter @talos/core test
```

### 13.5 Ollama connection refused

```powershell
# Check if Ollama is running
curl http://127.0.0.1:11434/api/tags

# Start Ollama
ollama serve

# Or set different endpoint
$env:OLLAMA_URL = "http://localhost:11435"
```

### 13.6 Supabase migration fails

```powershell
# Ensure Supabase is running
docker compose ps

# Push migrations
pnpm db:migrate

# If still failing, reset the database
docker compose down -v
docker compose up -d supabase-db
pnpm db:migrate
```

### 13.7 UI dev server shows blank page

```powershell
# Clear Next.js cache
Remove-Item -Recurse -Force packages/ui/.next

# Restart dev server
pnpm --filter @talos/ui dev
```

### 13.8 `__setStoreDir` test hook not found

**Cause:** The test hook is in `packages/core/src/workflow/_test_hooks.ts` and is NOT re-exported from the production barrel (ADR-011).

```typescript
// CORRECT — import from test hooks file directly
import { __setStoreDir } from "../workflow/_test_hooks.js";

// WRONG — do not import from production barrel
import { __setStoreDir } from "../workflow/index.js";
```

---

## 14. Project Structure Reference

```
D:\Talos OS\
├── packages/
│   ├── core/           # @talos/core — AI engine, workflows, council
│   ├── db/             # @talos/db — Supabase database layer
│   ├── cli/            # talos — CLI commands
│   ├── memory/         # @talos/memory — Cortex + Nornir
│   └── ui/             # @talos/ui — Next.js Mission Control
├── talos-agents/       # 13 internal agent packages
├── infrastructure/     # Docker, G0DM0D3 config
├── supabase/           # DB migrations
├── scripts/            # Install scripts
├── docs/               # This documentation
├── tokens/             # Design token JSON
├── .opencode/          # opencode config, tools, skills
└── .talos-notes/       # Obsidian vault (session logs)
```

---

## 15. Next Steps

After local setup:

1. **Read architecture docs:** `docs/decisions/adr-log.md`
2. **Explore the codebase:** Load `code-explorer` skill in opencode
3. **Run the UI:** `pnpm --filter @talos/ui dev`
4. **Create a workflow:** Use the Workflow Canvas in Mission Control
5. **Check agent status:** `pnpm --filter @talos/core test` to verify AI engine
