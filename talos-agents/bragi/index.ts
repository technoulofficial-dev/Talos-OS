/**
 * Bragi — CMO / Marketing Content
 * Creates compelling content and develops marketing strategies.
 */

import { route } from "@talos/core/router";
import { BRAGI_CONFIG } from "./config.js";

export interface MarketingContentRequest {
  type: "blog-post" | "social-media" | "email" | "ad-copy" | "press-release" | "video-script";
  topic: string;
  targetAudience?: string;
  tone?: "professional" | "casual" | "authoritative" | "friendly" | "humorous";
  length?: "short" | "medium" | "long";
  keywords?: string[];
}

export interface MarketingContentResult {
  output: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  content: {
    title?: string;
    body: string;
    cta?: string;
    hashtags?: string[];
    metaDescription?: string;
  };
  seoScore?: number;
  readabilityScore?: number;
}

export async function runMarketingTask(request: MarketingContentRequest): Promise<MarketingContentResult> {
  const start = Date.now();
  const systemPrompt = `${BRAGI_CONFIG.systemPrompt}

You are creating ${request.type} content. Follow these guidelines:
1. Understand the target audience deeply
2. Create engaging, value-driven content
3. Use appropriate tone and voice
4. Include clear calls-to-action
5. Optimize for the platform/channel
6. Maintain brand consistency
7. Follow SEO best practices if applicable

Always prioritize authenticity and value over manipulation.`;

  const lengthGuide = {
    short: "100-300 words",
    medium: "300-800 words",
    long: "800-2000 words",
  };

  const prompt = `## Content Type\n${request.type}\n\n## Topic\n${request.topic}\n\n${request.targetAudience ? `## Target Audience\n${request.targetAudience}\n\n` : ""}## Tone\n${request.tone ?? "professional"}\n\n## Length\n${lengthGuide[request.length ?? "medium"]}\n\n${request.keywords ? `## Keywords\n${request.keywords.join(", ")}\n\n` : ""}Please create the requested content following the guidelines above.`;

  const decision = await route({
    agentId: BRAGI_CONFIG.agentId,
    maxTokens: 15000,
    temperature: BRAGI_CONFIG.temperature,
    preferLocal: BRAGI_CONFIG.preferLocal,
    priority: "normal",
    requiredSkills: ["content-creation", "marketing-strategy"],
    modelHints: [BRAGI_CONFIG.primaryModel, BRAGI_CONFIG.fallbackModel],
    requiresTools: false,
    systemPrompt,
    prompt,
    messages: [],
  });

  return {
    output: decision.output ?? "",
    model: decision.model ?? BRAGI_CONFIG.primaryModel,
    tokensIn: decision.tokensIn ?? 0,
    tokensOut: decision.tokensOut ?? 0,
    latencyMs: decision.latencyMs ?? (Date.now() - start),
    content: {
      body: decision.output ?? "",
    },
  };
}

export { BRAGI_CONFIG };
export type { BragiConfig } from "./config.js";