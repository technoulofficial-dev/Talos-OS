/**
 * User Cortex — The Identity Core & Thread of Fate
 *
 * The Cortex is the persistent memory of Talos OS, capped at ~12K tokens.
 * It consists of three layers:
 *   1. Identity Core (~500 tokens) — long-term goals, personality, heuristics
 *   2. Thread of Fate — rolling window with progressive compression
 *      - Recent (last 50 turns): verbatim
 *      - Mid-range (51-200 turns): compressed summaries
 *      - Distant (>200 turns): episodic markers
 *   3. Retrieved Context (on-demand) — top-3 past relevant conversations
 *
 * Implements Section 8.1 of the Talos OS Blueprint.
 */

import { getOrCreateCortex, updateCortex, appendToThread, updateIdentityCore, type CortexRecord, type IdentityCore, type ThreadOfFate } from "@talos/db/memory";

const MAX_VERBATIM_TURNS = 50;
const MAX_MIDRANGE_SUMMARIES = 8; // 8 summaries × 20 turns = 160 turns covered
const TOKEN_BUDGET = 12_000;

export interface CortexSnapshot {
  userId: string;
  identityCore: IdentityCore;
  threadOfFate: ThreadOfFate;
  threadDigest: string;
  estimatedTokens: number;
  budgetUsedPct: number;
  needsConsolidation: boolean;
}

export class Cortex {
  private userId: string;
  private record: CortexRecord | null = null;

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Load the Cortex from storage, or create a new one.
   */
  async load(): Promise<CortexRecord> {
    this.record = await getOrCreateCortex(this.userId);
    return this.record;
  }

  /**
   * Get current snapshot with token estimates.
   */
  async snapshot(): Promise<CortexSnapshot> {
    if (!this.record) await this.load();
    const record = this.record!;

    const estimatedTokens = this.estimateTokens(record);
    const budgetUsedPct = (estimatedTokens / TOKEN_BUDGET) * 100;
    const needsConsolidation =
      record.threadOfFate.verbatim.length > MAX_VERBATIM_TURNS * 0.8 ||
      budgetUsedPct > 80;

    return {
      userId: record.userId,
      identityCore: record.identityCore,
      threadOfFate: record.threadOfFate,
      threadDigest: record.threadDigest,
      estimatedTokens,
      budgetUsedPct,
      needsConsolidation,
    };
  }

  /**
   * Add a new message to the Thread of Fate.
   * Automatically triggers progressive compression when verbatim grows too large.
   */
  async addMessage(message: {
    role: "user" | "assistant" | "system";
    content: string;
    timestamp?: string;
  }): Promise<CortexSnapshot> {
    if (!this.record) await this.load();

    const msg = {
      role: message.role,
      content: message.content,
      timestamp: message.timestamp ?? new Date().toISOString(),
    };

    this.record = await appendToThread(this.userId, msg);

    // Progressive compression at 80% of verbatim limit
    if (this.record.threadOfFate.verbatim.length > MAX_VERBATIM_TURNS * 0.8) {
      await this.compressVerbatim();
    }

    return this.snapshot();
  }

  /**
   * Update the Identity Core (goals, personality, heuristics, preferences).
   */
  async updateIdentity(updates: Partial<IdentityCore>): Promise<CortexSnapshot> {
    if (!this.record) await this.load();
    this.record = await updateIdentityCore(this.userId, updates);
    return this.snapshot();
  }

  /**
   * Compress the oldest block of verbatim messages into a single mid-range summary.
   */
  async compressVerbatim(): Promise<void> {
    if (!this.record) await this.load();
    const record = this.record!;

    if (record.threadOfFate.verbatim.length <= 20) return; // Not enough to compress

    const blockSize = 20;
    const toCompress = record.threadOfFate.verbatim.splice(0, blockSize);

    // In production, this would call Nornir's Verdandi to generate a real summary.
    // For now, create a placeholder summary.
    const summary = `[Block of ${toCompress.length} turns: ${toCompress[0]?.timestamp} → ${toCompress[toCompress.length - 1]?.timestamp}]`;

    record.threadOfFate.midRange.push(summary);

    // Cap mid-range to prevent unbounded growth
    if (record.threadOfFate.midRange.length > MAX_MIDRANGE_SUMMARIES * 2) {
      // Convert oldest mid-range summaries to distant episodic markers
      const toDistill = record.threadOfFate.midRange.splice(0, MAX_MIDRANGE_SUMMARIES);
      record.threadOfFate.distant.push(
        `[${toDistill.length} summaries consolidated at ${new Date().toISOString()}]`
      );
    }

    this.record = await updateCortex(record);
  }

  /**
   * Search past context by semantic similarity (stub).
   * In production, this would use vector embeddings.
   */
  async retrieveContext(query: string, topK: number = 3): Promise<string[]> {
    if (!this.record) await this.load();
    const record = this.record!;

    // Simple keyword search across all thread layers
    const queryLower = query.toLowerCase();
    const results: Array<{ content: string; score: number }> = [];

    for (const msg of record.threadOfFate.verbatim) {
      if (msg.content.toLowerCase().includes(queryLower)) {
        results.push({ content: msg.content, score: 1.0 });
      }
    }

    for (const summary of record.threadOfFate.midRange) {
      if (summary.toLowerCase().includes(queryLower)) {
        results.push({ content: summary, score: 0.6 });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((r) => r.content);
  }

  /**
   * Force a full consolidation cycle (called by Nornir nightly).
   */
  async consolidate(): Promise<void> {
    if (!this.record) await this.load();
    const record = this.record!;

    // Compress all verbatim if over 50
    while (record.threadOfFate.verbatim.length > MAX_VERBATIM_TURNS) {
      const blockSize = 20;
      const toCompress = record.threadOfFate.verbatim.splice(0, blockSize);
      const summary = `[Block of ${toCompress.length} turns consolidated]`;
      record.threadOfFate.midRange.push(summary);
    }

    // Cap mid-range
    if (record.threadOfFate.midRange.length > MAX_MIDRANGE_SUMMARIES) {
      const excess = record.threadOfFate.midRange.splice(0, record.threadOfFate.midRange.length - MAX_MIDRANGE_SUMMARIES);
      record.threadOfFate.distant.push(`[${excess.length} summaries archived]`);
    }

    this.record = await updateCortex(record);
  }

  /**
   * Estimate token count for the current Cortex state.
   */
  private estimateTokens(record: CortexRecord): number {
    let tokens = 0;

    // Identity Core: ~500 tokens
    tokens += 500;

    // Thread of Fate
    for (const msg of record.threadOfFate.verbatim) {
      tokens += Math.ceil(msg.content.length / 4);
    }
    for (const summary of record.threadOfFate.midRange) {
      tokens += Math.ceil(summary.length / 4);
    }
    for (const marker of record.threadOfFate.distant) {
      tokens += Math.ceil(marker.length / 4);
    }

    // Thread Digest
    tokens += Math.ceil(record.threadDigest.length / 4);

    return tokens;
  }
}

export { type CortexRecord, type IdentityCore, type ThreadOfFate };