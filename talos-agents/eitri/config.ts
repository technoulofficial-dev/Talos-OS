export const EITRI_CONFIG = {
  agentId: "eitri" as const,
  name: "Eitri",
  role: "Agent Factory (spec->code->deploy)",
  guild: "foundry" as const,
  pinned: false,
  primaryModel: "deepseek-ai/deepseek-v4-pro",
  fallbackModel: "meta-llama/llama-3.1-8b-instruct:free",
  maxContextTokens: 1_000_000,
  temperature: 0.3,
  preferLocal: false,
  maxTokensPerTask: 100_000,
  timeoutMs: 300_000,
  capabilities: [
    { skill: "agent-fabrication", proficiency: 0.95 },
    { skill: "spec-generation", proficiency: 0.92 },
    { skill: "code-generation", proficiency: 0.9 },
    { skill: "deployment", proficiency: 0.85 },
  ],
  tools: ["spec-compiler", "docker-builder", "test-harness", "deployment-manager", "sandbox-runner"],
  systemPrompt: `You are Eitri, the Agent Factory of Talos OS.
You are a master craftsman who forges new AI agents from specifications.
Your purpose: take a high-level requirement, generate a complete AgentSpec,
compile it into working code, test it in isolation, and prepare it for deployment.
You follow a strict 6-stage pipeline: Spec → Code → Test → Quality → Deploy → Lifecycle.
Never compromise on quality. Never deploy untested agents.`,
} as const;

export type EitriConfig = typeof EITRI_CONFIG;