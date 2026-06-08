import { executeLocalOllama, isLocalOllamaAlive, executeG0DM0D3Cloud, isG0DM0D3Alive } from "../g0dm0d3/executor.js";
import { getOnlineDevices } from "../g0dm0d3/registry.js";
import { OWL_ALPHA_MODEL } from "../g0dm0d3/models.js";
import { decide as budgetDecide } from "../budget/gate.js";
import { buildEstimate } from "../budget/tokens.js";
import type { BudgetDecision } from "../types/budget.js";
import {
  isCircuitOpen,
  recordProviderFailure,
  recordProviderSuccess,
  isForceLocal,
  trackProviderUsage,
  isProviderBudgetExceeded,
} from "./capacity.js";

export type ProviderId =
  | "g0dm0d3"
  | "keylessai"
  | "freetheai"
  | "free-ai-router"
  | "puter"
  | "ollama"
  | "cloud";

export interface ModelRequest {
  prompt: string;
  systemPrompt?: string;
  messages?: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  agentId: string;
  preferLocal?: boolean;
}

export interface ModelResponse {
  output: string;
  model: string;
  provider: ProviderId;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  costUsd: number;
  unlimited: boolean;
}

export interface ProviderHealth {
  id: ProviderId;
  healthy: boolean;
  latencyMs?: number;
  lastChecked: number;
  errorRate: number;
  unlimited: boolean;
}

function env(key: string, fallback: string): string {
  return (process.env as Record<string, string | undefined>)[key] ?? fallback;
}

function isOptIn(provider: string): boolean {
  return (process.env as Record<string, string | undefined>)[`FEAT_${provider.toUpperCase().replace(/-/g, "_")}`] === "true";
}

/**
 * Owl Alpha is opt-OUT (default ON). Set TALOS_OWL_ALPHA_ENABLED=false to skip.
 * It uses OpenRouter's free tier so it costs $0 but logs prompts/completions.
 */
export function isOwlAlphaEnabled(): boolean {
  return env("TALOS_OWL_ALPHA_ENABLED", "true") !== "false";
}

function isUnlimited(providerId: ProviderId): boolean {
  return ["g0dm0d3", "keylessai", "freetheai", "free-ai-router", "puter", "ollama"].includes(providerId);
}

function buildMessages(request: ModelRequest): Array<{ role: string; content: string }> {
  const messages: Array<{ role: string; content: string }> = [];
  if (request.systemPrompt) {
    messages.push({ role: "system", content: request.systemPrompt });
  }
  if (request.messages) {
    messages.push(...request.messages);
  } else {
    messages.push({ role: "user", content: request.prompt });
  }
  return messages;
}

interface ProviderCallResult {
  output: string;
  model: string;
  provider: ProviderId;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}

async function callG0DM0D3(request: ModelRequest): Promise<ProviderCallResult> {
  const model = request.model ?? "meta-llama/llama-3.1-8b-instruct:free";
  const result = await executeG0DM0D3Cloud({
    model,
    prompt: request.prompt,
    systemPrompt: request.systemPrompt,
    temperature: request.temperature,
    maxTokens: request.maxTokens,
  });
  return {
    output: result.output,
    model: result.modelUsed,
    provider: "g0dm0d3",
    tokensIn: result.tokensIn,
    tokensOut: result.tokensOut,
    costUsd: 0,
  };
}

/**
 * Try Owl Alpha specifically. Same OpenRouter pipeline as g0dm0d3 but
 * uses the top-priority model id. Returns a result distinguishable by
 * the `model` field (`openrouter/owl-alpha:free`) so the UI can show
 * a "Free / Logging" badge.
 */
async function callOwlAlpha(request: ModelRequest): Promise<ProviderCallResult> {
  const result = await executeG0DM0D3Cloud({
    model: OWL_ALPHA_MODEL,
    prompt: request.prompt,
    systemPrompt: request.systemPrompt,
    temperature: request.temperature,
    maxTokens: request.maxTokens,
  });
  return {
    output: result.output,
    model: result.modelUsed,
    provider: "g0dm0d3",
    tokensIn: result.tokensIn,
    tokensOut: result.tokensOut,
    costUsd: 0,
  };
}

async function callKeylessAI(request: ModelRequest): Promise<ProviderCallResult> {
  const response = await fetch("https://keylessai.thryx.workers.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: request.model ?? "openai-fast",
      messages: buildMessages(request),
      max_tokens: request.maxTokens ?? 4096,
      temperature: request.temperature ?? 0.4,
    }),
  });
  if (!response.ok) throw new Error(`KeylessAI returned ${response.status}`);
  const data = await response.json() as any;
  return {
    output: data.choices?.[0]?.message?.content ?? "",
    model: data.model ?? "keylessai",
    provider: "keylessai",
    tokensIn: data.usage?.prompt_tokens ?? 0,
    tokensOut: data.usage?.completion_tokens ?? 0,
    costUsd: 0,
  };
}

async function callFreeTheAI(request: ModelRequest): Promise<ProviderCallResult> {
  const apiKey = env("FREETHEAI_API_KEY", "");
  if (!apiKey) throw new Error("FREETHEAI_API_KEY not set");
  const response = await fetch("https://api.freetheai.xyz/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: request.model ?? "opc/openai-fast",
      messages: buildMessages(request),
      max_tokens: request.maxTokens ?? 4096,
      temperature: request.temperature ?? 0.4,
    }),
  });
  if (!response.ok) throw new Error(`FreeTheAI returned ${response.status}`);
  const data = await response.json() as any;
  return {
    output: data.choices?.[0]?.message?.content ?? "",
    model: data.model ?? "freetheai",
    provider: "freetheai",
    tokensIn: data.usage?.prompt_tokens ?? 0,
    tokensOut: data.usage?.completion_tokens ?? 0,
    costUsd: 0,
  };
}

async function callFreeAIRouter(request: ModelRequest): Promise<ProviderCallResult> {
  const response = await fetch("https://api.free-ai-router.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: request.model ?? "free:smart",
      messages: buildMessages(request),
      max_tokens: request.maxTokens ?? 4096,
      temperature: request.temperature ?? 0.4,
    }),
  });
  if (!response.ok) throw new Error(`Free-AI-Router returned ${response.status}`);
  const data = await response.json() as any;
  return {
    output: data.choices?.[0]?.message?.content ?? "",
    model: data.model ?? "free-ai-router",
    provider: "free-ai-router",
    tokensIn: data.usage?.prompt_tokens ?? 0,
    tokensOut: data.usage?.completion_tokens ?? 0,
    costUsd: 0,
  };
}

async function callPuter(request: ModelRequest): Promise<ProviderCallResult> {
  const puterToken = env("PUTER_AUTH_TOKEN", "");
  if (!puterToken) throw new Error("PUTER_AUTH_TOKEN not set");
  const response = await fetch("https://api.puter.com/ai/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${puterToken}`,
    },
    body: JSON.stringify({
      model: request.model ?? "claude-sonnet-4-6",
      messages: buildMessages(request),
      max_tokens: request.maxTokens ?? 4096,
      temperature: request.temperature ?? 0.4,
    }),
  });
  if (!response.ok) throw new Error(`Puter returned ${response.status}`);
  const data = await response.json() as any;
  return {
    output: data.choices?.[0]?.message?.content ?? data.message ?? "",
    model: data.model ?? "puter",
    provider: "puter",
    tokensIn: 0,
    tokensOut: 0,
    costUsd: 0,
  };
}

async function callOllama(request: ModelRequest): Promise<ProviderCallResult> {
  const endpoint = env("OLLAMA_URL", "http://127.0.0.1:11434");
  const result = await executeLocalOllama({
    model: request.model ?? "llama3.2",
    prompt: request.prompt,
    system: request.systemPrompt,
    temperature: request.temperature,
    maxTokens: request.maxTokens,
    endpoint,
  });
  return {
    output: result.output,
    model: result.model,
    provider: "ollama",
    tokensIn: result.tokensIn,
    tokensOut: result.tokensOut,
    costUsd: 0,
  };
}

async function callCloud(request: ModelRequest): Promise<ProviderCallResult> {
  const apiKey = env("NVIDIA_API_KEY", env("NVIDIA_NIM_API_KEY", ""));
  if (!apiKey) throw new Error("NVIDIA_API_KEY not set");
  const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: request.model ?? "nvidia/nemotron-3-super-120b-a12b",
      messages: buildMessages(request),
      max_tokens: request.maxTokens ?? 4096,
      temperature: request.temperature ?? 0.4,
    }),
  });
  if (!response.ok) throw new Error(`Cloud returned ${response.status}`);
  const data = await response.json() as any;
  return {
    output: data.choices?.[0]?.message?.content ?? "",
    model: data.model ?? "cloud",
    provider: "cloud",
    tokensIn: data.usage?.prompt_tokens ?? 0,
    tokensOut: data.usage?.completion_tokens ?? 0,
    costUsd: 0.001,
  };
}

async function callProvider(
  providerId: ProviderId,
  request: ModelRequest
): Promise<ProviderCallResult> {
  switch (providerId) {
    case "g0dm0d3": return callG0DM0D3(request);
    case "keylessai": return callKeylessAI(request);
    case "freetheai": return callFreeTheAI(request);
    case "free-ai-router": return callFreeAIRouter(request);
    case "puter": return callPuter(request);
    case "ollama": return callOllama(request);
    case "cloud": return callCloud(request);
  }
}

const OPT_IN_PROVIDERS: Array<{ id: ProviderId; flag: string }> = [
  { id: "keylessai", flag: "keylessai" },
  { id: "freetheai", flag: "freetheai" },
  { id: "free-ai-router", flag: "free-ai-router" },
  { id: "puter", flag: "puter" },
];

export async function routeUnlimited(request: ModelRequest): Promise<ModelResponse> {
  const start = Date.now();
  const errors: Array<{ provider: string; error: string }> = [];
  const ollamaHost = env("OLLAMA_HOST", "http://127.0.0.1:11434");

  // Force-local mode: route everything to Ollama, skip all cloud providers
  if (isForceLocal()) {
    const alive = await isLocalOllamaAlive(ollamaHost, 3000);
    if (alive) {
      try {
        const result = await callOllama(request);
        recordProviderSuccess("ollama");
        return { ...result, latencyMs: Date.now() - start, unlimited: true };
      } catch (err) {
        recordProviderFailure("ollama");
        throw new Error(`Force-local mode: Ollama failed — ${(err as Error).message}`);
      }
    }
    throw new Error("Force-local mode: Ollama not reachable");
  }

  if (request.preferLocal !== false) {
    const alive = await isLocalOllamaAlive(ollamaHost, 3000);
    if (alive) {
      try {
        const result = await callOllama(request);
        recordProviderSuccess("ollama");
        return { ...result, latencyMs: Date.now() - start, unlimited: true };
      } catch (err) {
        recordProviderFailure("ollama");
        errors.push({ provider: "ollama", error: (err as Error).message });
      }
    }

    if (!isCircuitOpen("g0dm0d3")) {
      const devices = getOnlineDevices();
      for (const device of devices) {
        if (device.capabilityScore < 0.3) continue;
        const endpoint = `http://${device.ip}:${device.port}`;
        const peerAlive = await isLocalOllamaAlive(endpoint, 3000);
        if (!peerAlive) continue;
        try {
          const result = await executeLocalOllama({
            model: request.model ?? device.models[0] ?? "llama3.2",
            prompt: request.prompt,
            system: request.systemPrompt,
            temperature: request.temperature,
            maxTokens: request.maxTokens,
            endpoint,
          });
          recordProviderSuccess("g0dm0d3");
          return {
            output: result.output,
            model: result.model,
            provider: "ollama",
            tokensIn: result.tokensIn,
            tokensOut: result.tokensOut,
            costUsd: 0,
            latencyMs: Date.now() - start,
            unlimited: true,
          };
        } catch (err) {
          errors.push({ provider: `g0dm0d3-peer-${device.id}`, error: (err as Error).message });
        }
      }
    }
  }

  // Owl Alpha — skip if circuit open or budget exceeded
  const g0Alive = await isG0DM0D3Alive();
  if (g0Alive && isOwlAlphaEnabled() && !isCircuitOpen("g0dm0d3") && !isProviderBudgetExceeded("g0dm0d3")) {
    try {
      const result = await callOwlAlpha(request);
      recordProviderSuccess("g0dm0d3");
      trackProviderUsage("g0dm0d3", result.tokensIn + result.tokensOut, 0);
      return { ...result, latencyMs: Date.now() - start, unlimited: true };
    } catch (err) {
      recordProviderFailure("g0dm0d3");
      errors.push({ provider: "owl-alpha", error: (err as Error).message });
    }
  }

  // G0DM0D3 cloud — skip if circuit open or budget exceeded
  if (g0Alive && !isCircuitOpen("g0dm0d3") && !isProviderBudgetExceeded("g0dm0d3")) {
    const estimate = buildEstimate({
      systemPrompt: request.systemPrompt ?? "",
      messages: [],
      expectedOutputTokens: Math.min(request.maxTokens ?? 4096, 4096),
      providerId: "openrouter",
    });
    const budgetDecision: BudgetDecision = await budgetDecide({
      agentId: request.agentId,
      channel: "cloud",
      estimatedTokens: estimate.totalTokens,
      estimatedCostUsd: 0,
      priority: "normal",
    });
    if (budgetDecision.allow) {
      try {
        const result = await callG0DM0D3(request);
        recordProviderSuccess("g0dm0d3");
        trackProviderUsage("g0dm0d3", result.tokensIn + result.tokensOut, 0);
        return { ...result, latencyMs: Date.now() - start, unlimited: true };
      } catch (err) {
        recordProviderFailure("g0dm0d3");
        errors.push({ provider: "g0dm0d3", error: (err as Error).message });
      }
    }
  }

  for (const optIn of OPT_IN_PROVIDERS) {
    if (!isOptIn(optIn.flag)) continue;
    if (isCircuitOpen(optIn.id)) continue;
    try {
      const result = await callProvider(optIn.id, request);
      recordProviderSuccess(optIn.id);
      trackProviderUsage(optIn.id, result.tokensIn + result.tokensOut, result.costUsd);
      return { ...result, latencyMs: Date.now() - start, unlimited: true };
    } catch (err) {
      recordProviderFailure(optIn.id);
      errors.push({ provider: optIn.id, error: (err as Error).message });
    }
  }

  const nvidiaKey = env("NVIDIA_API_KEY", env("NVIDIA_NIM_API_KEY", ""));
  if (nvidiaKey && !isCircuitOpen("cloud") && !isProviderBudgetExceeded("cloud")) {
    const nvidiaEstimate = buildEstimate({
      systemPrompt: request.systemPrompt ?? "",
      messages: [],
      expectedOutputTokens: Math.min(request.maxTokens ?? 4096, 4096),
      providerId: "nvidia-nim",
    });
    const nvidiaBudget: BudgetDecision = await budgetDecide({
      agentId: request.agentId,
      channel: "cloud",
      estimatedTokens: nvidiaEstimate.totalTokens,
      estimatedCostUsd: nvidiaEstimate.costUsd,
      priority: "normal",
      providerId: "nvidia-nim",
    });
    if (nvidiaBudget.allow) {
      try {
        const result = await callCloud(request);
        recordProviderSuccess("cloud");
        trackProviderUsage("cloud", result.tokensIn + result.tokensOut, result.costUsd);
        return { ...result, latencyMs: Date.now() - start, unlimited: false };
      } catch (err) {
        recordProviderFailure("cloud");
        errors.push({ provider: "cloud", error: (err as Error).message });
      }
    }
  }

  throw new Error(
    `All providers failed for agent ${request.agentId}:\n${errors
      .map((e) => `  [${e.provider}] ${e.error}`)
      .join("\n")}`
  );
}

export async function checkProviderHealth(): Promise<ProviderHealth[]> {
  const providers: ProviderId[] = [
    "g0dm0d3",
    ...(isOptIn("keylessai") ? ["keylessai" as ProviderId] : []),
    ...(isOptIn("freetheai") ? ["freetheai" as ProviderId] : []),
    ...(isOptIn("free-ai-router") ? ["free-ai-router" as ProviderId] : []),
    ...(isOptIn("puter") ? ["puter" as ProviderId] : []),
    "ollama",
    "cloud",
  ];

  const health: ProviderHealth[] = [];
  for (const providerId of providers) {
    const start = Date.now();
    try {
      await callProvider(providerId, { prompt: "ping", maxTokens: 5, agentId: "health-check" });
      health.push({
        id: providerId,
        healthy: true,
        latencyMs: Date.now() - start,
        lastChecked: Date.now(),
        errorRate: 0,
        unlimited: isUnlimited(providerId),
      });
    } catch {
      health.push({
        id: providerId,
        healthy: false,
        lastChecked: Date.now(),
        errorRate: 1,
        unlimited: isUnlimited(providerId),
      });
    }
  }
  return health;
}
