import type { G0DM0D3ModelInfo } from "../types/g0dm0d3.js";

export const G0DM0D3_FREE_MODELS: G0DM0D3ModelInfo[] = [
  {
    id: "meta-llama/llama-3-8b-instruct:free",
    name: "Llama 3 8B Instruct (Free)",
    contextLength: 8192,
    description: "Meta's highly capable 8B instruction-tuned model, completely free.",
  },
  {
    id: "meta-llama/llama-3.1-8b-instruct:free",
    name: "Llama 3.1 8B Instruct (Free)",
    contextLength: 131072,
    description: "Meta's upgraded Llama 3.1 model with massive 128k context, completely free.",
  },
  {
    id: "google/gemma-2-9b-it:free",
    name: "Gemma 2 9B IT (Free)",
    contextLength: 8192,
    description: "Google's lightweight, state-of-the-art 9B model optimized for instructions.",
  },
  {
    id: "mistralai/mistral-7b-instruct:free",
    name: "Mistral 7B Instruct (Free)",
    contextLength: 32768,
    description: "Mistral's powerful, high-performance 7B parameter instruction-tuned model.",
  },
  {
    id: "microsoft/phi-3-medium-128k-instruct:free",
    name: "Phi 3 Medium 128K (Free)",
    contextLength: 131072,
    description: "Microsoft's efficient 14B model with extensive 128k context length.",
  },
  {
    id: "microsoft/phi-3-mini-128k-instruct:free",
    name: "Phi 3 Mini 128K (Free)",
    contextLength: 131072,
    description: "Microsoft's lightweight 3.8B model with extensive 128k context length.",
  },
  {
    id: "qwen/qwen-2-7b-instruct:free",
    name: "Qwen 2 7B Instruct (Free)",
    contextLength: 32768,
    description: "Alibaba's advanced, bilingual 7B instruction model.",
  },
  {
    id: "nousresearch/hermes-3-llama-3.1-8b:free",
    name: "Hermes 3 Llama 3.1 8B (Free)",
    contextLength: 131072,
    description: "Nous Research's top-tier agentic fine-tune of Llama 3.1 8B.",
  },
  {
    id: "openchat/openchat-7b:free",
    name: "OpenChat 7B (Free)",
    contextLength: 8192,
    description: "Top-tier 7B parameter open-source model trained with C-RLFT.",
  },
  {
    id: "gryphe/mythomax-l2-13b:free",
    name: "MythoMax L2 13B (Free)",
    contextLength: 4096,
    description: "A highly creative 13B model merge optimized for roleplay and long instructions.",
  },
];

/**
 * Find model info by ID, fallback to Llama 3.1 8B if not found.
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
