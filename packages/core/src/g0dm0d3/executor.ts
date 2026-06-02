import { executeG0DM0D3 } from "./client.js";
import type { G0DM0D3ExecutionResult } from "../types/g0dm0d3.js";

export interface G0DM0D3ExecutionRequest {
  model: string;
  prompt: string;
  system?: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Execute a request using OpenRouter Free G0DM0D3 Cloud.
 */
export async function executeG0DM0D3Cloud(
  request: G0DM0D3ExecutionRequest
): Promise<G0DM0D3ExecutionResult> {
  return executeG0DM0D3({
    model: request.model,
    prompt: request.prompt,
    systemPrompt: request.system,
    maxTokens: request.maxTokens,
    temperature: request.temperature,
  });
}

/**
 * Check if OpenRouter is alive (reachable).
 */
export async function isG0DM0D3Alive(): Promise<boolean> {
  try {
    const baseUrl = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${baseUrl}/models`, {
      method: "GET",
      signal: controller.signal,
    });
    
    clearTimeout(timer);
    return response.ok;
  } catch {
    return false;
  }
}
