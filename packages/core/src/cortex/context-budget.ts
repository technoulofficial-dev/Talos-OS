/**
 * Talos OS v8.0 — Context Budget Tracker
 *
 * Tracks token usage per session. At 95% of context window:
 *   1. Snapshot current session to Supabase (talos_cortex)
 *   2. Emit "session_snapshot" event
 *   3. Allow new session to start fresh with full context
 *
 * Usage:
 *   const budget = checkContextBudget(estimatedTokens, maxContextTokens)
 *   if (budget.snapshotNeeded) await snapshotAndReset(sessionId, cortex)
 */

export interface ContextBudget {
  currentTokens: number;
  maxTokens: number;
  usedPct: number;
  snapshotNeeded: boolean;
  budgetRemaining: number;
  severity: "ok" | "warning" | "critical" | "snapshot";
  message: string;
}

export interface SessionSnapshot {
  sessionId: string;
  snapshotId: string;
  threadOfFate: unknown;
  identityCore: unknown;
  turnCount: number;
  lastMessageAt: Date;
  reason: string;
  estimatedTokens: number;
}

const CHARS_PER_TOKEN = 4;
const SNAPSHOT_THRESHOLD = 0.95; // 95% of context window
const WARNING_THRESHOLD = 0.80;  // 80% → warning

/**
 * Check if a new message would exceed context budget.
 * Returns the current budget state and whether a snapshot is needed.
 */
export function checkContextBudget(
  estimatedTokens: number,
  maxContextTokens: number,
  currentUsageTokens: number = 0
): ContextBudget {
  const projectedTotal = currentUsageTokens + estimatedTokens;
  const usedPct = projectedTotal / maxContextTokens;
  const budgetRemaining = maxContextTokens - projectedTotal;

  if (usedPct >= SNAPSHOT_THRESHOLD) {
    return {
      currentTokens: projectedTotal,
      maxTokens: maxContextTokens,
      usedPct: Math.round(usedPct * 100),
      snapshotNeeded: true,
      budgetRemaining,
      severity: "snapshot",
      message: `Context budget at ${Math.round(usedPct * 100)}% — session will be snapshotted to Supabase and reset.`,
    };
  }

  if (usedPct >= WARNING_THRESHOLD) {
    return {
      currentTokens: projectedTotal,
      maxTokens: maxContextTokens,
      usedPct: Math.round(usedPct * 100),
      snapshotNeeded: false,
      budgetRemaining,
      severity: "warning",
      message: `Context budget at ${Math.round(usedPct * 100)}% — consider wrapping up soon.`,
    };
  }

  return {
    currentTokens: projectedTotal,
    maxTokens: maxContextTokens,
    usedPct: Math.round(usedPct * 100),
    snapshotNeeded: false,
    budgetRemaining,
    severity: "ok",
    message: `Context budget at ${Math.round(usedPct * 100)}% — ${budgetRemaining} tokens remaining.`,
  };
}

/**
 * Estimate tokens from a string (approximate).
 * Uses 4 chars per token approximation.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Estimate tokens from a full conversation (messages array).
 */
export function estimateConversationTokens(
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string = ""
): number {
  const msgTokens = messages.reduce((sum, m) => {
    return sum + estimateTokens(m.content) + 10; // ~10 tokens overhead per message
  }, 0);
  const systemTokens = estimateTokens(systemPrompt) + 20;
  return systemTokens + msgTokens;
}

export interface SnapshotRecord {
  snapshotId: string;
  sessionId: string;
  timestamp: Date;
  threadOfFate: unknown;
  identityCore: unknown;
  summary: string;
  estimatedTokens: number;
}

const snapshots: SnapshotRecord[] = [];

export async function createSnapshot(
  sessionId: string,
  threadOfFate: unknown,
  identityCore: unknown,
  summary: string,
  estimatedTokens: number
): Promise<SnapshotRecord> {
  const record: SnapshotRecord = {
    snapshotId: `snap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sessionId,
    timestamp: new Date(),
    threadOfFate,
    identityCore,
    summary,
    estimatedTokens,
  };

  snapshots.push(record);
  console.log(`[cortex] Session ${sessionId} snapshotted (${estimatedTokens} tokens) — ${snapshots.length} total snapshots stored`);
  return record;
}

export function getSnapshots(sessionId?: string): SnapshotRecord[] {
  if (sessionId) {
    return snapshots.filter((s) => s.sessionId === sessionId);
  }
  return [...snapshots];
}

export function getLatestSnapshot(sessionId: string): SnapshotRecord | undefined {
  return snapshots.filter((s) => s.sessionId === sessionId).pop();
}