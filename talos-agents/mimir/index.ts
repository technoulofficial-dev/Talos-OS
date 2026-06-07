/**
 * Mimir — Architect & Risk Auditor
 * Analyzes goals, designs architectures, identifies risks before execution.
 */

import { route } from "@talos/core/router";
import { MIMIR_CONFIG } from "./config.js";

export interface ArchitectureRequest {
  goal: string;
  constraints?: string[];
  existingSystem?: string;
}

export interface ArchitectureResult {
  output: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  risks: Array<{ severity: "critical" | "high" | "medium" | "low"; description: string; mitigation: string }>;
}

export async function runArchitectTask(request: ArchitectureRequest): Promise<ArchitectureResult> {
  const start = Date.now();
  const systemPrompt = `${MIMIR_CONFIG.systemPrompt}

You are analyzing a system architecture request. Provide:
1. Proposed architecture (with component diagram in text format)
2. Critical risks (with severity ratings)
3. Mitigation strategies
4. Dependencies and their risks
5. Rollback complexity assessment
6. Confidence score (0-100%)

Be conservative. Never minimize real risks.`;

  const prompt = `## Goal\n${request.goal}\n\n## Constraints\n${(request.constraints ?? ["budget", "time-to-market", "security"]).map((c) => `- ${c}`).join("\n")}\n\n${request.existingSystem ? `## Existing System\n${request.existingSystem}` : ""}`;

  const decision = await route({
    agentId: MIMIR_CONFIG.agentId,
    maxTokens: 15000,
    temperature: MIMIR_CONFIG.temperature,
    preferLocal: MIMIR_CONFIG.preferLocal,
    priority: "high",
    requiredSkills: ["architecture", "risk-analysis"],
    modelHints: [MIMIR_CONFIG.primaryModel],
    requiresTools: false,
    systemPrompt,
    prompt,
    messages: [],
  });

  return {
    output: decision.output ?? "",
    model: decision.model ?? MIMIR_CONFIG.primaryModel,
    tokensIn: decision.tokensIn ?? 0,
    tokensOut: decision.tokensOut ?? 0,
    latencyMs: decision.latencyMs ?? (Date.now() - start),
    risks: [],
  };
}

export { MIMIR_CONFIG };
export type { MimirConfig } from "./config.js";