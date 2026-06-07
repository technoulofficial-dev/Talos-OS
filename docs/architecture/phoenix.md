# Phoenix System

> **Purpose:** Self-improvement dual-agent loop. Load this to understand how Talos OS optimizes itself over time.

## 1. Purpose

Phoenix is a dual-agent self-improvement system that analyzes task performance and evolves system-wide parameters. It consists of Task Phoenix (task-level optimization) and Meta Phoenix (system-level evolution).

## 2. Implementation

**File:** `packages/core/src/phoenix/phoenix.ts` (294 lines)

### Dual-Agent Loop

| Agent | Scope | Purpose |
|-------|-------|---------|
| **Task Phoenix** | Task-level | Analyzes task performance metrics, identifies optimization patterns |
| **Meta Phoenix** | System-level | Evolves system-wide parameters (Loom weights, Nornir prompts) |

## 3. Task Phoenix

Analyzes individual task performance:
- Execution time
- Token usage
- Success/failure rate
- Error patterns

**Output:** Optimization candidates with confidence scores.

## 4. Meta Phoenix

Evolves system-wide parameters:
- Loom auction weights (epsilon greedy tuning)
- Nornir summarization prompts
- Budget thresholds
- Provider priority adjustments

**Output:** Parameter changes with validation results.

## 5. Pattern Lifecycle

```
candidate → validated → promoted → deprecated
```

| Stage | Description |
|-------|-------------|
| `candidate` | Identified optimization, not yet tested |
| `validated` | Tested in sandbox, passed validation |
| `promoted` | Applied to production system |
| `deprecated` | No longer effective, removed |

## 6. Safety Mechanisms

| Mechanism | Purpose |
|-----------|---------|
| Sandbox execution | All changes tested in isolated environment |
| Human approval | Core changes require explicit approval |
| Rollback snapshots | System state saved before changes |
| Kill switch | Immediate halt of all self-improvement |

## 7. Configuration

| Parameter | Default | Purpose |
|-----------|---------|---------|
| Analysis interval | 1 hour | How often Task Phoenix runs |
| Evolution interval | 24 hours | How often Meta Phoenix runs |
| Confidence threshold | 0.8 | Minimum confidence for promotion |
| Max changes per cycle | 3 | Limit on parameter changes |

## 8. Integration

- **Loom:** Auction weight adjustments
- **Nornir:** Prompt optimization
- **Budget:** Threshold tuning
- **Router:** Provider priority adjustments

## 9. Monitoring

Phoenix logs all actions to the knowledge graph:
- `Phoenix → analyzed → TaskPerformance`
- `Phoenix → proposed → ParameterChange`
- `Phoenix → validated → Pattern`
- `Phoenix → promoted → Optimization`

## 10. Testing

Phoenix tests verify:
- Task analysis correctly identifies patterns
- Meta evolution produces valid parameter changes
- Safety mechanisms prevent dangerous changes
- Rollback works correctly
