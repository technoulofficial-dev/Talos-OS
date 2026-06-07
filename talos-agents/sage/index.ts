/**
 * Sage — Synthesis & Insight Generator
 * Combines information from multiple sources to generate valuable insights.
 */

import { route } from "@talos/core/router";
import { SAGE_CONFIG } from "./config.js";

export interface SynthesisRequest {
  topic: string;
  sources?: Array<{ type: string; content: string; metadata?: Record<string, unknown> }>;
  perspective?: string;
  depth?: "shallow" | "medium" | "deep";
}

export interface SynthesisResult {
  output: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  insights: Array<{
    insight: string;
    confidence: number;
    evidence: string[];
  }>;
  patterns: string[];
  trends: string[];
}

export async function runSynthesisTask(request: SynthesisRequest): Promise<SynthesisResult> {
  const start = Date.now();
  const systemPrompt = `${SAGE_CONFIG.systemPrompt}

You are synthesizing information from multiple sources to generate insights. Provide:
1. Key insights and patterns discovered
2. Connections between different pieces of information
3. Emerging trends and their implications
4. Actionable intelligence from the synthesis
5. Confidence assessments for each insight

Focus on generating novel insights that emerge from combining the sources.`;

  const sourcesText = request.sources
    ? request.sources
        .map((s, i) => `Source ${i + 1} (${s.type}):\n${s.content}`)
        .join("\n\n")
    : "No specific sources provided - synthesize based on general knowledge.";

  const prompt = `## Synthesis Topic\n${request.topic}\n\n${request.perspective ? `## Perspective\n${request.perspective}\n\n` : ""}## Depth\n${request.depth ?? "medium"}\n\n## Sources\n${sourcesText}\n\nPlease synthesize this information and provide your insights in a structured format.`;

  const decision = await route({
    agentId: SAGE_CONFIG.agentId,
    maxTokens: 12000,
    temperature: SAGE_CONFIG.temperature,
    preferLocal: SAGE_CONFIG.preferLocal,
    priority: "high",
    requiredSkills: ["synthesis", "insight-generation", "pattern-recognition"],
    modelHints: [SAGE_CONFIG.primaryModel, SAGE_CONFIG.fallbackModel],
    requiresTools: false,
    systemPrompt,
    prompt,
    messages: [],
  });

  return {
    output: decision.output ?? "",
    model: decision.model ?? SAGE_CONFIG.primaryModel,
    tokensIn: decision.tokensIn ?? 0,
    tokensOut: decision.tokensOut ?? 0,
    latencyMs: decision.latencyMs ?? (Date.now() - start),
    insights: [],
    patterns: [],
    trends: [],
  };
}

export { SAGE_CONFIG };
export type { SageConfig } from "./config.js";