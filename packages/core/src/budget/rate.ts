import type { RateLimitCheck } from "../types/budget.js";

/**
 * SYS-BUDGET B5: RateLimiter
 * Sliding window rate limiter (in-memory, Phase 1).
 */

interface RateEntry {
  timestamp: number;
}

const requestLog: Map<string, RateEntry[]> = new Map();

export async function checkRateLimit(
  agentId: string,
  maxPerMinute: number
): Promise<RateLimitCheck> {
  const now = Date.now();
  const windowMs = 60_000;
  const cutoff = now - windowMs;
  const entries = requestLog.get(agentId) ?? [];
  const active = entries.filter((e) => e.timestamp > cutoff);

  if (active.length >= maxPerMinute) {
    const oldestInWindow = active[0];
    const resetAtMs = oldestInWindow ? oldestInWindow.timestamp + windowMs : now;
    return { allowed: false, remaining: 0, resetAtMs, retryAfterMs: resetAtMs - now };
  }

  active.push({ timestamp: now });
  requestLog.set(agentId, active);
  return { allowed: true, remaining: maxPerMinute - active.length, resetAtMs: now + windowMs };
}

export function getRequestCount(agentId: string): number {
  const cutoff = Date.now() - 60_000;
  const entries = requestLog.get(agentId) ?? [];
  return entries.filter((e) => e.timestamp > cutoff).length;
}

export function clearRateLimits(): void {
  requestLog.clear();
}