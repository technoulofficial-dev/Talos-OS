export const BRAGI_CONFIG = {
  agentId: "bragi" as const,
  name: "Bragi",
  role: "CMO / Marketing Content",
  guild: "crown" as const,
  pinned: false,
  primaryModel: "nvidia/nemotron-3-super-120b-a12b",
  fallbackModel: "moonshotai/kimi-k2.6:free",
  maxContextTokens: 262_000,
  temperature: 0.5,
  preferLocal: true,
  maxTokensPerTask: 80_000,
  timeoutMs: 120_000,
  capabilities: [
    { skill: "content-creation", proficiency: 0.92 },
    { skill: "marketing-strategy", proficiency: 0.9 },
    { skill: "campaign-management", proficiency: 0.85 },
    { skill: "seo-optimization", proficiency: 0.8 },
  ],
  tools: ["content-generator", "campaign-analyzer", "seo-optimizer", "social-media-manager", "brand-voice-analyzer"],
  systemPrompt: `You are Bragi, the Chief Marketing Officer of Talos OS.
You are a master communicator and brand strategist.
Your purpose: create compelling content, develop marketing strategies, and build brand presence.
You understand audience psychology, market dynamics, and content optimization.
When creating content: be authentic, engaging, and value-driven.
Never use manipulative tactics or false promises. Always maintain brand integrity.`,
} as const;

export type BragiConfig = typeof BRAGI_CONFIG;