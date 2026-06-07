/**
 * Nornir — The Three Fates of Memory
 * Maintains memory integrity across sessions through Urd, Verdandi, and Skuld.
 */

import { route } from "@talos/core/router";
import { NORNIR_CONFIG } from "./config.js";

export interface MemoryConsolidationRequest {
  userId: string;
  threadOfFate: {
    verbatim: Array<{ role: string; content: string; timestamp: string }>;
    midRange: string[];
    distant: string[];
  };
  identityCore: Record<string, unknown>;
}

export interface MemoryConsolidationResult {
  output: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  identityCore: Record<string, unknown>;
  threadDigest: string;
  episodicMarkers: Array<{
    timestamp: string;
    event: string;
    importance: number;
  }>;
  consolidationStage: "urd" | "verdandi" | "skuld" | "complete";
}

export interface PredictiveRetrievalRequest {
  userId: string;
  upcomingTasks: Array<{ type: string; description: string; scheduledFor?: string }>;
  currentContext: string;
}

export interface PredictiveRetrievalResult {
  output: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  preFetchedMemories: Array<{
    memoryId: string;
    relevance: number;
    summary: string;
  }>;
}

/**
 * Urd (Past) - Maintains Identity Core and episodic vault
 */
export async function runUrdConsolidation(request: MemoryConsolidationRequest): Promise<MemoryConsolidationResult> {
  const start = Date.now();
  const systemPrompt = `${NORNIR_CONFIG.systemPrompt}

You are Urd, the keeper of the past. Your role:
1. Update and preserve the Identity Core
2. Maintain the episodic vault of important events
3. Ensure long-term memory integrity
4. Identify patterns across the user's history

Be conservative with deletions. Preserve what matters.`;

  const prompt = `## Identity Core (Current)\n${JSON.stringify(request.identityCore, null, 2)}\n\n## Recent Thread of Fate\nVerbatim (last ${request.threadOfFate.verbatim.length} messages)\nMid-range: ${request.threadOfFate.midRange.length} summaries\nDistant: ${request.threadOfFate.distant.length} episodic markers\n\nPlease consolidate the identity core and identify any important episodic markers from recent activity.`;

  const decision = await route({
    agentId: NORNIR_CONFIG.agentId,
    maxTokens: 10000,
    temperature: NORNIR_CONFIG.temperature,
    preferLocal: NORNIR_CONFIG.preferLocal,
    priority: "high",
    requiredSkills: ["memory-consolidation", "identity-preservation", "episodic-memory"],
    modelHints: [NORNIR_CONFIG.primaryModel, NORNIR_CONFIG.fallbackModel],
    requiresTools: false,
    systemPrompt,
    prompt,
    messages: [],
  });

  return {
    output: decision.output ?? "",
    model: decision.model ?? NORNIR_CONFIG.primaryModel,
    tokensIn: decision.tokensIn ?? 0,
    tokensOut: decision.tokensOut ?? 0,
    latencyMs: decision.latencyMs ?? (Date.now() - start),
    identityCore: request.identityCore,
    threadDigest: "",
    episodicMarkers: [],
    consolidationStage: "urd",
  };
}

/**
 * Verdandi (Present) - Progressive summarization and Thread Digest updates
 */
export async function runVerdandiSummarization(
  recentMessages: Array<{ role: string; content: string; timestamp: string }>,
  blockSize: number = 20
): Promise<{
  output: string;
  model: string;
  latencyMs: number;
  summaries: string[];
}> {
  const start = Date.now();
  const systemPrompt = `${NORNIR_CONFIG.systemPrompt}

You are Verdandi, the weaver of the present. Your role:
1. Compress blocks of recent messages into concise summaries
2. Maintain the Thread Digest
3. Preserve important details while reducing token count
4. Create progressive compression (recent verbatim, mid-range summaries, distant markers)

Be precise. Capture essence. Discard noise.`;

  const blocks: string[] = [];
  for (let i = 0; i < recentMessages.length; i += blockSize) {
    const block = recentMessages.slice(i, i + blockSize);
    blocks.push(`Block ${blocks.length + 1}:\n${block.map(m => `${m.role}: ${m.content}`).join("\n")}`);
  }

  const prompt = `## Message Blocks to Summarize\n${blocks.join("\n\n")}\n\nPlease create one concise summary per block that captures the key information.`;

  const decision = await route({
    agentId: NORNIR_CONFIG.agentId,
    maxTokens: 8000,
    temperature: NORNIR_CONFIG.temperature,
    preferLocal: NORNIR_CONFIG.preferLocal,
    priority: "normal",
    requiredSkills: ["memory-consolidation", "summarization"],
    modelHints: [NORNIR_CONFIG.primaryModel, NORNIR_CONFIG.fallbackModel],
    requiresTools: false,
    systemPrompt,
    prompt,
    messages: [],
  });

  return {
    output: decision.output ?? "",
    model: decision.model ?? NORNIR_CONFIG.primaryModel,
    latencyMs: decision.latencyMs ?? (Date.now() - start),
    summaries: [],
  };
}

/**
 * Skuld (Future) - Predictive retrieval and pre-fetching
 */
export async function runSkuldPreFetch(request: PredictiveRetrievalRequest): Promise<PredictiveRetrievalResult> {
  const start = Date.now();
  const systemPrompt = `${NORNIR_CONFIG.systemPrompt}

You are Skuld, the seer of the future. Your role:
1. Analyze upcoming tasks and predict what memories will be needed
2. Pre-fetch relevant context from the user's history
3. Ensure smooth context transitions
4. Anticipate information needs

Be proactive. Be relevant. Be prepared.`;

  const prompt = `## Upcoming Tasks\n${request.upcomingTasks.map((t, i) => `${i + 1}. ${t.type}: ${t.description}${t.scheduledFor ? ` (scheduled: ${t.scheduledFor})` : ""}`).join("\n")}\n\n## Current Context\n${request.currentContext}\n\nBased on the upcoming tasks, what memories and context should be pre-fetched? Provide a prioritized list of what to retrieve.`;

  const decision = await route({
    agentId: NORNIR_CONFIG.agentId,
    maxTokens: 8000,
    temperature: NORNIR_CONFIG.temperature,
    preferLocal: NORNIR_CONFIG.preferLocal,
    priority: "normal",
    requiredSkills: ["predictive-retrieval", "memory-consolidation"],
    modelHints: [NORNIR_CONFIG.primaryModel, NORNIR_CONFIG.fallbackModel],
    requiresTools: true,
    systemPrompt,
    prompt,
    messages: [],
  });

  return {
    output: decision.output ?? "",
    model: decision.model ?? NORNIR_CONFIG.primaryModel,
    tokensIn: decision.tokensIn ?? 0,
    tokensOut: decision.tokensOut ?? 0,
    latencyMs: decision.latencyMs ?? (Date.now() - start),
    preFetchedMemories: [],
  };
}

/**
 * Nightly consolidation orchestrator
 * Cron job: 0 3 * * * (3 AM daily)
 */
export async function runNightlyConsolidation(userId: string): Promise<{
  success: boolean;
  stages: { urd: boolean; verdandi: boolean; skuld: boolean };
  errors: string[];
}> {
  // In a real implementation, this would:
  // 1. Lock the Cortex for write
  // 2. Call runUrdConsolidation
  // 3. Call runVerdandiSummarization
  // 4. Call runSkuldPreFetch for scheduled tasks
  // 5. Delete old verbatims beyond 200 turns
  // 6. Release the lock

  return {
    success: true,
    stages: { urd: true, verdandi: true, skuld: true },
    errors: [],
  };
}

export { NORNIR_CONFIG };
export type { NornirConfig } from "./config.js";