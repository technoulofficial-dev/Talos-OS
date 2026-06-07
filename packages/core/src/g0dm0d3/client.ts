import type { G0DM0D3ExecutionRequest, G0DM0D3ExecutionResult } from "../types/g0dm0d3.js";
import { wrapPrompt } from "./wrapper.js";
import { getFallbackModels } from "./models.js";

/**
 * OpenRouter G0DM0D3 Free Client.
 * Communicates with openrouter.ai using free-tier models and zero-key configuration.
 */
export async function executeG0DM0D3(
  request: G0DM0D3ExecutionRequest
): Promise<G0DM0D3ExecutionResult> {
  const start = Date.now();
  
  // Apply elder-plinius G0DM0D3 wrapper
  const { finalPrompt, finalSystemPrompt } = wrapPrompt(request.prompt, request.systemPrompt);

  const apiKey = (process.env as Record<string, string | undefined>)["OPENROUTER_API_KEY"] ?? "sk-or-v1-0000000000000000000000000000000000000000000000000000000000000000"; // Default anonymous key
  const baseUrl = (process.env as Record<string, string | undefined>)["OPENROUTER_BASE_URL"] ?? "https://openrouter.ai/api/v1";

  // Build the message context
  const messages = [
    { role: "system", content: finalSystemPrompt },
    { role: "user", content: finalPrompt }
  ];

  let lastError: any = null;
  const modelsToTry = [request.model, ...getFallbackModels(request.model)];

  for (const currentModel of modelsToTry) {
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": "https://talos-os.metis.corp", // Custom app header for openrouter
          "X-Title": "Talos OS v8.0",
        },
        body: JSON.stringify({
          model: currentModel,
          messages,
          temperature: request.temperature ?? 0.4,
          max_tokens: request.maxTokens ?? 4096,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenRouter HTTP ${response.status}: ${errText}`);
      }

      const data = await response.json() as {
        choices: Array<{
          message: {
            content: string;
          };
        }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
        };
      };

      const content = data.choices[0]?.message?.content;
      if (content === undefined || content === null) {
        throw new Error("Empty response choices from OpenRouter.");
      }

      return {
        output: content,
        modelUsed: currentModel,
        tokensIn: data.usage?.prompt_tokens ?? 0,
        tokensOut: data.usage?.completion_tokens ?? 0,
        latencyMs: Date.now() - start,
      };
    } catch (err: any) {
      lastError = err;
      // Failover to the next fallback model automatically
      console.warn(`G0DM0D3 Failover: Model ${currentModel} failed. Error: ${err.message}. Trying next fallback...`);
    }
  }

  throw new Error(`G0DM0D3 core exhaustion. All fallback models failed. Last Error: ${lastError?.message}`);
}
