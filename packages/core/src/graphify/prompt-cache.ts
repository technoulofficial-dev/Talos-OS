/**
 * Graphify Prompt Cache
 * Stores frequently-used prompts in the knowledge graph for reuse.
 * When a prompt is requested, it's looked up by hash; if found, the cached
 * version is returned instead of regenerating.
 *
 * Pattern: addTriple("prompt-cache", hash, cachedOutput)
 *          queryTriples({ entity: "prompt-cache", predicate: hash })
 */

import { addTriple, queryTriples } from "../graphify/store.js";

const PROMPT_CACHE_ENTITY = "prompt-cache";

/**
 * Generate a stable hash for a prompt (for cache key).
 * Uses a simple djb2 hash — fast, no crypto dependency.
 */
function hashPrompt(prompt: string): string {
  let hash = 5381;
  for (let i = 0; i < prompt.length; i++) {
    hash = ((hash << 5) + hash + prompt.charCodeAt(i)) & 0xffffffff;
  }
  return `h${Math.abs(hash).toString(36)}`;
}

/**
 * Look up a cached prompt output.
 * Returns the cached output if found, null otherwise.
 */
export async function getCachedPrompt(prompt: string): Promise<string | null> {
  const hash = hashPrompt(prompt);
  const triples = await queryTriples({
    entity: PROMPT_CACHE_ENTITY,
    predicate: hash,
    limit: 1,
  });

  if (triples.length > 0 && triples[0]) {
    return triples[0].object;
  }
  return null;
}

/**
 * Store a prompt output in the cache.
 */
export async function cachePrompt(prompt: string, output: string): Promise<void> {
  const hash = hashPrompt(prompt);
  await addTriple(PROMPT_CACHE_ENTITY, hash, output, `prompt-cache:${Date.now()}`);
}

/**
 * Get from cache or compute fresh.
 * If cache hit, returns cached value. If miss, calls compute, caches result, returns it.
 */
export async function cachedComputation<T>(
  prompt: string,
  compute: () => Promise<T>,
  serialize?: (result: T) => string,
  deserialize?: (cached: string) => T
): Promise<{ result: T; cached: boolean }> {
  const cached = await getCachedPrompt(prompt);
  if (cached !== null && deserialize) {
    return { result: deserialize(cached), cached: true };
  }

  const result = await compute();
  if (serialize) {
    await cachePrompt(prompt, serialize(result));
  }
  return { result, cached: false };
}
