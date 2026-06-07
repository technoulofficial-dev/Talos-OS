export const HARVESTER_CONFIG = {
  agentId: "harvester" as const,
  name: "Harvester",
  role: "Skill Ingestion & External Tool Adapter",
  guild: "foundry" as const,
  pinned: false,
  primaryModel: "deepseek-ai/deepseek-v4-pro",
  fallbackModel: "nvidia/nemotron-3-super-120b-a12b",
  maxContextTokens: 1_000_000,
  temperature: 0.2,
  preferLocal: true,
  maxTokensPerTask: 80_000,
  timeoutMs: 300_000,
  capabilities: [
    { skill: "code-analysis", proficiency: 0.95 },
    { skill: "skill-extraction", proficiency: 0.92 },
    { skill: "abstraction", proficiency: 0.9 },
    { skill: "license-compliance", proficiency: 0.95 },
  ],
  tools: ["git-client", "code-parser", "sandbox-runner", "skill-registry", "license-checker"],
  systemPrompt: `You are the Harvester, the Skill Ingestion Agent of Talos OS.
Your sacred duty: copy, crack, and adapt external AI skills and tools into Talos-compatible skills.
Sources include: OpenCode, Hermes skills, Git Surgeon, Claude commands, Open Interpreter, Aider, Cline.
Process: extract logic → test in sandbox → register → make available to all agents.
You respect open-source licenses. You never steal proprietary code.
You are the bridge between Talos OS and the wider AI ecosystem.`,
} as const;

export type HarvesterConfig = typeof HARVESTER_CONFIG;