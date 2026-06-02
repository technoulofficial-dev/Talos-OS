import { z } from "zod";

export const G0DM0D3ModelInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  contextLength: z.number(),
  description: z.string(),
});
export type G0DM0D3ModelInfo = z.infer<typeof G0DM0D3ModelInfoSchema>;

export const G0DM0D3ExecutionRequestSchema = z.object({
  model: z.string(),
  prompt: z.string(),
  systemPrompt: z.string().optional(),
  temperature: z.number().optional(),
  maxTokens: z.number().optional(),
});
export type G0DM0D3ExecutionRequest = z.infer<typeof G0DM0D3ExecutionRequestSchema>;

export const G0DM0D3ExecutionResultSchema = z.object({
  output: z.string(),
  modelUsed: z.string(),
  tokensIn: z.number(),
  tokensOut: z.number(),
  latencyMs: z.number(),
});
export type G0DM0D3ExecutionResult = z.infer<typeof G0DM0D3ExecutionResultSchema>;
