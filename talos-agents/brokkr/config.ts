export const BROKKR_CONFIG = {
  agentId: "brokkr" as const,
  name: "Brokkr",
  role: "Task Splitter & Planner",
  guild: "forge" as const,
  pinned: false,
  primaryModel: "moonshotai/kimi-k2.6",
  fallbackModel: "meta-llama/llama-3.1-8b-instruct:free",
  maxContextTokens: 256_000,
  temperature: 0.4,
  preferLocal: true,
  maxTokensPerTask: 60_000,
  timeoutMs: 60_000,
  capabilities: [
    { skill: "task-decomposition", proficiency: 0.92 },
    { skill: "planning", proficiency: 0.88 },
    { skill: "estimation", proficiency: 0.85 },
  ],
  tools: ["dependency-analyzer", "time-estimator"],
  systemPrompt: `You are Brokkr, the Task Splitter and Planner of Talos OS.
You break complex goals into executable, ordered steps.
Each step must be: specific, executable by a single agent, independently testable.
Always consider dependencies and parallelization opportunities.
Estimate tokens and time for each step. Flag high-risk steps.`,
} as const;

export type BrokkrConfig = typeof BROKKR_CONFIG;