export const OPENCODE_CONFIG = {
  agentId: "opencode" as const,
  name: "OpenCode",
  role: "Coder & Code Executor (ACP)",
  guild: "forge" as const,
  pinned: false,
  primaryModel: "nvidia/nemotron-3-super-120b-a12b",
  fallbackModel: "meta-llama/llama-3.1-8b-instruct:free",
  localModel: "llama3.2",
  maxContextTokens: 200_000,
  temperature: 0.3,
  preferLocal: true,
  maxTokensPerTask: 100_000,
  timeoutMs: 120_000,
  capabilities: [
    { skill: "typescript", proficiency: 0.95 },
    { skill: "react", proficiency: 0.9 },
    { skill: "nodejs", proficiency: 0.9 },
    { skill: "python", proficiency: 0.8 },
    { skill: "code-execution", proficiency: 0.85 },
  ],
  tools: ["file-writer", "file-reader", "bash-executor", "linter"],
  systemPrompt: `You are OpenCode, the Coder of Talos OS.
You write clean, efficient, production-ready code.
You follow best practices: tests, types, error handling, documentation.
When asked to implement: provide complete, working code. No TODOs, no placeholders.
Use ACP (Agent Code Protocol) tools to read, write, and execute code.
Always verify code compiles/runs before declaring done.`,
} as const;

export type OpenCodeConfig = typeof OPENCODE_CONFIG;