/**
 * System Agent — Self-updating, health checks, hot-swap
 * Manages system integrity, updates, and reconfiguration.
 */

import { route } from "@talos/core/router";
import { SYSTEM_CONFIG } from "./config.js";

export interface HealthCheckRequest {
  components: Array<"agents" | "database" | "router" | "memory" | "g0dm0d3" | "supabase">;
}

export interface HealthCheckResult {
  output: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  health: {
    overall: "healthy" | "degraded" | "critical";
    components: Record<string, {
      status: "healthy" | "degraded" | "unhealthy" | "unknown";
      latencyMs?: number;
      errorRate?: number;
      message?: string;
    }>;
  };
  recommendations: string[];
}

export interface BlueprintChangeRequest {
  currentBlueprint: string;
  newBlueprint: string;
  diffSummary: string;
}

export interface BlueprintChangeResult {
  output: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  reconfigurationPlan: {
    steps: Array<{
      order: number;
      action: string;
      target: string;
      estimatedDowntime: number;
      riskLevel: "low" | "medium" | "high" | "critical";
    }>;
    requiresApproval: boolean;
    estimatedTotalTime: number;
    rollbackStrategy: string;
  };
}

export interface HotSwapRequest {
  agentId: string;
  currentVersion: string;
  newVersion: string;
  strategy: "blue-green" | "canary" | "rolling";
}

export interface HotSwapResult {
  output: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  swapPlan: {
    steps: string[];
    healthChecks: string[];
    rollbackTriggers: string[];
  };
}

/**
 * Perform comprehensive health check of the system
 */
export async function runHealthCheck(request: HealthCheckRequest): Promise<HealthCheckResult> {
  const start = Date.now();
  const systemPrompt = `${SYSTEM_CONFIG.systemPrompt}

You are performing a comprehensive health check of Talos OS. Provide:
1. Status of each requested component
2. Performance metrics and observations
3. Any issues or concerns detected
4. Recommendations for improvement
5. Overall system health assessment

Be thorough and honest. Report issues immediately.`;

  const prompt = `## Components to Check\n${request.components.join(", ")}\n\nPlease perform a comprehensive health check of these components and provide a detailed status report.`;

  const decision = await route({
    agentId: SYSTEM_CONFIG.agentId,
    maxTokens: 8000,
    temperature: SYSTEM_CONFIG.temperature,
    preferLocal: SYSTEM_CONFIG.preferLocal,
    priority: "high",
    requiredSkills: ["health-monitoring", "metrics-collector"],
    modelHints: [SYSTEM_CONFIG.primaryModel, SYSTEM_CONFIG.fallbackModel],
    requiresTools: true,
    systemPrompt,
    prompt,
    messages: [],
  });

  return {
    output: decision.output ?? "",
    model: decision.model ?? SYSTEM_CONFIG.primaryModel,
    tokensIn: decision.tokensIn ?? 0,
    tokensOut: decision.tokensOut ?? 0,
    latencyMs: decision.latencyMs ?? (Date.now() - start),
    health: {
      overall: "healthy",
      components: {},
    },
    recommendations: [],
  };
}

/**
 * Analyze blueprint changes and generate reconfiguration plan
 */
export async function runBlueprintAnalysis(request: BlueprintChangeRequest): Promise<BlueprintChangeResult> {
  const start = Date.now();
  const systemPrompt = `${SYSTEM_CONFIG.systemPrompt}

You are analyzing changes to the Talos OS blueprint. Your role:
1. Parse the semantic diff to understand what changed
2. Generate a detailed Reconfiguration Plan
3. Identify risks and dependencies
4. Estimate downtime and complexity
5. Plan rollback strategy

Present the plan with clear steps and require human approval for critical changes.`;

  const prompt = `## Diff Summary\n${request.diffSummary}\n\n## Current Blueprint Version\n${request.currentBlueprint.substring(0, 500)}...\n\n## New Blueprint Version\n${request.newBlueprint.substring(0, 500)}...\n\nPlease analyze these blueprint changes and generate a comprehensive reconfiguration plan.`;

  const decision = await route({
    agentId: SYSTEM_CONFIG.agentId,
    maxTokens: 12000,
    temperature: SYSTEM_CONFIG.temperature,
    preferLocal: SYSTEM_CONFIG.preferLocal,
    priority: "critical",
    requiredSkills: ["blueprint-watching", "self-update"],
    modelHints: [SYSTEM_CONFIG.primaryModel, SYSTEM_CONFIG.fallbackModel],
    requiresTools: false,
    systemPrompt,
    prompt,
    messages: [],
  });

  return {
    output: decision.output ?? "",
    model: decision.model ?? SYSTEM_CONFIG.primaryModel,
    tokensIn: decision.tokensIn ?? 0,
    tokensOut: decision.tokensOut ?? 0,
    latencyMs: decision.latencyMs ?? (Date.now() - start),
    reconfigurationPlan: {
      steps: [],
      requiresApproval: true,
      estimatedTotalTime: 0,
      rollbackStrategy: "Auto-rollback if health checks fail within 60 seconds",
    },
  };
}

/**
 * Plan and execute a hot-swap of an agent version
 */
export async function runHotSwap(request: HotSwapRequest): Promise<HotSwapResult> {
  const start = Date.now();
  const systemPrompt = `${SYSTEM_CONFIG.systemPrompt}

You are planning a hot-swap of an agent version. Your role:
1. Choose the optimal swap strategy
2. Plan the execution steps
3. Define health checks to monitor
4. Set rollback triggers
5. Ensure zero downtime

Prioritize safety. Never compromise system stability.`;

  const prompt = `## Hot-Swap Request\nAgent: ${request.agentId}\nCurrent Version: ${request.currentVersion}\nNew Version: ${request.newVersion}\nStrategy: ${request.strategy}\n\nPlease generate a detailed hot-swap plan with steps, health checks, and rollback triggers.`;

  const decision = await route({
    agentId: SYSTEM_CONFIG.agentId,
    maxTokens: 8000,
    temperature: SYSTEM_CONFIG.temperature,
    preferLocal: SYSTEM_CONFIG.preferLocal,
    priority: "high",
    requiredSkills: ["hot-swap", "health-monitoring"],
    modelHints: [SYSTEM_CONFIG.primaryModel, SYSTEM_CONFIG.fallbackModel],
    requiresTools: false,
    systemPrompt,
    prompt,
    messages: [],
  });

  return {
    output: decision.output ?? "",
    model: decision.model ?? SYSTEM_CONFIG.primaryModel,
    tokensIn: decision.tokensIn ?? 0,
    tokensOut: decision.tokensOut ?? 0,
    latencyMs: decision.latencyMs ?? (Date.now() - start),
    swapPlan: {
      steps: [],
      healthChecks: [],
      rollbackTriggers: [],
    },
  };
}

export { SYSTEM_CONFIG };
export type { SystemConfig } from "./config.js";