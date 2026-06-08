/**
 * Workflow Output Compression
 * Compresses large node outputs to save context window space.
 * When an output exceeds MAX_OUTPUT_CHARS, it's truncated with a summary.
 *
 * This prevents downstream nodes from receiving massive payloads
 * (e.g., full HTTP responses) that would blow the context budget.
 */

const MAX_OUTPUT_CHARS = 10_000; // ~2.5K tokens
const TRUNCATION_SUFFIX = "\n\n[...truncated — output exceeded 10K chars, showing last 2K chars]";

export function compressOutput(output: unknown): unknown {
  if (output === null || output === undefined) return output;

  const serialized = typeof output === "string" ? output : JSON.stringify(output);

  if (serialized.length <= MAX_OUTPUT_CHARS) {
    return output;
  }

  // For strings: keep first 8K chars + last 2K chars
  if (typeof output === "string") {
    const keep = MAX_OUTPUT_CHARS - TRUNCATION_SUFFIX.length;
    const head = Math.floor(keep * 0.8); // 80% from start
    const tail = keep - head; // 20% from end
    return serialized.slice(0, head) + TRUNCATION_SUFFIX + serialized.slice(-tail);
  }

  // For objects: truncate the serialized JSON
  const keep = MAX_OUTPUT_CHARS - TRUNCATION_SUFFIX.length;
  const head = Math.floor(keep * 0.8);
  const tail = keep - head;
  const truncated = serialized.slice(0, head) + TRUNCATION_SUFFIX + serialized.slice(-tail);

  try {
    return JSON.parse(truncated);
  } catch {
    return truncated;
  }
}

/**
 * Check if an output would be compressed (for diagnostics).
 */
export function wouldCompress(output: unknown): boolean {
  if (output === null || output === undefined) return false;
  const serialized = typeof output === "string" ? output : JSON.stringify(output);
  return serialized.length > MAX_OUTPUT_CHARS;
}
