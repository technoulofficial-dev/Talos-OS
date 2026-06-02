import { PlanCardSchema, type PlanCard, type PlanStep } from "../../packages/core/src/types/task.js";
import { ODIN_CONFIG } from "./config.js";

/**
 * SYS-HERMES H2: PlanCardGenerator
 * Generates structured PlanCards from user goals.
 * Uses the AgentId enum for step assignment.
 */

export interface PlanCardInput {
  goal: string;
  context?: string;
  budget?: { maxUsd: number; maxTokens: number };
}

/**
 * Build a PlanCard from structured steps.
 * In production, this calls the LLM. In Phase 1, it's a template engine.
 */
export function generatePlanCard(input: PlanCardInput): PlanCard {
  const steps: PlanStep[] = [
    {
      id: "step-1",
      title: `Analyze goal: ${input.goal}`,
      agent: "mimir",
      dependsOn: [],
      estimateTokens: 5000,
    },
    {
      id: "step-2",
      title: "Research and gather context",
      agent: "huginn",
      dependsOn: ["step-1"],
      estimateTokens: 10000,
    },
    {
      id: "step-3",
      title: "Create implementation plan",
      agent: "mimir",
      dependsOn: ["step-2"],
      estimateTokens: 8000,
    },
    {
      id: "step-4",
      title: "Execute implementation",
      agent: "opencode",
      dependsOn: ["step-3"],
      estimateTokens: 50000,
    },
    {
      id: "step-5",
      title: "Review and validate",
      agent: "muninn",
      dependsOn: ["step-4"],
      estimateTokens: 10000,
    },
  ];

  const totalTokens = steps.reduce((sum, s) => sum + s.estimateTokens, 0);
  const estimatedCostUsd = (totalTokens / 1_000_000) * 0.002;

  return PlanCardSchema.parse({
    goal: input.goal,
    steps,
    risks: ["Budget may exceed estimate", "External API dependencies"],
    estimatedCost: {
      usd: estimatedCostUsd,
      tokens: totalTokens,
    },
    requiresApproval: true,
  });
}