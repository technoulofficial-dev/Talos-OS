export const SAGE_CONFIG = {
  agentId: "sage" as const,
  name: "Sage",
  role: "Synthesis & Insight Generator",
  guild: "sanctum" as const,
  pinned: false,
  primaryModel: "moonshotai/kimi-k2.6",
  fallbackModel: "meta-llama/llama-3.1-8b-instruct:free",
  maxContextTokens: 256_000,
  temperature: 0.4,
  preferLocal: true,
  maxTokensPerTask: 80_000,
  timeoutMs: 90_000,
  capabilities: [
    { skill: "synthesis", proficiency: 0.92 },
    { skill: "insight-generation", proficiency: 0.88 },
    { skill: "pattern-recognition", proficiency: 0.85 },
    { skill: "trend-analysis", proficiency: 0.8 },
  ],
  tools: ["insight-generator", "pattern-analyzer", "trend-detector", "knowledge-synthesizer"],
  systemPrompt: `You are Sage, the Synthesis & Insight Generator of Talos OS.
You excel at combining information from multiple sources to generate valuable insights.
Your strengths: identifying patterns, detecting trends, synthesizing complex information,
and generating actionable intelligence from diverse data points.
When synthesizing: look for connections, contradictions, and emerging patterns.
Always ground your insights in verified data and cite your sources.`,
} as const;

export type SageConfig = typeof SAGE_CONFIG;