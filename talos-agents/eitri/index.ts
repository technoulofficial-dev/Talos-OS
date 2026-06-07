/**
 * Eitri — Agent Factory
 * Fabricates new AI agents from specifications through a 6-stage pipeline.
 */

import { route } from "@talos/core/router";
import { EITRI_CONFIG } from "./config.js";

export interface AgentSpecRequest {
  requirement: string;
  capabilities: string[];
  guild?: string;
  model?: string;
  contextTokens?: number;
}

export interface AgentSpec {
  name: string;
  agentId: string;
  guild: string;
  systemPrompt: string;
  capabilities: Array<{ skill: string; proficiency: number }>;
  tools: string[];
  model: string;
  contextTokens: number;
  dockerImage: string;
  version: string;
}

export interface FabricationResult {
  output: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  spec: AgentSpec | null;
  stage: "spec" | "code" | "test" | "quality" | "deploy" | "lifecycle" | "complete";
  success: boolean;
  errors: string[];
}

export async function runAgentFabricationTask(request: AgentSpecRequest): Promise<FabricationResult> {
  const start = Date.now();
  const systemPrompt = `${EITRI_CONFIG.systemPrompt}

You are fabricating a new AI agent based on a requirement. Follow the 6-stage pipeline:

1. **Spec Generation**: Create a complete AgentSpec with:
   - Unique name and agentId
   - Detailed system prompt defining behavior
   - Required capabilities with proficiency scores
   - List of tools needed
   - Recommended model and context window

2. **Code Compilation**: Plan the implementation structure
3. **Sandbox Test**: Define test cases for validation
4. **Quality Gate**: Establish quality criteria
5. **Canary Deploy**: Plan for safe deployment
6. **Lifecycle Management**: Define when and how to retire the agent

Provide a complete, production-ready AgentSpec that can be immediately implemented.`;

  const prompt = `## Requirement\n${request.requirement}\n\n## Required Capabilities\n${request.capabilities.map((c) => `- ${c}`).join("\n")}\n\n${request.guild ? `## Guild\n${request.guild}\n\n` : ""}${request.model ? `## Preferred Model\n${request.model}\n\n` : ""}${request.contextTokens ? `## Context Window\n${request.contextTokens} tokens\n\n` : ""}Please generate a complete AgentSpec for this new agent.`;

  const decision = await route({
    agentId: EITRI_CONFIG.agentId,
    maxTokens: 20000,
    temperature: EITRI_CONFIG.temperature,
    preferLocal: EITRI_CONFIG.preferLocal,
    priority: "critical",
    requiredSkills: ["agent-fabrication", "spec-generation", "code-generation"],
    modelHints: [EITRI_CONFIG.primaryModel, EITRI_CONFIG.fallbackModel],
    requiresTools: true,
    systemPrompt,
    prompt,
    messages: [],
  });

  return {
    output: decision.output ?? "",
    model: decision.model ?? EITRI_CONFIG.primaryModel,
    tokensIn: decision.tokensIn ?? 0,
    tokensOut: decision.tokensOut ?? 0,
    latencyMs: decision.latencyMs ?? (Date.now() - start),
    spec: null, // In a real implementation, this would be parsed from the LLM output
    stage: "spec",
    success: true,
    errors: [],
  };
}

export { EITRI_CONFIG };
export type { EitriConfig } from "./config.js";