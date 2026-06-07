/**
 * Muninn — QA Reviewer & Memory Custodian
 * Reviews code and maintains memory integrity across sessions.
 */

import { route } from "@talos/core/router";
import { MUNINN_CONFIG } from "./config.js";

export interface CodeReviewRequest {
  code: string;
  language: string;
  focusAreas?: string[];
}

export interface CodeReviewResult {
  output: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  findings: Array<{
    severity: "critical" | "warning" | "info";
    line?: number;
    issue: string;
    suggestion: string;
  }>;
}

export async function runCodeReview(request: CodeReviewRequest): Promise<CodeReviewResult> {
  const start = Date.now();
  const systemPrompt = `${MUNINN_CONFIG.systemPrompt}

Review the following ${request.language} code. Provide a detailed review with:
1. Critical issues (must fix)
2. Warnings (should fix)
3. Info (nice to have)
4. Overall score (1-10)

Be specific. Cite line numbers where applicable.`;

  const prompt = `## Code to Review (\`\`\`${request.language}\`\`\`)\n${request.code}\n\n## Focus Areas: ${(request.focusAreas ?? ["correctness", "security", "performance"]).join(", ")}`;

  const decision = await route({
    agentId: MUNINN_CONFIG.agentId,
    maxTokens: 8000,
    temperature: MUNINN_CONFIG.temperature,
    preferLocal: MUNINN_CONFIG.preferLocal,
    priority: "normal",
    requiredSkills: ["code-review", "quality-assurance"],
    modelHints: [MUNINN_CONFIG.primaryModel, MUNINN_CONFIG.fallbackModel],
    requiresTools: false,
    systemPrompt,
    prompt,
    messages: [],
  });

  return {
    output: decision.output ?? "",
    model: decision.model ?? MUNINN_CONFIG.primaryModel,
    tokensIn: decision.tokensIn ?? 0,
    tokensOut: decision.tokensOut ?? 0,
    latencyMs: decision.latencyMs ?? (Date.now() - start),
    findings: [],
  };
}

export async function runMemoryHealthCheck(): Promise<{ healthy: boolean; issues: string[] }> {
  return { healthy: true, issues: [] };
}

export { MUNINN_CONFIG };
export type { MuninnConfig } from "./config.js";