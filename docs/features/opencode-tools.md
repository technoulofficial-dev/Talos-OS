# Opencode Custom Tools

Custom tools extend opencode's capabilities with Talos-specific functionality. Four tool modules provide knowledge graph operations, note vault management, session lifecycle rituals, and build system access.

## Purpose

Opencode's plugin system allows custom tools to be registered via `.opencode/tools/*.ts` files. Each tool is a function that accepts typed arguments and returns a result. These tools are available to all agents during conversations, enabling them to interact with the Talos knowledge graph, Obsidian vault, build system, and session lifecycle.

## Tool Modules

### graphify — Knowledge Graph Tools

**File:** `.opencode/tools/graphify.ts`

Three tools for managing the Talos knowledge graph stored in `.talos/graphify.json`:

#### addKnowledge

```typescript
addKnowledge({
  subject: "OdinAgent",      // Subject entity
  predicate: "depends_on",   // Relation/predicate
  object: "AiEngine",        // Object entity
  context: "ADR-003"         // Optional context
})
```

Stores a knowledge triple (entity-relation-entity) in the graph. Each triple gets a UUID, timestamp, and weight of 1. Triples are appended to the JSON file.

**When to use:** After making a significant architectural decision, discovering a dependency, or recording a relationship between components.

#### queryKnowledge

```typescript
queryKnowledge({
  entity: "Odin",            // Filter by subject or object (partial match)
  predicate: "uses",         // Filter by relation (partial match)
  subject: "Agent",          // Filter by subject only
  object: "Router",          // Filter by object only
  limit: 50,                 // Max results (default: 100)
  offset: 0                  // Result offset (default: 0)
})
```

Queries the knowledge graph with flexible filtering. All filters are case-insensitive partial matches. Results are paginated via `limit` and `offset`.

**When to use:** Before implementing a feature to understand existing relationships, or during code review to verify dependency claims.

#### getGraphStats

```typescript
getGraphStats()
```

Returns statistics about the knowledge graph: total triples, unique subjects/predicates/objects, total weight, and breakdown by predicate.

**When to use:** During session health checks or to understand the graph's coverage.

### obsidian — Note Vault Tools

**File:** `.opencode/tools/obsidian.ts`

Four tools for reading, writing, listing, and searching markdown notes in the `.talos-notes/` vault:

#### readNote

```typescript
readNote({
  path: "architecture/decisions.md"  // Relative to vault root
})
```

Reads a markdown note from the vault. Returns the file content as a string, or an error message if the file does not exist.

**When to use:** Loading architecture decisions, reading session logs, reviewing documentation.

#### writeNote

```typescript
writeNote({
  path: "architecture/adr-015.md",
  content: "# ADR-015\n\nKeep parallel and loop node types..."
})
```

Writes a markdown note to the vault. Creates parent directories if they do not exist.

**When to use:** Recording architecture decision records, writing session notes, creating documentation.

#### listNotes

```typescript
listNotes()
```

Lists all markdown files in the vault, sorted alphabetically. Recursively scans all subdirectories. Excludes `.git` and `node_modules`.

**When to use:** At session start to understand what notes exist, or when looking for specific documentation.

#### searchNotes

```typescript
searchNotes({
  query: "workflow"  // Search keyword
})
```

Searches all notes for a keyword. Returns the first matching line from each file that contains the query (case-insensitive). Limited to 200 characters per snippet.

**When to use:** Finding notes about a specific topic without knowing the exact file path.

### session — Session Lifecycle Tools

**File:** `.opencode/tools/session.ts`

Three tools for managing the session lifecycle — start, end, and mid-session learning capture:

#### sessionStart

```typescript
sessionStart({
  tripleLimit: 20,        // Recent triples to load (default: 20)
  sessionLogLimit: 3      // Recent session logs to list (default: 3)
})
```

**Session start ritual.** Loads context to seed the current session:

1. Reads the last N triples from `.talos/graphify.json`, sorted by creation date
2. Lists the last N session logs from `.talos-notes/session/`
3. Reads the most recent session log (first 1500 characters)
4. Extracts headings from `AGENTS.md` (first 30 lines)

Returns a JSON context bundle with recommendations for the session.

**When to use:** At the beginning of every session to recall prior context.

#### sessionEnd

```typescript
sessionEnd({
  summary: "Built workflow engine MVP with 8 node types...",
  decisions: ["ADR-012: Code nodes gated behind env flag"],
  learnings: [
    { subject: "WorkflowEngine", predicate: "supports", object: "10 node types", context: "ADR-015" }
  ],
  nextSteps: ["Add React Flow canvas", "Implement Harvester Phase 3"],
  tags: ["workflow", "phase-2"],
  persistToGraph: true,       // Write learnings to graphify (default: true)
  writeSessionLog: true       // Write dated log to vault (default: true)
})
```

**Session end ritual.** Captures what happened and prepares handoff for the next session:

1. Persists learnings as triples in `.talos/graphify.json` (if `persistToGraph` is true)
2. Writes a dated session log to `.talos-notes/session/YYYY-MM-DD-session.md`
3. Returns a handoff bundle with stats and next-session prompt

**When to use:** At the end of every productive session to ensure context is not lost.

#### captureLearning

```typescript
captureLearning({
  subject: "SkillsTable",
  predicate: "uses",
  object: "OptionalClientInjection",
  context: "ADR-018 — pattern to back-port to other db modules"
})
```

**Mid-session helper.** Persists a single learning triple to the knowledge graph without writing a session log.

**When to use:** During the session when a significant discovery or decision is made that should survive across sessions. Lighter than `sessionEnd` — use this for incremental captures.

### talos — Build System Tools

**File:** `.opencode/tools/talos.ts`

Four tools for building, testing, and inspecting the Talos OS project:

#### runBuild

```typescript
runBuild({ package: "core" })  // Build @talos/core
runBuild()                      // Build all packages
```

Runs `pnpm --filter @talos/<package> build` or `pnpm -r build` for all packages. Returns success/failure with the last 2000 characters of output on failure.

**When to use:** After making changes to verify the build passes.

#### runTests

```typescript
runTests({ package: "core", watch: false })
runTests()  // Run all tests
```

Runs `pnpm --filter @talos/<package> test` or `pnpm test` for all packages. Supports watch mode.

**When to use:** After implementing changes to verify tests pass.

#### checkHealth

```typescript
checkHealth()
```

Runs a full build (`pnpm -r build`) and returns `{ build: "PASS" | "FAIL" }`. On failure, includes the error output.

**When to use:** At session start or before major changes to verify project health.

#### listAgents

```typescript
listAgents()
```

Lists all directories in `talos-agents/` (the internal Talos agent definitions). Returns sorted directory names.

**When to use:** When working with the agent system to see which agents are defined.

## Tool Implementation Structure

Each tool file in `.opencode/tools/` follows this pattern:

```typescript
import { tool } from "@opencode-ai/plugin";
import { /* fs operations */ } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// 1. Path resolution (import.meta.url + walk-up)
function resolveStorePath(): string { /* ... */ }

// 2. Constants
const STORE_PATH = resolveStorePath();

// 3. Helper functions (read, write, parse)
async function loadTriples(): Promise<Triple[]> { /* ... */ }

// 4. Exported tools
export const myTool = tool({
  description: "...",
  args: { /* Zod schemas */ },
  async execute(args) { /* ... */ },
});
```

**Key conventions:**
- Tools are exported as named exports (not default exports)
- Each tool uses `tool()` from `@opencode-ai/plugin`
- Arguments are defined with Zod-like schemas via `tool.schema.*`
- All file operations use `node:fs/promises` (async)
- Path resolution uses `import.meta.url` (see Path Resolution below)

## Self-Feeding Pattern

The `graphify`, `obsidian`, and `session` tools follow the **self-feeding pattern**: a pure data layer lives in `packages/core/src/<module>/` (testable under vitest), and the opencode tool in `.opencode/tools/` is a thin shell that re-implements the same logic inline.

**Why the duplication?**
- The opencode plugin runtime does not reliably resolve cross-package TypeScript imports
- Self-contained tools are easier to reason about and debug
- The in-core version is the source of truth for tests
- The opencode tool mirrors it manually

**Example — graphify:**
- `packages/core/src/graphify/` — Pure logic, tested under vitest
- `.opencode/tools/graphify.ts` — Same logic, re-implemented for opencode runtime

**Drift risk:** The two implementations can diverge over time. A drift check should be added if these diverge. The in-core version is the canonical source; the opencode tool is the runtime mirror.

## Path Resolution (ADR-014)

All tool files resolve the workspace root using `import.meta.url`:

```typescript
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

function resolveStorePath(): string {
  const envPath = process.env["TALOS_GRAPHIFY_PATH"];
  if (envPath) return envPath;
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const workspaceRoot = resolve(here, "..", "..");
    return join(workspaceRoot, ".talos", "graphify.json");
  } catch {
    return join(process.cwd(), ".talos", "graphify.json");
  }
}
```

**Why not `process.cwd()`?**
The opencode plugin runtime does NOT set `process.cwd()` to the project root. Using `process.cwd()` as the base for path resolution produces incorrect paths. `import.meta.url` gives the actual file location, and walking up from `.opencode/tools/` reliably reaches the workspace root.

**Environment variable overrides:**
Each tool checks for an environment variable override before falling back to the walk-up logic:
- `TALOS_GRAPHIFY_PATH` — Override graphify store location
- `TALOS_VAULT_PATH` — Override Obsidian vault location
- `TALOS_WORKSPACE_ROOT` — Override workspace root

## Usage Examples

### Session Start Ritual

```
User: Let's start working on the workflow engine
Agent: [calls sessionStart()]
       → Loads 20 recent triples (last session's ADR decisions)
       → Lists 3 recent session logs
       → Reads AGENTS.md headings for project rules
       → Returns context bundle with recommendations
Agent: "I see from the last session that we completed Phase 2 drift fixes...
        The next steps are React Flow canvas and Harvester Phase 3."
```

### Mid-Session Learning Capture

```
Agent: [discovers that SkillsTable accepts optional client injection]
Agent: [calls captureLearning({
         subject: "SkillsTable",
         predicate: "supports_optional_client_injection",
         object: "BackportablePattern",
         context: "ADR-018"
       }])
       → Persists triple to graphify.json
       → Returns confirmation
```

### Session End with Full Context

```
Agent: [calls sessionEnd({
         summary: "Built workflow DB persistence with dual-mode support...",
         decisions: ["ADR-018: Dual-mode persistence", "ADR-019: Structural types in db"],
         learnings: [...],
         nextSteps: ["React Flow canvas", "Harvester Phase 3"]
       }])
       → Writes session log to .talos-notes/session/2026-06-06-session.md
       → Persists 3 learnings to graphify.json
       → Returns handoff bundle for next session
```

### Build Verification

```
Agent: [calls runBuild({ package: "core" })]
       → Runs pnpm --filter @talos/core build
       → Returns "Build succeeded for core"
Agent: [calls runTests()]
       → Runs pnpm test
       → Returns "Tests passed for all packages"
```

## Related Documentation

- [mcp-integration.md](./mcp-integration.md) — MCP server configuration
- [opencode-agents.md](./opencode-agents.md) — Subagent system
- [opencode-skills.md](./opencode-skills.md) — Skill loading system
