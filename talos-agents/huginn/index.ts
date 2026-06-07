/**
 * Huginn — Web Researcher & Data Extractor
 * Thoroughly researches topics and extracts structured data from web sources.
 */

import { route } from "@talos/core/router";
import { HUGINN_CONFIG } from "./config.js";

export interface WebResearchRequest {
  query: string;
  sources?: number;
  depth?: "shallow" | "medium" | "deep";
  focusAreas?: string[];
}

export interface WebResearchResult {
  output: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  sources: Array<{
    url: string;
    title: string;
    snippet: string;
    relevance: number;
  }>;
}

export async function runWebResearchTask(request: WebResearchRequest): Promise<WebResearchResult> {
  const start = Date.now();
  const systemPrompt = `${HUGINN_CONFIG.systemPrompt}

You are conducting web research on a specific topic. Provide:
1. Comprehensive summary of findings
2. Key insights and patterns discovered
3. Credible sources with URLs
4. Structured data extraction where applicable
5. Confidence assessment of the information

Always verify facts across multiple sources. Never assume or hallucinate information.`;

  const prompt = `## Research Query\n${request.query}\n\n## Parameters\n- Sources to consult: ${request.sources ?? 5}\n- Research depth: ${request.depth ?? "medium"}\n- Focus areas: ${(request.focusAreas ?? ["facts", "trends", "sources"]).join(", ")}\n\nPlease provide your research findings in a well-structured format with proper citations.`;

  const decision = await route({
    agentId: HUGINN_CONFIG.agentId,
    maxTokens: 15000,
    temperature: HUGINN_CONFIG.temperature,
    preferLocal: HUGINN_CONFIG.preferLocal,
    priority: "high",
    requiredSkills: ["web-research", "data-extraction", "summarization"],
    modelHints: [HUGINN_CONFIG.primaryModel, HUGINN_CONFIG.fallbackModel],
    requiresTools: true,
    systemPrompt,
    prompt,
    messages: [],
  });

  return {
    output: decision.output ?? "",
    model: decision.model ?? HUGINN_CONFIG.primaryModel,
    tokensIn: decision.tokensIn ?? 0,
    tokensOut: decision.tokensOut ?? 0,
    latencyMs: decision.latencyMs ?? (Date.now() - start),
    sources: [], // In a real implementation, this would be populated from tool results
  };
}

export { HUGINN_CONFIG };
export type { HuginnConfig } from "./config.js";