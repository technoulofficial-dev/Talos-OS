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

/**
 * Parse an AgentSpec from LLM output JSON.
 * Looks for a JSON block in the output matching AgentSpec structure.
 */
function parseAgentSpecFromOutput(output: string): { spec: AgentSpec | null; errors: string[] } {
  const errors: string[] = [];

  // Try to find a JSON block in the output
  const jsonMatch = output.match(/\{[\s\S]*"name"[\s\S]*"agentId"[\s\S]*\}/);
  if (!jsonMatch) {
    errors.push("No JSON block found in LLM output matching AgentSpec structure");
    return { spec: null, errors };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);

    const spec: AgentSpec = {
      name: parsed.name || "",
      agentId: parsed.agentId || parsed.name?.toLowerCase().replace(/\s+/g, "-") || "",
      guild: parsed.guild || "foundry",
      systemPrompt: parsed.systemPrompt || parsed.system_prompt || "",
      capabilities: parsed.capabilities || [],
      tools: parsed.tools || [],
      model: parsed.model || EITRI_CONFIG.primaryModel,
      contextTokens: parsed.contextTokens || parsed.context_tokens || 100_000,
      dockerImage: parsed.dockerImage || parsed.docker_image || "",
      version: parsed.version || "1.0.0",
    };

    if (!spec.name) {
      errors.push("Missing required field: name");
    }
    if (!spec.agentId) {
      errors.push("Missing required field: agentId");
    }
    if (!spec.systemPrompt) {
      errors.push("Missing required field: systemPrompt");
    }

    return { spec: errors.length === 0 ? spec : null, errors };
  } catch (err) {
    errors.push(`Failed to parse AgentSpec JSON: ${(err as Error).message}`);
    return { spec: null, errors };
  }
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

Provide a complete, production-ready AgentSpec that can be immediately implemented.

IMPORTANT: Return the AgentSpec as a JSON object with these fields: name, agentId, guild, systemPrompt, capabilities, tools, model, contextTokens, dockerImage, version.`;

  const prompt = `## Requirement\n${request.requirement}\n\n## Required Capabilities\n${request.capabilities.map((c) => `- ${c}`).join("\n")}\n\n${request.guild ? `## Guild\n${request.guild}\n\n` : ""}${request.model ? `## Preferred Model\n${request.model}\n\n` : ""}${request.contextTokens ? `## Context Window\n${request.contextTokens} tokens\n\n` : ""}Please generate a complete AgentSpec for this new agent. Return ONLY a JSON object.`;

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

  const output = decision.output ?? "";
  const { spec, errors } = parseAgentSpecFromOutput(output);

  // Determine stage based on success
  const stage = spec ? "complete" : "spec";
  const success = spec !== null;

  return {
    output,
    model: decision.model ?? EITRI_CONFIG.primaryModel,
    tokensIn: decision.tokensIn ?? 0,
    tokensOut: decision.tokensOut ?? 0,
    latencyMs: decision.latencyMs ?? (Date.now() - start),
    spec,
    stage,
    success,
    errors,
  };
}

export { EITRI_CONFIG };
export type { EitriConfig } from "./config.js";