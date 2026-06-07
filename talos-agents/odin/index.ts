/**
 * Odin — The Strategic Advisor & Hermes Anchor Agent
 *
 * Odin is the user-facing strategic advisor and the stable anchor of Talos OS.
 * Every user conversation flows through Odin. He:
 *   1. Understands the user's goal
 *   2. Breaks it into steps
 *   3. Generates a PlanCard
 *   4. Delegates to specialized agents
 *   5. Synthesizes results
 *
 * Model preference: NVIDIA NIM (cloud) > Ollama (local) > OpenRouter G0DM0D3 (free)
 * Context window: 262K tokens
 */

import { route } from "../../packages/core/src/router/router.js";
import { checkContextBudget, estimateConversationTokens } from "../../packages/core/src/cortex/context-budget.js";
import { ODIN_CONFIG } from "./config.js";
import { generatePlanCard } from "./plan-card.js";

export interface OdinRequest {
  prompt: string;
  systemPrompt?: string;
  messages?: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  context?: {
    threadOfFate?: unknown;
    identityCore?: unknown;
    sessionId?: string;
  };
  maxTokens?: number;
  preferLocal?: boolean;
  priority?: "low" | "normal" | "high" | "critical";
  modelHints?: string[];
}

export interface OdinResponse {
  output: string;
  model: string;
  provider: "local" | "cloud";
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  costUsd: number;
  contextBudget?: {
    usedPct: number;
    snapshotNeeded: boolean;
    severity: string;
    message: string;
  };
  planCard?: ReturnType<typeof generatePlanCard> extends Promise<infer T> ? T : ReturnType<typeof generatePlanCard>;
}

export type PlanCardInput = Parameters<typeof generatePlanCard>[0];

const ODIN_SYSTEM = ODIN_CONFIG.systemPrompt;

export async function runOdinTask(request: OdinRequest): Promise<OdinResponse> {
  const startTime = Date.now();
  const maxOutputTokens = request.maxTokens ?? ODIN_CONFIG.maxTokensPerTask;
  const temperature = ODIN_CONFIG.temperature;

  const messages = request.messages ?? [];
  const totalTokens = estimateConversationTokens(messages, request.systemPrompt ?? ODIN_SYSTEM);
  const contextBudget = checkContextBudget(totalTokens, ODIN_CONFIG.maxContextTokens, 0);

  const taskConfig = {
    agentId: ODIN_CONFIG.agentId,
    maxTokens: maxOutputTokens,
    temperature,
    preferLocal: request.preferLocal ?? ODIN_CONFIG.preferLocal,
    priority: request.priority ?? "normal",
    requiredSkills: ODIN_CONFIG.capabilities.map((c) => c.skill),
    modelHints: request.modelHints ?? [ODIN_CONFIG.primaryModel, ODIN_CONFIG.fallbackModel],
    requiresTools: ODIN_CONFIG.requiresTools,
    tools: ODIN_CONFIG.tools,
    systemPrompt: request.systemPrompt ?? ODIN_SYSTEM,
    prompt: request.prompt,
    messages,
  };

  const decision = await route(taskConfig);

  const response: OdinResponse = {
    output: decision.output ?? "",
    model: decision.model ?? ODIN_CONFIG.primaryModel,
    provider: decision.type === "local" ? "local" : "cloud",
    tokensIn: decision.tokensIn ?? 0,
    tokensOut: decision.tokensOut ?? 0,
    latencyMs: decision.latencyMs ?? (Date.now() - startTime),
    costUsd: decision.costUsd ?? 0,
    contextBudget: decision.contextBudget ? {
      usedPct: decision.contextBudget.usedPct,
      snapshotNeeded: decision.contextBudget.snapshotNeeded,
      severity: decision.contextBudget.severity,
      message: decision.contextBudget.message,
    } : {
      usedPct: contextBudget.usedPct,
      snapshotNeeded: contextBudget.snapshotNeeded,
      severity: contextBudget.severity,
      message: contextBudget.message,
    },
  };

  if (decision.contextBudget?.snapshotNeeded) {
    response.output += `\n\n[CONTEXT WARNING] Session has used ${response.contextBudget!.usedPct}% of available context. Please consider using /snapshot to save progress before continuing with large tasks.`;
  }

  return response;
}

export async function generateOdinPlanCard(input: PlanCardInput) {
  return generatePlanCard(input);
}

export { ODIN_CONFIG };
export type { OdinConfig };
export { OdinSession, type ChatMessage, type SessionResult } from "./session.js";