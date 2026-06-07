# Blueprint System

> **Purpose:** Living Blueprint reconfiguration system. Load this to understand how Talos OS reconfigures itself based on blueprint changes.

## 1. Purpose

The Blueprint system enables Talos OS to reconfigure itself when the master blueprint document changes. It parses git diffs, generates reconfiguration plans, and executes them with health checks and auto-rollback.

## 2. Implementation

**File:** `packages/core/src/blueprint/blueprint.ts` (322 lines)

### Functions

| Function | Purpose |
|----------|---------|
| `parseBlueprintDiff(diff)` | Parse git diff for semantic changes in BLUEPRINT.md |
| `generatePlan(diffs)` | Generate reconfiguration plan from diffs |
| `applyPlan(plan)` | Execute plan with health checks and auto-rollback |
| `approvePlan(planId)` | Approve a plan for execution |
| `rollbackPlan(planId)` | Rollback a executed plan |

## 3. Reconfiguration Steps

| Step | Purpose |
|------|---------|
| `build-image` | Build new Docker image |
| `start-container` | Start new container |
| `stop-container` | Stop old container |
| `run-tests` | Run test suite |
| `switch-traffic` | Switch traffic to new container |
| `verify-health` | Verify health of new container |
| `remove-container` | Remove old container |

## 4. Risk Levels

| Level | Description | Auto-approve? |
|-------|-------------|---------------|
| `low` | Minor config changes | Yes |
| `medium` | Module updates | Yes |
| `high` | Core system changes | No (requires approval) |
| `critical` | Architecture changes | No (requires approval + review) |

## 5. Plan Lifecycle

```
parseBlueprintDiff() → generatePlan() → approvePlan() → applyPlan()
                                                        ↓
                                                  verify-health
                                                        ↓
                                                  (if failed) rollbackPlan()
```

## 6. Health Checks

After applying a plan, the system:
1. Runs health check on new container
2. Verifies API endpoints respond
3. Runs test suite
4. If any check fails, auto-rollbacks to previous state

## 7. Rollback

Rollback reverses the plan steps:
1. Stop new container
2. Start old container
3. Switch traffic back
4. Verify health of old container

## 8. API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/v1/blueprint/diff` | Parse blueprint diff |
| POST | `/v1/blueprint/plan` | Generate reconfiguration plan |

## 9. Configuration

The blueprint system reads `BLUEPRINT.md` from the project root. Changes to this file trigger reconfiguration evaluation.

## 10. Testing

Blueprint tests verify:
- Diff parsing correctly identifies changes
- Plan generation produces valid steps
- Risk levels are correctly assigned
- Rollback works correctly
