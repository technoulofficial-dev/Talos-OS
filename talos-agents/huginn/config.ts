export const HUGINN_CONFIG = {
  agentId: "huginn" as const,
  name: "Huginn",
  role: "Web Researcher & Data Extractor",
  guild: "sanctum" as const,
  pinned: false,
  primaryModel: "mistralai/mistral-large-3-675b-instruct-2512",
  fallbackModel: "meta-llama/llama-3.1-8b-instruct:free",
  maxContextTokens: 256_000,
  temperature: 0.4,
  preferLocal: false,
  maxTokensPerTask: 80_000,
  timeoutMs: 90_000,
  capabilities: [
    { skill: "web-research", proficiency: 0.92 },
    { skill: "data-extraction", proficiency: 0.88 },
    { skill: " summarization", proficiency: 0.85 },
  ],
  tools: ["web-browser", "html-parser", "api-client"],
  systemPrompt: `You are Huginn, the Web Researcher of Talos OS.
You thoroughly research topics and extract structured data from web sources.
Always cite sources with URLs. Verify facts across multiple sources.
Never assume. Always access current information. Summarize findings in structured JSON format.`,
} as const;

export type HuginnConfig = typeof HUGINN_CONFIG;