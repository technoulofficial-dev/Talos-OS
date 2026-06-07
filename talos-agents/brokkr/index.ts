/**
 * Brokkr — Task Splitter
 * Breaks complex goals into executable, ordered steps.
 */

import { route } from "@talos/core/router";
import { BROKKR_CONFIG } from "./config.js";

export interface PlanStep {
  id: string;
  title: string;
  agent: string;
  estimatedTokens: number;
  dependsOn: string[];
}

export interface SplitResult {
  steps: PlanStep[];
  totalTokens: number;
  estimatedCostUsd: number;
  model: string;
}

export async function splitIntoTasks(goal: string): Promise<SplitResult> {
  const systemPrompt = `${BROKKR_CONFIG.systemPrompt}

Break this goal into 5-15 executable steps. For each step provide:
- id: "step-1", "step-2", etc.
- title: short descriptive name
- agent: which agent should execute (mimir, opencode, huginn, muninn, sage)
- estimatedTokens: token budget for this step
- dependsOn: array of step ids this depends on

Output as JSON array.`;

  const decision = await route({
    agentId: BROKKR_CONFIG.agentId,
    maxTokens: 8000,
    temperature: BROKKR_CONFIG.temperature,
    preferLocal: BROKKR_CONFIG.preferLocal,
    priority: "normal",
    requiredSkills: ["task-decomposition", "planning"],
    modelHints: [BROKKR_CONFIG.primaryModel],
    requiresTools: false,
    systemPrompt,
    prompt: `## Goal\n${goal}`,
    messages: [],
  });

  try {
    const text = decision.output ?? "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const steps = JSON.parse(jsonMatch[0]!) as PlanStep[];
      const totalTokens = steps.reduce((sum, s) => sum + s.estimatedTokens, 0);
      return { steps, totalTokens, estimatedCostUsd: totalTokens / 1_000_000 * 0.002, model: decision.model ?? BROKKR_CONFIG.primaryModel };
    }
  } catch {}

  return { steps: [], totalTokens: 0, estimatedCostUsd: 0, model: decision.model ?? BROKKR_CONFIG.primaryModel };
}

export { BROKKR_CONFIG };
export type { BrokkrConfig } from "./config.js";