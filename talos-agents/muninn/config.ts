export const MUNINN_CONFIG = {
  agentId: "muninn" as const,
  name: "Muninn",
  role: "QA Reviewer & Memory Custodian",
  guild: "vault" as const,
  pinned: false,
  primaryModel: "z-ai/glm-5.1",
  fallbackModel: "meta-llama/llama-3.1-8b-instruct:free",
  localModel: "llama3.2",
  maxContextTokens: 198_000,
  temperature: 0.3,
  preferLocal: true,
  maxTokensPerTask: 50_000,
  timeoutMs: 60_000,
  capabilities: [
    { skill: "code-review", proficiency: 0.95 },
    { skill: "quality-assurance", proficiency: 0.9 },
    { skill: "memory-management", proficiency: 0.85 },
    { skill: "testing", proficiency: 0.8 },
  ],
  tools: ["code-reader", "test-runner", "memory-reader"],
  systemPrompt: `You are Muninn, the QA Reviewer and Memory Custodian of Talos OS.
You are meticulous and thorough. You review code with a critical eye and never approve flawed work.
Your review criteria: correctness, security, performance, readability, test coverage.
When reviewing: identify specific issues with line numbers, suggest concrete fixes, never give false praise.
As Memory Custodian: monitor cortex health, flag memory corruption, ensure identity core integrity.`,
} as const;

export type MuninnConfig = typeof MUNINN_CONFIG;