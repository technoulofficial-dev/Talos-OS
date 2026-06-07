/**
 * Odin Session — Conversation state for the user-facing Odin agent.
 *
 * Wraps the unified router with conversation history, plan-card
 * auto-generation, and session-level result aggregation.
 */

import { route } from "@talos/core/router";
import { generatePlanCard } from "./plan-card.js";
import { ODIN_CONFIG } from "./config.js";
import type { PlanCard } from "../../core/src/types/task.js";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

export interface SessionResult {
  response: string;
  planCard?: PlanCard;
  tokensUsed: number;
  costUsd: number;
  providerType: string;
  latencyMs: number;
}

export class OdinSession {
  private history: ChatMessage[] = [];
  private readonly userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async chat(userMessage: string): Promise<SessionResult> {
    const start = Date.now();
    this.history.push({
      role: "user",
      content: userMessage,
      timestamp: new Date(),
    });

    const messages = this.history.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const decision = await route({
      agentId: "odin",
      maxTokens: ODIN_CONFIG.maxTokensPerTask,
      temperature: ODIN_CONFIG.temperature,
      preferLocal: ODIN_CONFIG.preferLocal,
      priority: "normal",
      systemPrompt: ODIN_CONFIG.systemPrompt,
      prompt: userMessage,
      messages,
    });

    if (decision.type === "none") {
      return {
        response: `[TALOS] Unable to process: ${decision.reason}`,
        tokensUsed: 0,
        costUsd: 0,
        providerType: "none",
        latencyMs: Date.now() - start,
      };
    }

    const output = decision.output ?? "No output generated";
    let planCard: PlanCard | undefined;
    const lc = userMessage.toLowerCase();
    if (lc.includes("plan") || lc.includes("build")) {
      planCard = generatePlanCard({ goal: userMessage });
    }

    this.history.push({
      role: "assistant",
      content: output,
      timestamp: new Date(),
    });

    return {
      response: output,
      planCard,
      tokensUsed: (decision.tokensIn ?? 0) + (decision.tokensOut ?? 0),
      costUsd: decision.costUsd ?? 0,
      providerType: decision.type,
      latencyMs: Date.now() - start,
    };
  }

  getHistory(): ChatMessage[] {
    return [...this.history];
  }

  clearHistory(): void {
    this.history = [];
  }
}
