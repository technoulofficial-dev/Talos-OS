/**
 * OpenCode — Coder & Code Executor
 * Uses the router to execute code generation tasks.
 * ACP (Agent Code Protocol) file operations come in Phase 2.
 */

import { route } from "@talos/core/router";
import { OPENCODE_CONFIG } from "./config.js";

export interface CodeTaskRequest {
  description: string;
  language?: string;
  context?: string;
  testFirst?: boolean;
}

export interface CodeTaskResult {
  output: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
}

export async function runCodeTask(request: CodeTaskRequest): Promise<CodeTaskResult> {
  const start = Date.now();
  const language = request.language ?? "typescript";

  const systemPrompt = `${OPENCODE_CONFIG.systemPrompt}

Generate complete, production-ready code. Follow:
- Language: ${language}
- Tests: ${request.testFirst ? "Write tests BEFORE implementation" : "Write tests AFTER implementation"}
- No placeholders, no TODOs, no TODO comments
- Complete working implementation`;

  const decision = await route({
    agentId: OPENCODE_CONFIG.agentId,
    maxTokens: OPENCODE_CONFIG.maxTokensPerTask,
    temperature: OPENCODE_CONFIG.temperature,
    preferLocal: OPENCODE_CONFIG.preferLocal,
    priority: "high",
    requiredSkills: ["code-execution", language as string],
    modelHints: [OPENCODE_CONFIG.primaryModel, OPENCODE_CONFIG.localModel],
    requiresTools: false,
    systemPrompt,
    prompt: `## Task\n${request.description}\n\n${request.context ? `## Context\n${request.context}` : ""}`,
    messages: [],
  });

  return {
    output: decision.output ?? "",
    model: decision.model ?? OPENCODE_CONFIG.primaryModel,
    tokensIn: decision.tokensIn ?? 0,
    tokensOut: decision.tokensOut ?? 0,
    latencyMs: decision.latencyMs ?? (Date.now() - start),
  };
}

export { OPENCODE_CONFIG };
export type { OpenCodeConfig } from "./config.js";