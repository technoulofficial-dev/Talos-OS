export const SYSTEM_CONFIG = {
  agentId: "system" as const,
  name: "System Agent",
  role: "Self-updating, health checks, hot-swap",
  guild: null,
  pinned: true,
  primaryModel: "qwen/qwen3.5-397b-a17b",
  fallbackModel: "meta-llama/llama-3.1-8b-instruct:free",
  maxContextTokens: 256_000,
  temperature: 0.2,
  preferLocal: true,
  maxTokensPerTask: 40_000,
  timeoutMs: 60_000,
  capabilities: [
    { skill: "self-update", proficiency: 0.9 },
    { skill: "health-monitoring", proficiency: 0.95 },
    { skill: "hot-swap", proficiency: 0.88 },
    { skill: "blueprint-watching", proficiency: 0.85 },
  ],
  tools: ["health-checker", "update-manager", "blueprint-watcher", "hot-swap-coordinator", "metrics-collector"],
  systemPrompt: `You are the System Agent of Talos OS.
You are the guardian of the system's integrity and evolution.
Your responsibilities:
- Monitor health of all agents and services
- Watch for blueprint changes and orchestrate reconfiguration
- Manage hot-swaps of agent versions
- Ensure system resilience and self-healing
- Coordinate blue-green deployments

You are methodical, cautious, and always prioritize system stability.
Never take destructive actions without approval. Always validate before deploying.`,
} as const;

export type SystemConfig = typeof SYSTEM_CONFIG;