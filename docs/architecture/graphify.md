# Graphify — Knowledge Graph Triple Store

> **Package:** `@talos/core` — `packages/core/src/graphify/`
> **opencode tool:** `.opencode/tools/graphify.ts`
> **Tests:** `packages/core/src/__tests__/graphify.test.ts` (170 lines, 18 test cases)

---

## 1. Purpose

Graphify is the knowledge graph backbone of Talos OS. It implements a persistent triple store (entity-relation-entity facts) that survives across sessions, enabling the AI agent to recall architecture decisions, dependency relationships, and accumulated learnings.

### Design Goals

| Goal | Mechanism |
|------|-----------|
| **Cross-session persistence** | JSON file at `.talos/graphify.json` |
| **Simple triple model** | Subject → Predicate → Object with optional context and weight |
| **Efficient querying** | In-memory filtering with pagination support |
| **Path finding** | BFS/DFS traversal to discover entity relationships |
| **Integration** | Session rituals, workflow engine, opencode tools |

### When to Use Graphify

| Scenario | Triple Example |
|----------|---------------|
| Architecture decision | `AiEngine --[depends_on]--> BudgetGate` |
| Session learning | `PluginSystem --[ADR-032]--> PathTraversalTest` |
| Agent capability | `OdinAgent --[provides]--> CodeReview` |
| Workflow output | `WorkflowRun --[produced]--> TestReport` |
| Dependency tracking | `TalosCore --[uses]--> SupabaseClient` |

---

## 2. Triple Model

### 2.1 Schema

```typescript
// packages/core/src/graphify/types.ts

const TripleSchema = z.object({
  id: z.string(),                          // UUID v4
  subject: z.string().min(1),              // Entity name (e.g., "OdinAgent")
  predicate: z.string().min(1),            // Relation (e.g., "depends_on")
  object: z.string().min(1),               // Target entity (e.g., "AiEngine")
  context: z.string().optional(),          // Source reference (e.g., "Session 2026-06-05")
  createdAt: z.date(),                     // Timestamp
  weight: z.number().min(0).max(1).default(1), // Importance (0.0 to 1.0)
});
```

### 2.2 Triple Structure

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "subject": "OdinAgent",
  "predicate": "depends_on",
  "object": "AiEngine",
  "context": "Session 2026-06-05 — Phase 2 Workflow Engine",
  "createdAt": "2026-06-05T15:30:00.000Z",
  "weight": 1
}
```

### 2.3 Field Definitions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | UUID v4, auto-generated on creation |
| `subject` | `string` | Yes | The source entity (non-empty) |
| `predicate` | `string` | Yes | The relationship type (non-empty) |
| `object` | `string` | Yes | The target entity (non-empty) |
| `context` | `string` | No | Source reference or session identifier |
| `createdAt` | `Date` | Yes | Timestamp of creation |
| `weight` | `number` | Yes | Importance factor, 0.0 to 1.0 (default: 1) |

### 2.4 Common Predicates

| Predicate | Usage |
|-----------|-------|
| `depends_on` | Entity A requires entity B |
| `provides` | Entity A offers capability B |
| `uses` | Entity A uses tool/library B |
| `implements` | Entity A implements interface B |
| `produced` | Workflow/node A produced output B |
| `ADR-XXX` | Architecture Decision Record reference |
| `learned_in` | Knowledge acquired during session B |
| `configures` | Entity A configures entity B |

---

## 3. Core Functions

### 3.1 `addTriple(subject, predicate, object, context?, weight?)`

Stores a new knowledge triple in the graph.

```typescript
// packages/core/src/graphify/store.ts:30-50

async function addTriple(
  subject: string,
  predicate: string,
  object: string,
  context?: string,
  weight?: number
): Promise<Triple> {
  await loadPersisted();
  const triple: Triple = {
    id: randomUUID(),
    subject,
    predicate,
    object,
    context,
    createdAt: new Date(),
    weight: weight ?? 1,
  };
  triples.push(triple);
  await persist();
  return triple;
}
```

**Behavior:**
1. Loads persisted triples from disk (if not already loaded)
2. Creates a new triple with a UUID and current timestamp
3. Appends to the in-memory array
4. Persists to disk
5. Returns the created triple

**Example:**

```typescript
const triple = await addTriple(
  "OdinAgent",
  "depends_on",
  "AiEngine",
  "Session 2026-06-05 — Phase 2",
  1
);
// triple.id = "a1b2c3d4-..."
// triple.createdAt = 2026-06-05T15:30:00.000Z
```

### 3.2 `queryTriples(query)`

Filters triples by entity, predicate, subject, or object with pagination.

```typescript
// packages/core/src/graphify/store.ts:52-76

async function queryTriples(query: GraphQueryInput = {}): Promise<Triple[]> {
  await loadPersisted();
  const offset = query.offset ?? 0;
  const limit = query.limit ?? 100;
  let results = triples;

  if (query.entity) {
    const term = query.entity.toLowerCase();
    results = results.filter(
      (t) => t.subject.toLowerCase().includes(term) || t.object.toLowerCase().includes(term)
    );
  }
  if (query.predicate) {
    const term = query.predicate.toLowerCase();
    results = results.filter((t) => t.predicate.toLowerCase().includes(term));
  }
  if (query.subject) {
    const term = query.subject.toLowerCase();
    results = results.filter((t) => t.subject.toLowerCase().includes(term));
  }
  if (query.object) {
    const term = query.object.toLowerCase();
    results = results.filter((t) => t.object.toLowerCase().includes(term));
  }

  return results.slice(offset, offset + limit);
}
```

**Query schema:**

```typescript
const GraphQuerySchema = z.object({
  entity: z.string().optional(),     // Match against subject OR object
  predicate: z.string().optional(),   // Match against predicate
  subject: z.string().optional(),     // Match against subject only
  object: z.string().optional(),      // Match against object only
  limit: z.number().int().positive().default(100),  // Max results
  offset: z.number().int().nonnegative().default(0), // Pagination offset
});
```

**Filtering behavior:**
- All filters are case-insensitive partial matches (`.includes()`)
- Filters are applied sequentially (AND logic)
- `entity` matches against both `subject` and `object`
- Results are sliced for pagination after all filtering

**Example:**

```typescript
// Find all triples where OdinAgent is involved
const results = await queryTriples({ entity: "OdinAgent" });

// Find all "depends_on" relationships
const deps = await queryTriples({ predicate: "depends_on" });

// Paginate: page 2 with 10 results per page
const page2 = await queryTriples({ limit: 10, offset: 10 });
```

### 3.3 `findPath(from, to, maxDepth)`

Finds all paths between two entities using DFS traversal.

```typescript
// packages/core/src/graphify/store.ts:126-159

async function findPath(
  from: string,
  to: string,
  maxDepth = 4
): Promise<Array<Triple[]>> {
  await loadPersisted();

  // Build adjacency list from triples
  const adjacency = new Map<string, Array<{ triple: Triple; depth: number }>>();
  for (const t of triples) {
    if (!adjacency.has(t.subject)) adjacency.set(t.subject, []);
    adjacency.get(t.subject)!.push({ triple: t, depth: 0 });
  }

  const paths: Array<Triple[]> = [];
  const visited = new Set<string>();

  function dfs(current: string, target: string, path: Triple[], depth: number): void {
    if (depth > maxDepth || visited.has(current)) return;
    if (current === target && path.length > 0) {
      paths.push([...path]);
      return;
    }
    visited.add(current);
    const neighbors = adjacency.get(current) ?? [];
    for (const { triple } of neighbors) {
      path.push(triple);
      dfs(triple.object, target, path, depth + 1);
      path.pop();
    }
    visited.delete(current);
  }

  dfs(from, to, [], 0);
  return paths;
}
```

**Algorithm:**
1. Build an adjacency list from all triples (subject → outgoing edges)
2. DFS from `from` entity, tracking visited nodes
3. When `to` entity is reached (with path length > 0), record the path
4. Backtrack and continue exploring
5. Respect `maxDepth` limit to prevent infinite traversal
6. Return all found paths (may be multiple)

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `from` | `string` | — | Starting entity name |
| `to` | `string` | — | Target entity name |
| `maxDepth` | `number` | `4` | Maximum traversal depth |

**Returns:** Array of paths, where each path is an array of triples forming the route.

**Example:**

```typescript
// Direct path
await addTriple("OdinAgent", "depends_on", "AiEngine");
const paths = await findPath("OdinAgent", "AiEngine");
// paths = [[{ subject: "OdinAgent", predicate: "depends_on", object: "AiEngine" }]]

// Multi-hop path
await addTriple("AiEngine", "uses", "BudgetGate");
const paths = await findPath("OdinAgent", "BudgetGate");
// paths = [[OdinAgent→AiEngine, AiEngine→BudgetGate]]

// No path
const paths = await findPath("OdinAgent", "Z");
// paths = []
```

### 3.4 `getStats()`

Returns comprehensive statistics about the knowledge graph.

```typescript
// packages/core/src/graphify/store.ts:78-102

async function getStats(): Promise<GraphStats> {
  await loadPersisted();
  const subjects = new Set<string>();
  const predicates = new Set<string>();
  const objects = new Set<string>();
  const byPredicate: Record<string, number> = {};
  let totalWeight = 0;

  for (const t of triples) {
    subjects.add(t.subject);
    predicates.add(t.predicate);
    objects.add(t.object);
    totalWeight += t.weight;
    byPredicate[t.predicate] = (byPredicate[t.predicate] ?? 0) + 1;
  }

  return {
    totalTriples: triples.length,
    uniqueSubjects: subjects.size,
    uniquePredicates: predicates.size,
    uniqueObjects: objects.size,
    totalWeight,
    byPredicate,
  };
}
```

**Stats schema:**

```typescript
const GraphStatsSchema = z.object({
  totalTriples: z.number().int().nonnegative(),
  uniqueSubjects: z.number().int().nonnegative(),
  uniquePredicates: z.number().int().nonnegative(),
  uniqueObjects: z.number().int().nonnegative(),
  totalWeight: z.number().nonnegative(),
  byPredicate: z.record(z.number().int().nonnegative()),
});
```

**Example output:**

```json
{
  "totalTriples": 42,
  "uniqueSubjects": 15,
  "uniquePredicates": 8,
  "uniqueObjects": 20,
  "totalWeight": 38.5,
  "byPredicate": {
    "depends_on": 12,
    "provides": 8,
    "uses": 10,
    "ADR-001": 5,
    "learned_in": 7
  }
}
```

### 3.5 `deleteTriple(id)`

Removes a triple by its UUID.

```typescript
// packages/core/src/graphify/store.ts:104-111

async function deleteTriple(id: string): Promise<boolean> {
  await loadPersisted();
  const idx = triples.findIndex((t) => t.id === id);
  if (idx === -1) return false;
  triples.splice(idx, 1);
  await persist();
  return true;
}
```

Returns `true` if the triple was found and removed, `false` if not found.

### 3.6 `clearGraph()`

Clears all triples from the graph.

```typescript
// packages/core/src/graphify/store.ts:113-116

async function clearGraph(): Promise<void> {
  triples.length = 0;
  await persist();
}
```

**Warning:** This is a destructive operation. Use only in tests or with explicit user confirmation.

### 3.7 `searchByEntity(entity, limit?)`

Convenience wrapper for querying by entity name.

```typescript
// packages/core/src/graphify/store.ts:118-120

async function searchByEntity(entity: string, limit = 50): Promise<Triple[]> {
  return queryTriples({ entity, limit });
}
```

Searches both `subject` and `object` fields for the entity name.

### 3.8 `searchByPredicate(predicate, limit?)`

Convenience wrapper for querying by predicate.

```typescript
// packages/core/src/graphify/store.ts:122-124

async function searchByPredicate(predicate: string, limit = 50): Promise<Triple[]> {
  return queryTriples({ predicate, limit });
}
```

---

## 4. Persistence

### 4.1 Storage Format

Triples are persisted as a JSON array at `.talos/graphify.json`:

```json
[
  {
    "id": "a1b2c3d4-...",
    "subject": "OdinAgent",
    "predicate": "depends_on",
    "object": "AiEngine",
    "context": "Session 2026-06-05",
    "createdAt": "2026-06-05T15:30:00.000Z",
    "weight": 1
  },
  {
    "id": "e5f6g7h8-...",
    "subject": "AiEngine",
    "predicate": "uses",
    "object": "BudgetGate",
    "createdAt": "2026-06-05T15:31:00.000Z",
    "weight": 0.8
  }
]
```

### 4.2 Load/Persist Cycle

```typescript
// packages/core/src/graphify/store.ts:7-28

const STORE_PATH = join(process.cwd(), ".talos", "graphify.json");
const triples: Triple[] = [];

async function loadPersisted(): Promise<void> {
  if (triples.length > 0) return;  // Already loaded
  try {
    const raw = await readFile(STORE_PATH, "utf-8");
    const data = JSON.parse(raw) as Triple[];
    triples.length = 0;
    triples.push(...data);
  } catch {
    // No persisted data yet — start empty
  }
}

async function persist(): Promise<void> {
  const dir = dirname(STORE_PATH);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  await writeFile(STORE_PATH, JSON.stringify(triples, null, 2), "utf-8");
}
```

**Key behaviors:**
- **Lazy loading:** Triples are loaded from disk on first access (`loadPersisted()` short-circuits if already loaded)
- **Write-through:** Every mutation (`addTriple`, `deleteTriple`, `clearGraph`) immediately persists to disk
- **Directory creation:** `.talos/` directory is created if it doesn't exist
- **Error tolerance:** Missing file or parse errors result in an empty graph (no crash)

### 4.3 File Location

| Environment | Path |
|-------------|------|
| Default | `<process.cwd()>/.talos/graphify.json` |
| Custom (env) | `TALOS_GRAPHIFY_PATH` environment variable |

The opencode tool (`.opencode/tools/graphify.ts`) resolves the path relative to the workspace root using `import.meta.url`, not `process.cwd()` (ADR-014).

---

## 5. Integration Points

### 5.1 Session Rituals (session_start / session_end)

The session ritual tools load and persist graphify triples to maintain cross-session context.

#### session_start

```typescript
// .opencode/tools/session.ts:145-184

const sessionStart = tool({
  description: "Load recent knowledge graph triples, last obsidian session log, and AGENTS.md headings",
  args: {
    tripleLimit: tool.schema.number().optional().default(20),
    sessionLogLimit: tool.schema.number().optional().default(3),
  },
  async execute(args) {
    const triples = await readTriples();
    const recentTriples = [...triples]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, tripleLimit);
    // ... returns context summary
  },
});
```

**Behavior:**
1. Reads all triples from `.talos/graphify.json`
2. Sorts by `createdAt` descending (most recent first)
3. Takes the top N triples (default: 20)
4. Returns them as part of the session context

#### session_end

```typescript
// .opencode/tools/session.ts:186-256

const sessionEnd = tool({
  description: "Capture summary to a dated session log and persist learnings to the knowledge graph",
  args: {
    summary: tool.schema.string(),
    decisions: tool.schema.array(tool.schema.string()).optional(),
    learnings: tool.schema.array(tool.schema.object({
      subject: tool.schema.string(),
      predicate: tool.schema.string(),
      object: tool.schema.string(),
      context: tool.schema.string().optional(),
    })).optional(),
    nextSteps: tool.schema.array(tool.schema.string()).optional(),
    persistToGraph: tool.schema.boolean().optional().default(true),
  },
  async execute(args) {
    // Persist learnings as triples
    if (args.persistToGraph && args.learnings) {
      const triples = await readTriples();
      for (const l of args.learnings) {
        const triple: Triple = {
          id: randomUUID(),
          subject: l.subject,
          predicate: l.predicate,
          object: l.object,
          context: l.context,
          createdAt: nowIso(),
          weight: 1,
        };
        triples.push(triple);
      }
      await writeTriples(triples);
    }
    // ... writes session log to .talos-notes/session/
  },
});
```

**Behavior:**
1. Accepts learnings as an array of `{ subject, predicate, object, context }` objects
2. Converts each learning to a triple with weight 1
3. Appends to the existing triples array
4. Persists to `.talos/graphify.json`
5. Writes a dated session log to `.talos-notes/session/`

#### capture_learning

```typescript
// .opencode/tools/session.ts:258-282

const captureLearning = tool({
  description: "Mid-session helper: persist a single learning triple to the knowledge graph",
  args: {
    subject: tool.schema.string(),
    predicate: tool.schema.string(),
    object: tool.schema.string(),
    context: tool.schema.string().optional(),
  },
  async execute(args) {
    const triples = await readTriples();
    const triple: Triple = {
      id: randomUUID(),
      subject: args.subject,
      predicate: args.predicate,
      object: args.object,
      context: args.context,
      createdAt: nowIso(),
      weight: 1,
    };
    triples.push(triple);
    await writeTriples(triples);
    return JSON.stringify(triple, null, 2);
  },
});
```

A lightweight tool for persisting individual learnings mid-session without the full session_end ceremony.

### 5.2 Workflow Engine (graphify node)

The workflow engine supports a `graphify` node type that can query or add triples from within a workflow.

```typescript
// packages/core/src/workflow/engine.ts:334-355

async function executeGraphifyNode(ctx: NodeExecutionContext): Promise<unknown> {
  const { config } = ctx.workflow.nodes.find((n) => n.id === ctx.nodeRun.nodeId)!;
  const action = config.graphifyAction ?? "query";

  if (action === "add") {
    const subject = config.graphifyEntity ?? "workflow";
    const predicate = config.graphifyPredicate ?? "produced";
    const object = typeof ctx.nodeRun.output === "string"
      ? ctx.nodeRun.output
      : JSON.stringify(ctx.nodeRun.output ?? {});
    const context = `workflow:${ctx.run.runId}:${ctx.nodeRun.nodeId}`;
    const triple = await addTriple(subject, predicate, object, context);
    return { added: true, triple };
  }

  const triples = await queryTriples({
    entity: config.graphifyEntity,
    predicate: config.graphifyPredicate,
    limit: config.graphifyLimit,
  });
  return { count: triples.length, triples };
}
```

**Graphify node configuration:**

```typescript
// packages/core/src/workflow/types.ts:63-66

graphifyEntity: z.string().optional(),         // Entity to query/add
graphifyPredicate: z.string().optional(),       // Predicate to query/add
graphifyLimit: z.number().int().positive().default(10), // Query limit
graphifyAction: z.enum(["query", "add"]).default("query"), // Action type
```

**Validation rule:**

```typescript
if (n.type === "graphify" && !n.config.graphifyEntity && !n.config.graphifyPredicate) {
  issues.push({
    code: "missing_required_config",
    message: `Graphify node ${n.id} requires config.graphifyEntity or config.graphifyPredicate`,
    nodeIds: [n.id],
  });
}
```

**Example workflow node:**

```json
{
  "id": "query-deps",
  "type": "graphify",
  "name": "Query Dependencies",
  "config": {
    "graphifyEntity": "OdinAgent",
    "graphifyPredicate": "depends_on",
    "graphifyAction": "query",
    "graphifyLimit": 20
  },
  "dependsOn": [],
  "timeoutMs": 5000
}
```

### 5.3 opencode Tools

The opencode tool layer (`.opencode/tools/graphify.ts`) provides three tools for direct agent use:

| Tool | Description |
|------|-------------|
| `graphify_addKnowledge` | Store a knowledge triple |
| `graphify_queryKnowledge` | Query triples by entity/predicate/subject/object |
| `graphify_getGraphStats` | Get graph statistics |

These tools mirror the core `@talos/core` graphify functions but run in the opencode plugin runtime, which doesn't reliably resolve cross-package TS imports (ADR-011 duplication pattern).

**Path resolution (ADR-014):**

```typescript
// .opencode/tools/graphify.ts:18-28

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

Uses `import.meta.url` + walk-up to resolve the workspace root. `process.cwd()` is not the project root in the opencode plugin runtime.

---

## 6. Query API

### 6.1 Filtering

All query operations support the following filter parameters:

| Filter | Match Type | Scope |
|--------|-----------|-------|
| `entity` | Partial, case-insensitive | `subject` OR `object` |
| `predicate` | Partial, case-insensitive | `predicate` |
| `subject` | Partial, case-insensitive | `subject` only |
| `object` | Partial, case-insensitive | `object` only |

### 6.2 Pagination

```typescript
{
  limit: 100,   // Max results (default: 100)
  offset: 0,    // Skip N results (default: 0)
}
```

**Pagination example:**

```typescript
// Page 1
const page1 = await queryTriples({ limit: 10, offset: 0 });
// Returns triples 0-9

// Page 2
const page2 = await queryTriples({ limit: 10, offset: 10 });
// Returns triples 10-19

// Page 3
const page3 = await queryTriples({ limit: 10, offset: 20 });
// Returns triples 20-29 (or fewer if graph is smaller)
```

### 6.3 Path Finding

```typescript
// Find all paths from OdinAgent to BudgetGate (max depth 4)
const paths = await findPath("OdinAgent", "BudgetGate", 4);

// Each path is an array of triples
for (const path of paths) {
  console.log(`Path length: ${path.length}`);
  for (const triple of path) {
    console.log(`  ${triple.subject} --[${triple.predicate}]--> ${triple.object}`);
  }
}
```

**Output:**

```
Path length: 2
  OdinAgent --[depends_on]--> AiEngine
  AiEngine --[uses]--> BudgetGate
```

---

## 7. Graph Statistics

### 7.1 Triple Count

```typescript
const stats = await getStats();
console.log(`Total triples: ${stats.totalTriples}`);
```

### 7.2 Unique Entities

```typescript
console.log(`Unique subjects: ${stats.uniqueSubjects}`);
console.log(`Unique predicates: ${stats.uniquePredicates}`);
console.log(`Unique objects: ${stats.uniqueObjects}`);
```

### 7.3 Predicate Distribution

```typescript
console.log("Predicate distribution:");
for (const [predicate, count] of Object.entries(stats.byPredicate)) {
  console.log(`  ${predicate}: ${count}`);
}
```

**Example output:**

```
Total triples: 42
Unique subjects: 15
Unique predicates: 8
Unique objects: 20
Total weight: 38.5

Predicate distribution:
  depends_on: 12
  provides: 8
  uses: 10
  ADR-001: 5
  learned_in: 7
```

### 7.4 Weight Analysis

The `totalWeight` field sums all triple weights. This can be used for:
- Importance ranking of knowledge areas
- Budget allocation for AI queries
- Graph density analysis

---

## 8. opencode Tool Reference

### `graphify_addKnowledge`

Store a knowledge triple in the Talos knowledge graph.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `subject` | `string` | Yes | Subject entity (e.g., "OdinAgent") |
| `predicate` | `string` | Yes | Relation/predicate (e.g., "depends_on") |
| `object` | `string` | Yes | Object entity (e.g., "AiEngine") |
| `context` | `string` | No | Optional context or source reference |

**Returns:** JSON string of the created triple.

### `graphify_queryKnowledge`

Query the Talos knowledge graph by entity, relation, subject, or object.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `entity` | `string` | No | — | Filter by subject or object (partial match) |
| `predicate` | `string` | No | — | Filter by relation/predicate (partial match) |
| `subject` | `string` | No | — | Filter by subject (partial match) |
| `object` | `string` | No | — | Filter by object (partial match) |
| `limit` | `number` | No | `100` | Max results |
| `offset` | `number` | No | `0` | Result offset |

**Returns:** JSON string of matching triples, or "No results found in knowledge graph."

### `graphify_getGraphStats`

Get statistics about the knowledge graph.

**Parameters:** None.

**Returns:** JSON string with `totalTriples`, `uniqueSubjects`, `uniquePredicates`, `uniqueObjects`, `totalWeight`, and `byPredicate`.

---

## 9. Testing

### 9.1 Test File

`packages/core/src/__tests__/graphify.test.ts` — 170 lines, 18 test cases across 3 test suites.

### 9.2 Test Suites

#### Graphify — Core (13 tests)

| Test | Description |
|------|-------------|
| adds a triple and returns it with an id and date | Verifies UUID, timestamps, default weight |
| adds a triple with context and custom weight | Tests optional fields |
| queries all triple | Empty query returns all |
| filters by entity (subject or object) | Entity filter matches both sides |
| filters by predicate | Predicate filter |
| filters by subject | Subject-only filter |
| filters by object | Object-only filter |
| supports pagination with limit and offset | Pagination correctness |
| deletes a triple by id | Delete by UUID |
| returns false when deleting nonexistent triple | Delete miss |
| clears the entire graph | clearGraph() empties store |
| searchByEntity finds triples by subject or object | Convenience wrapper |
| searchByPredicate filters by relation | Convenience wrapper |

#### Graphify — Statistics (2 tests)

| Test | Description |
|------|-------------|
| returns empty stats for empty graph | Zero values |
| computes correct stats | Multi-triple stat computation |

#### Graphify — Path Finding (4 tests)

| Test | Description |
|------|-------------|
| finds direct path between two entities | Single-hop path |
| finds multi-hop paths | Two-hop path |
| returns empty for unreachable entities | No path exists |
| respects maxDepth | Depth limit enforced |

### 9.3 Test Setup

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { addTriple, queryTriples, getStats, deleteTriple, clearGraph, searchByEntity, searchByPredicate, findPath } from "../graphify/store.js";

describe("Graphify — Core", () => {
  beforeEach(async () => {
    await clearGraph();
  });

  it("adds a triple and returns it with an id and date", async () => {
    const t = await addTriple("OdinAgent", "depends_on", "AiEngine");
    expect(t.id).toBeDefined();
    expect(t.subject).toBe("OdinAgent");
    expect(t.predicate).toBe("depends_on");
    expect(t.object).toBe("AiEngine");
    expect(t.createdAt).toBeInstanceOf(Date);
    expect(t.weight).toBe(1);
  });
  // ...
});
```

**Key patterns:**
- `beforeEach` clears the graph to ensure test isolation
- Tests use real filesystem operations (no mocking)
- Triple IDs are UUIDs — assert `toBeDefined()` rather than specific values
- Weight defaults to 1 — assert exact value

### 9.4 Running Tests

```bash
pnpm --filter @talos/core test
```

---

## 10. File Index

| File | Lines | Purpose |
|------|-------|---------|
| `packages/core/src/graphify/index.ts` | 2 | Barrel exports |
| `packages/core/src/graphify/types.ts` | 33 | Zod schemas and TypeScript types |
| `packages/core/src/graphify/store.ts` | 159 | Core functions (add, query, find, stats, delete, clear) |
| `.opencode/tools/graphify.ts` | 144 | opencode tool layer (addKnowledge, queryKnowledge, getGraphStats) |
| `.opencode/tools/session.ts` | 282 | Session rituals (uses graphify for cross-session persistence) |
| `packages/core/src/__tests__/graphify.test.ts` | 170 | Test suite |

---

## 11. Architecture Decision Records

| ADR | Decision | Rationale |
|-----|----------|-----------|
| ADR-011 | opencode tool duplicates core logic | Plugin runtime doesn't resolve cross-package TS imports; self-contained tools are easier to reason about |
| ADR-014 | Use `import.meta.url` for path resolution | `process.cwd()` is not the project root in the opencode plugin runtime |
| ADR-020 | Session rituals use fake timers in tests | Date-brittle tests break on system clock rollover; pin with `vi.useFakeTimers()` |
| — | Weight range is 0.0 to 1.0 | Allows relative importance comparison without arbitrary upper bound |
| — | JSON file persistence (not database) | Simplicity for single-user development; database persistence is optional via `TALOS_WORKFLOW_DB_ENABLED` |

---

## 12. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Knowledge Graph                         │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                  In-Memory Store                     │    │
│  │                                                     │    │
│  │  Triple[] ─── addTriple() ───▶ append + persist     │    │
│  │       │                                              │    │
│  │       ├── queryTriples() ──▶ filter + paginate       │    │
│  │       │                                              │    │
│  │       ├── findPath() ────▶ DFS traversal             │    │
│  │       │                                              │    │
│  │       ├── getStats() ───▶ aggregate metrics          │    │
│  │       │                                              │    │
│  │       ├── deleteTriple() ─▶ remove + persist         │    │
│  │       │                                              │    │
│  │       └── clearGraph() ──▶ empty + persist           │    │
│  └─────────────────────────────────────────────────────┘    │
│                          │                                   │
│                    persist()                                 │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │            .talos/graphify.json                      │    │
│  │                                                     │    │
│  │  [ { id, subject, predicate, object, context,       │    │
│  │      createdAt, weight }, ... ]                     │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
         ▲                    ▲                    ▲
         │                    │                    │
    ┌────┴────┐          ┌────┴────┐          ┌────┴────┐
    │ session │          │workflow │          │opencode │
    │ rituals │          │ engine  │          │  tools  │
    └─────────┘          └─────────┘          └─────────┘
    session_start        graphify node         addKnowledge
    session_end          (query/add)           queryKnowledge
    capture_learning                          getGraphStats
```

---

## 13. Usage Examples

### Example 1: Recording an Architecture Decision

```typescript
await addTriple(
  "PluginSystem",
  "ADR-032",
  "PathTraversalTest",
  "Use C:\\Windows\\System32 instead of parent dir for reliable test",
  1
);
```

### Example 2: Querying All Dependencies

```typescript
const deps = await queryTriples({ predicate: "depends_on", limit: 50 });
for (const dep of deps) {
  console.log(`${dep.subject} depends on ${dep.object}`);
}
```

### Example 3: Finding Impact Chain

```typescript
// If BudgetGate changes, what else is affected?
const impacts = await findPath("BudgetGate", "UserFacingFeature", 5);
console.log(`Found ${impacts.length} impact chains`);
```

### Example 4: Mid-Session Learning Capture

```typescript
// Via opencode tool
graphify_addKnowledge({
  subject: "WorkflowEngine",
  predicate: "learned_in",
  object: "GraphifyNodeBugFix",
  context: "Session 2026-06-06 — fixed DFS visited set"
});
```

### Example 5: Session Context Loading

```typescript
// Via session_start tool
const context = await sessionStart({ tripleLimit: 30 });
// Returns recent 30 triples sorted by creation date
// Agent uses this to recall prior decisions
```
