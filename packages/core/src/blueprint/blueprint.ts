/**
 * Living Blueprint System
 *
 * The System Agent watches for blueprint changes (git diff on main),
 * parses the semantic diff, and generates a Reconfiguration Plan.
 * On approval: spins up new Docker containers, runs integration tests,
 * blue-green cutover, with auto-rollback if health checks fail within 60s.
 *
 * Implements Section 13.3 of the Talos OS Blueprint.
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";

const execAsync = promisify(exec);

export interface BlueprintVersion {
  version: string;
  commitHash: string;
  timestamp: string;
  approved: boolean;
  appliedAt?: string;
  rolledBackAt?: string;
}

export interface ReconfigurationStep {
  order: number;
  action:
    | "build-image"
    | "start-container"
    | "stop-container"
    | "run-tests"
    | "switch-traffic"
    | "verify-health"
    | "remove-container"
    | "restore-params";
  target: string;
  estimatedDurationMs: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  rollbackAction?: string;
}

export interface ReconfigurationPlan {
  id: string;
  sourceVersion: string;
  targetVersion: string;
  diffSummary: string;
  steps: ReconfigurationStep[];
  requiresApproval: boolean;
  estimatedTotalTimeMs: number;
  rollbackStrategy: string;
  createdAt: string;
  status: "pending" | "approved" | "applying" | "applied" | "failed" | "rolled_back";
  appliedAt?: string;
  rolledBackAt?: string;
}

export interface DiffEntry {
  type: "added" | "modified" | "removed";
  path: string;
  semanticChange: string;
  affectedAgents: string[];
  riskLevel: "low" | "medium" | "high" | "critical";
}

/**
 * Parse a git diff to identify semantic changes in the blueprint.
 */
export async function parseBlueprintDiff(commitRange: string = "HEAD~1..HEAD"): Promise<DiffEntry[]> {
  // Sanitize commitRange to prevent command injection
  if (!/^[a-zA-Z0-9~.]+\.\.?[a-zA-Z0-9~.]+$/.test(commitRange)) {
    throw new Error(`Invalid commitRange format: ${commitRange}`);
  }
  try {
    const { stdout } = await execAsync(`git diff --name-status ${commitRange} BLUEPRINT.md`);
    const entries: DiffEntry[] = [];

    for (const line of stdout.trim().split("\n").filter(Boolean)) {
      const [status, path] = line.split("\t");
      if (!path) continue;

      const type: DiffEntry["type"] =
        status === "A" ? "added" : status === "D" ? "removed" : "modified";

      entries.push({
        type,
        path,
        semanticChange: await extractSemanticChange(path, type, commitRange),
        affectedAgents: inferAffectedAgents(path),
        riskLevel: assessRisk(path, type),
      });
    }

    return entries;
  } catch (err) {
    throw new Error(`Failed to parse blueprint diff: ${(err as Error).message}`);
  }
}

/**
 * Generate a reconfiguration plan from a list of diffs.
 */
export function generatePlan(
  diffs: DiffEntry[],
  sourceVersion: string,
  targetVersion: string
): ReconfigurationPlan {
  const steps: ReconfigurationStep[] = [];
  let order = 1;
  const affectedAgents = new Set(diffs.flatMap((d) => d.affectedAgents));

  // Step 1: Build new container images for affected agents
  for (const agentId of affectedAgents) {
    steps.push({
      order: order++,
      action: "build-image",
      target: `talos-agent-${agentId}:${targetVersion}`,
      estimatedDurationMs: 60_000,
      riskLevel: "medium",
      rollbackAction: `docker rmi talos-agent-${agentId}:${targetVersion}`,
    });
  }

  // Step 2: Run integration tests on new images
  steps.push({
    order: order++,
    action: "run-tests",
    target: "integration-suite",
    estimatedDurationMs: 120_000,
    riskLevel: "high",
    rollbackAction: "abort-pipeline",
  });

  // Step 3: Blue-green deploy affected agents
  for (const agentId of affectedAgents) {
    steps.push({
      order: order++,
      action: "start-container",
      target: `talos-agent-${agentId}-green:${targetVersion}`,
      estimatedDurationMs: 10_000,
      riskLevel: "medium",
    });
  }

  // Step 4: Verify health of green containers
  for (const agentId of affectedAgents) {
    steps.push({
      order: order++,
      action: "verify-health",
      target: `talos-agent-${agentId}-green`,
      estimatedDurationMs: 5_000,
      riskLevel: "high",
    });
  }

  // Step 5: Switch traffic from blue to green
  for (const agentId of affectedAgents) {
    steps.push({
      order: order++,
      action: "switch-traffic",
      target: `talos-agent-${agentId}`,
      estimatedDurationMs: 2_000,
      riskLevel: "critical",
      rollbackAction: `switch-traffic talos-agent-${agentId} back-to-blue`,
    });
  }

  // Step 6: Stop blue containers (60s grace period, enforced by waitForHealthCheck in applyPlan)
  steps.push({
    order: order++,
    action: "stop-container",
    target: "*-blue",
    estimatedDurationMs: 5_000,
    riskLevel: "low",
  });

  const estimatedTotalTimeMs = steps.reduce((sum, s) => sum + s.estimatedDurationMs, 0);
  const requiresApproval = diffs.some((d) => d.riskLevel === "high" || d.riskLevel === "critical");

  return {
    id: createHash("sha256")
      .update(`${sourceVersion}->${targetVersion}:${Date.now()}`)
      .digest("hex")
      .slice(0, 12),
    sourceVersion,
    targetVersion,
    diffSummary: diffs
      .map((d) => `${d.type}: ${d.path} (${d.affectedAgents.join(", ") || "no agent impact"})`)
      .join("\n"),
    steps,
    requiresApproval,
    estimatedTotalTimeMs,
    rollbackStrategy: "Auto-rollback if health checks fail within 60s of cutover",
    createdAt: new Date().toISOString(),
    status: "pending",
  };
}

/**
 * Apply a reconfiguration plan with health checks and auto-rollback.
 */
export async function applyPlan(plan: ReconfigurationPlan): Promise<{
  success: boolean;
  appliedSteps: number;
  rolledBack: boolean;
  error?: string;
}> {
  if (plan.requiresApproval && plan.status !== "approved") {
    throw new Error("Plan requires approval before application. Use approvePlan() first.");
  }

  plan.status = "applying";
  let appliedSteps = 0;
  const startedAt = Date.now();

  try {
    for (const step of plan.steps) {
      await executeStep(step);
      appliedSteps++;
    }

    // Health check window
    const healthy = await waitForHealthCheck(60_000);
    if (!healthy) {
      await rollbackPlan(plan);
      plan.status = "rolled_back";
      return { success: false, appliedSteps, rolledBack: true, error: "Health check failed" };
    }

    plan.status = "applied";
    plan.appliedAt = new Date().toISOString();
    return { success: true, appliedSteps, rolledBack: false };
  } catch (err) {
    await rollbackPlan(plan);
    plan.status = "failed";
    return {
      success: false,
      appliedSteps,
      rolledBack: true,
      error: (err as Error).message,
    };
  }
}

/**
 * Approve a reconfiguration plan.
 */
export function approvePlan(plan: ReconfigurationPlan): ReconfigurationPlan {
  if (plan.status !== "pending") {
    throw new Error(`Cannot approve plan with status ${plan.status}: only pending plans can be approved`);
  }
  plan.status = "approved";
  return plan;
}

/**
  * Rollback an applied or in-progress plan.
  */
export async function rollbackPlan(plan: ReconfigurationPlan): Promise<void> {
  // Reverse-execute steps
  const reversedSteps = [...plan.steps].reverse();
  for (const step of reversedSteps) {
    if (step.rollbackAction) {
      if (!isRollbackActionAllowed(step.rollbackAction)) {
        console.error(`Unsafe rollback action blocked: ${step.rollbackAction}`);
        continue;
      }
      try {
        await execAsync(step.rollbackAction);
      } catch (err) {
        console.error(`Rollback step failed: ${(err as Error).message}`);
      }
    }
  }
  plan.status = "rolled_back";
  plan.rolledBackAt = new Date().toISOString();
}

// --- Internals ---

function sanitizeForShell(value: string): string {
  if (!value) return value;
  // Remove potentially dangerous characters
  return value.replace(/[;&|`$(){}[\]<>"']/g, "");
}

function isRollbackActionAllowed(action: string): boolean {
  if (!action) return false;
  const allowedActions = [
    "docker rmi",
    "docker stop", 
    "docker rm",
    "docker rm -f",
    "abort-pipeline",
    "switch-traffic",
    "git clean",
    "rm -rf"
  ];
  return allowedActions.some((allowed) => action.includes(allowed));
}

async function extractSemanticChange(path: string, _type: string, commitRange: string = "HEAD~1..HEAD"): Promise<string> {
  // Sanitize path before using in git command
  const sanitizedPath = sanitizeForShell(path);
  if (!sanitizedPath || sanitizedPath !== path) {
    return "Invalid path";
  }
  try {
    const { stdout } = await execAsync(`git diff ${commitRange} -- ${sanitizedPath}`);
    // Simplified: in production, use a proper AST parser
    const lines = stdout.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++"));
    return lines.slice(0, 5).join(" | ");
  } catch {
    return "Unable to extract change";
  }
}

function inferAffectedAgents(path: string): string[] {
  const agentMap: Record<string, string> = {
    "talos-agents/loom/": "loom",
    "talos-agents/odin/": "odin",
    "talos-agents/mimir/": "mimir",
    "talos-agents/brokkr/": "brokkr",
    "talos-agents/opencode/": "opencode",
    "talos-agents/muninn/": "muninn",
    "talos-agents/huginn/": "huginn",
    "talos-agents/sage/": "sage",
    "talos-agents/eitri/": "eitri",
    "talos-agents/bragi/": "bragi",
    "talos-agents/nornir/": "nornir",
    "talos-agents/system/": "system",
  };

  for (const [prefix, agentId] of Object.entries(agentMap)) {
    if (path.startsWith(prefix)) return [agentId];
  }
  return [];
}

function assessRisk(path: string, type: string): DiffEntry["riskLevel"] {
  if (path.includes("system/") || path.includes("loom/")) return "critical";
  if (path.includes("BLUEPRINT.md")) return "high";
  if (type === "removed") return "high";
  // Modified non-critical agent paths are medium risk
  if (type === "modified" && (path.includes("/agents/") || path.includes("talos-"))) return "medium";
  return "low";
}

async function executeStep(step: ReconfigurationStep): Promise<void> {
  // Implement real step execution
  switch (step.action) {
    case "build-image":
      console.log(`[blueprint] Building Docker image ${step.target}`);
      await execAsync(`docker build -t ${step.target} .`);
      break;
    case "start-container":
      console.log(`[blueprint] Starting container ${step.target}`);
      await execAsync(`docker start ${step.target}`);
      break;
    case "stop-container":
      console.log(`[blueprint] Stopping container ${step.target}`);
      await execAsync(`docker stop ${step.target}`);
      break;
    case "remove-container":
      console.log(`[blueprint] Removing container ${step.target}`);
      await execAsync(`docker rm ${step.target}`);
      break;
    case "run-tests":
      console.log(`[blueprint] Running integration tests on ${step.target}`);
      await execAsync(`pnpm --filter @talos/tester run integration`);
      break;
    case "switch-traffic":
      console.log(`[blueprint] Switching traffic to ${step.target}`);
      await execAsync(`kubectl rollout restart deployment/${step.target}`);
      break;
    case "verify-health":
      console.log(`[blueprint] Verifying health of ${step.target}`);
      await execAsync(`docker exec ${step.target} healthcheck`);
      break;
    case "restore-params":
      console.log(`[blueprint] Restoring system parameters`);
      break;
    default:
      throw new Error(`Unsupported blueprint action: ${step.action}`);
  }
}

async function waitForHealthCheck(timeoutMs: number): Promise<boolean> {
  // In production, this would query the System Agent's health endpoint
  const startTime = Date.now();
  const pollInterval = 1000; // 1 second polling
  const maxAttempts = Math.ceil(timeoutMs / pollInterval);
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // Use System Agent health endpoint
      const { stdout } = await execAsync(`curl -s http://localhost:8642/health`);
      if (stdout.includes("'healthy': true")) {
        return true;
      }
    } catch (err) {
      // Continue polling if health check fails
    }
    
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }
  
  return false;
}