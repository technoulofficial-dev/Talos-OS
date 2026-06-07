import type { G0DM0D3ModelInfo } from "../types/g0dm0d3.js";

export const OWL_ALPHA_MODEL = "openrouter/owl-alpha";

export const G0DM0D3_FREE_MODELS: G0DM0D3ModelInfo[] = [
  {
    id: "openrouter/owl-alpha",
    name: "Owl Alpha (Free, Top Priority)",
    contextLength: 1_000_000,
    description:
      "OpenRouter's free agentic-optimized 1M-context model. Top-priority in Talos. WARNING: prompt/completion logging documented — do not paste secrets.",
  },
  {
    id: "qwen/qwen3-coder:free",
    name: "Qwen3 Coder (Free)",
    contextLength: 131072,
    description: "Qwen's coding-optimized free model.",
  },
  {
    id: "qwen/qwen3-next-80b-a3b-instruct:free",
    name: "Qwen3 Next 80B (Free)",
    contextLength: 131072,
    description: "Qwen's latest 80B instruction model, free tier.",
  },
  {
    id: "google/gemma-4-31b-it:free",
    name: "Gemma 4 31B IT (Free)",
    contextLength: 131072,
    description: "Google's Gemma 4 31B instruction-tuned model, free.",
  },
  {
    id: "google/gemma-4-26b-a4b-it:free",
    name: "Gemma 4 26B A4B IT (Free)",
    contextLength: 131072,
    description: "Google's Gemma 4 26B variant, free.",
  },
  {
    id: "nvidia/nemotron-3-super-120b-a12b:free",
    name: "Nemotron 3 Super 120B (Free)",
    contextLength: 131072,
    description: "NVIDIA's Nemotron 3 Super 120B, free tier.",
  },
  {
    id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    name: "Nemotron 3 Nano Omni 30B (Free)",
    contextLength: 131072,
    description: "NVIDIA's Nemotron 3 Nano Omni with reasoning, free.",
  },
  {
    id: "moonshotai/kimi-k2.6:free",
    name: "Kimi K2.6 (Free)",
    contextLength: 131072,
    description: "Moonshot AI's Kimi K2.6, free tier.",
  },
  {
    id: "openai/gpt-oss-120b:free",
    name: "GPT-OSS 120B (Free)",
    contextLength: 131072,
    description: "OpenAI's open-source 120B model, free tier.",
  },
  {
    id: "openai/gpt-oss-20b:free",
    name: "GPT-OSS 20B (Free)",
    contextLength: 131072,
    description: "OpenAI's open-source 20B model, free tier.",
  },
  {
    id: "z-ai/glm-4.5-air:free",
    name: "GLM 4.5 Air (Free)",
    contextLength: 131072,
    description: "Zhipu AI's GLM 4.5 Air, free tier.",
  },
  {
    id: "nvidia/nemotron-nano-9b-v2:free",
    name: "Nemotron Nano 9B V2 (Free)",
    contextLength: 131072,
    description: "NVIDIA's Nemotron Nano 9B V2, free tier.",
  },
];

/**
 * Find model info by ID, fallback to first available model if not found.
 */
export function getModelInfo(modelId: string): G0DM0D3ModelInfo {
  const model = G0DM0D3_FREE_MODELS.find((m) => m.id === modelId || m.id === `${modelId}:free`);
  if (model) return model;

  return {
    id: modelId.endsWith(":free") ? modelId : `${modelId}:free`,
    name: "Custom G0DM0D3 Model",
    contextLength: 131072,
    description: "User-defined custom free-tier model.",
  };
}

/**
 * Get fallback list for a model ID in case it experiences temporary downtime.
 */
export function getFallbackModels(failedModelId: string): string[] {
  return G0DM0D3_FREE_MODELS
    .map((m) => m.id)
    .filter((id) => id !== failedModelId);
}
