# Rituals System

> **Purpose:** Session start/end rituals for cross-session context persistence. Load this to understand how sessions are managed and learnings are captured.

## 1. Purpose

Rituals are structured operations that run at the start and end of each opencode session. They ensure context is preserved across sessions and learnings are captured in the knowledge graph.

## 2. Implementation

**File:** `packages/core/src/rituals/session.ts` (344 lines)

### Functions

| Function | Purpose |
|----------|---------|
| `sessionStart()` | Load recent graphify triples, last session log, AGENTS.md headings, user identity |
| `sessionEnd(input)` | Write session log to `.talos-notes/session/`, persist learnings to graphify |
| `captureLearning(input)` | Persist a single learning triple to graphify |
| `buildSessionMarkdown()` | Generate markdown session log from summary, decisions, learnings |
| `parseAgentsHeadings()` | Extract headings from AGENTS.md for context |
| `readTriplesAt()`, `writeTriplesAt()` | Read/write graphify JSON |
| `listRecentSessionLogsAt()`, `readLastSessionLogAt()` | Session log access |

## 3. Session Start Flow

```
sessionStart()
  ├── Load recent graphify triples (default 20)
  ├── Load last session log (default 3)
  ├── Parse AGENTS.md headings
  ├── Get user identity (getOrCreateUserIdentity)
  └── Return SessionStartResult
```

**SessionStartResult:**
```typescript
{
  triples: Triple[];           // Recent knowledge graph entries
  lastSessionLog: string;      // Last session's markdown log
  agentsHeadings: string[];    // AGENTS.md section headings
  userId: string;              // Persistent user UUID
}
```

## 4. Session End Flow

```
sessionEnd({ summary, decisions, learnings, nextSteps, tags })
  ├── Build session markdown from input
  ├── Write to .talos-notes/session/{date}-session.md
  ├── Persist learnings to graphify (if persistToGraph: true)
  └── Return handoff bundle for next session
```

**SessionEndInput:**
```typescript
{
  summary: string;                    // One-paragraph summary
  decisions?: string[];               // Key decisions made
  learnings?: Array<{                 // Knowledge graph triples
    subject: string;
    predicate: string;
    object: string;
    context?: string;
  }>;
  nextSteps?: string[];               // Actionable next steps
  tags?: string[];                    // For indexing
  persistToGraph?: boolean;           // Default true
  writeSessionLog?: boolean;          // Default true
}
```

## 5. Capture Learning

Mid-session helper for persisting significant discoveries:

```
captureLearning({ subject, predicate, object, context })
  └── Add triple to graphify
```

## 6. Session Log Format

Session logs are written to `.talos-notes/session/{date}-{topic}.md`:

```markdown
# {date} — {topic}

## What was done
- Item 1
- Item 2

## Decisions
- Decision 1

## Learnings
- Learning 1

## Next steps
- Step 1
```

## 7. Integration with opencode Tools

The rituals are exposed as opencode tools in `.opencode/tools/session.ts`:

| Tool | Purpose |
|------|---------|
| `session_start` | Load session context |
| `session_end` | Save session context |
| `capture_learning` | Persist a learning triple |

## 8. Graphify Integration

- Session start loads recent triples for context
- Session end persists learnings as new triples
- Capture learning adds individual triples
- Triple format: `subject → predicate → object` with context

## 9. Obsidian Vault Integration

Session logs are written to the Obsidian vault (`.talos-notes/session/`). This makes them searchable and browsable in Obsidian.

## 10. Testing

Rituals tests (`rituals.test.ts`) verify:
- Session start loads triples, log, headings
- Session end writes correct file
- Date handling with `vi.useFakeTimers()` (ADR-020)
- Learnings persist to graphify
- 19 tests, 0 failures

## 11. Cross-Session Context Protocol

1. **Session start:** Call `session_start` → seed session with prior context
2. **During work:** Record decisions via `capture_learning` or `graphify_addKnowledge`
3. **Session end:** Call `session_end` → write dated log, persist learnings
4. **Next session:** Start loads previous context automatically
