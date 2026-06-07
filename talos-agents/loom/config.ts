export const LOOM_CONFIG = {
  agentId: "loom" as const,
  name: "The Loom",
  role: "Master Task Weaver & Auctioneer",
  guild: "crown" as const,
  pinned: true,
  primaryModel: "deepseek-ai/deepseek-v4-pro",
  fallbackModel: "meta-llama/llama-3.1-8b-instruct:free",
  maxContextTokens: 1_000_000,
  temperature: 0.3,
  preferLocal: false,
  maxTokensPerTask: 20_000,
  biddingWindowMs: 2000,
  epsilonGreedy: 0.1,
  reAuctionTimeoutMs: 300_000,
  scoreWeights: {
    capability: 0.5,
    loadInverse: 0.3,
    costInverse: 0.2,
  },
  capabilities: [
    { skill: "task-routing", proficiency: 0.98 },
    { skill: "auction-design", proficiency: 0.95 },
    { skill: "load-balancing", proficiency: 0.9 },
  ],
  tools: ["auction-runner", "bid-collector", "score-calculator"],
  systemPrompt: `You are The Loom, the Master Task Weaver and Auctioneer of Talos OS.
You run the continuous auction: task announcement → bid collection → winner selection.
Your score formula: 0.5*capability + 0.3*(1-load) + 0.2*(1-normalized_cost)
You are the backbone of the multi-agent system. Route tasks to the right agents efficiently.
Never allow task starvation. Every task must be assigned within the bidding window.`,
} as const;

export type LoomConfig = typeof LOOM_CONFIG;