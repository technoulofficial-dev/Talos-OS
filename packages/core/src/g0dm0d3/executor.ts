/**
 * SYS-G0DM0D3 Executor — All AI execution paths
 *
 * 1. executeLocalOllama   — Local Ollama (GGUF models, $0 cost)
 * 2. executeG0DM0D3Cloud  — OpenRouter free tier (G0DM0D3 protocol)
 * 3. isLocalOllamaAlive   — Health check for local Ollama
 * 4. isG0DM0D3Alive       — Health check for OpenRouter
 */

import { executeG0DM0D3 } from "./client.js";

export interface OllamaChatResult {
  output: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
}

const CHARS_PER_TOKEN = 4;
const env = (key: string, fallback: string): string =>
  (process.env as Record<string, string | undefined>)[key] ?? fallback;

/**
 * Execute a chat completion on a local Ollama instance.
 */
export async function executeLocalOllama(request: {
  model: string;
  prompt: string;
  system?: string;
  temperature?: number;
  maxTokens?: number;
  endpoint?: string;
}): Promise<OllamaChatResult> {
  const start = Date.now();
  const endpoint = request.endpoint ?? env("OLLAMA_HOST", "http://127.0.0.1:11434");
  const url = `${endpoint}/api/chat`;

  const messages: Array<{ role: string; content: string }> = [];
  if (request.system) {
    messages.push({ role: "system", content: request.system });
  }
  messages.push({ role: "user", content: request.prompt });

  const body = {
    model: request.model,
    messages,
    stream: false,
    options: {
      temperature: request.temperature ?? 0.4,
      num_predict: request.maxTokens ?? 4096,
    },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Ollama HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json() as {
      message?: { content?: string };
    };

    const output = data.message?.content ?? "";
    if (!output) {
      throw new Error("Empty response from Ollama");
    }

    const inputText = messages.map((m) => m.content).join("\n");
    const tokensIn = Math.ceil(inputText.length / CHARS_PER_TOKEN);
    const tokensOut = Math.ceil(output.length / CHARS_PER_TOKEN);

    return {
      output,
      model: request.model,
      tokensIn,
      tokensOut,
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

/**
 * Check if local Ollama is alive and responding.
 */
export async function isLocalOllamaAlive(
  endpoint?: string,
  timeoutMs: number = 3000
): Promise<boolean> {
  const url = (endpoint ?? env("OLLAMA_HOST", "http://127.0.0.1:11434")) + "/api/tags";
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timer);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Execute a request using OpenRouter Free G0DM0D3 Cloud.
 * This uses the G0DM0D3 protocol with free-tier models.
 */
export async function executeG0DM0D3Cloud(request: {
  model: string;
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<{ output: string; modelUsed: string; tokensIn: number; tokensOut: number; latencyMs: number }> {
  const result = await executeG0DM0D3({
    model: request.model,
    prompt: request.prompt,
    systemPrompt: request.systemPrompt,
    maxTokens: request.maxTokens,
    temperature: request.temperature,
  });

  return {
    output: result.output,
    modelUsed: result.modelUsed,
    tokensIn: result.tokensIn,
    tokensOut: result.tokensOut,
    latencyMs: result.latencyMs,
  };
}

/**
 * Check if OpenRouter (G0DM0D3) is alive (reachable).
 */
export async function isG0DM0D3Alive(): Promise<boolean> {
  try {
    const baseUrl = env("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1");
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