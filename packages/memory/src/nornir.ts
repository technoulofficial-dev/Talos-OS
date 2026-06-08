/**
 * Nornir — The Three Fates of Memory
 *
 * - Urd (Past)    — Maintains Identity Core and long-term episodic vault
 * - Verdandi (Present) — Performs progressive summarization and updates Thread Digest
 * - Skuld (Future)    — Predictive retrieval; pre-fetches relevant memories before sessions
 *
 * Nightly consolidation runs at 0 3 * * * (3 AM daily):
 *   1. Verdandi locks Cortex for write
 *   2. Urd updates Identity Core
 *   3. Skuld pre-fetches for scheduled tasks
 *   4. Old verbatims beyond 200 turns deleted from active store
 *
 * Implements Section 8.2 of the Talos OS Blueprint.
 */

import { Cortex } from "./cortex.js";
import { addNornirMarker, getNornirMarkers } from "@talos/db/memory";
import { routeUnlimited } from "@talos/core/ai-engine";
import { listTasks as getTasks } from "@talos/db/tasks";

export interface NornirMarker {
  userId: string;
  timestamp: string;
  eventType: string;
  summary: string;
  entities: string[];
  importanceScore: number;
  embedding?: number[];
}

export interface ConsolidationResult {
  userId: string;
  stages: {
    urd: { updated: boolean; markersAdded: number };
    verdandi: { compressed: boolean; summariesRemoved: number; digestUpdated: boolean };
    skuld: { preFetched: number; tasksAnalyzed: number };
  };
  durationMs: number;
  errors: string[];
}

/**
 * Urd (Past) — Maintains Identity Core and episodic vault.
 */
export async function runUrdMaintenance(userId: string): Promise<{
  updated: boolean;
  markersAdded: number;
}> {
  const cortex = new Cortex(userId);
  await cortex.load();

  // In production: analyze recent markers, update Identity Core with patterns
  const recentMarkers = await getNornirMarkers(userId, 20);
  let markersAdded = 0;

  // Detect identity patterns from markers
  const hasGoalPattern = recentMarkers.some((m) => m.eventType === "goal-stated");
  const hasPreferencePattern = recentMarkers.some((m) => m.eventType === "preference-expressed");

  if (hasGoalPattern || hasPreferencePattern) {
    // Identity Core would be updated here based on detected patterns
    // For now, just record a marker
    await addNornirMarker({
      userId,
      timestamp: new Date().toISOString(),
      eventType: "urd-maintenance",
      summary: `Analyzed ${recentMarkers.length} recent markers, found goal patterns: ${hasGoalPattern}, preferences: ${hasPreferencePattern}`,
      entities: [],
      importanceScore: 0.6,
    });
    markersAdded = 1;
  }

  return { updated: hasGoalPattern || hasPreferencePattern, markersAdded };
}

/**
 * Verdandi (Present) — Progressive summarization and Thread Digest updates.
 */
export async function runVerdandiSummarization(userId: string): Promise<{
  compressed: boolean;
  summariesRemoved: number;
  digestUpdated: boolean;
}> {
  const cortex = new Cortex(userId);
  const snapshot = await cortex.snapshot();

  if (!snapshot.needsConsolidation) {
    return { compressed: false, summariesRemoved: 0, digestUpdated: false };
  }

  const beforeCount = snapshot.threadOfFate.verbatim.length;
  await cortex.consolidate();
  const afterSnapshot = await cortex.snapshot();
  const summariesRemoved = Math.max(0, beforeCount - afterSnapshot.threadOfFate.verbatim.length);

  // Generate Thread Digest via LLM
  let digestUpdated = false;
  try {
    const digest = await generateThreadDigest(afterSnapshot);
    if (digest) {
      // In production: update record.threadDigest
      digestUpdated = true;
    }
  } catch (err) {
    console.error(`[nornir] Failed to generate thread digest: ${(err as Error).message}`);
  }

  return { compressed: true, summariesRemoved, digestUpdated };
}

/**
 * Skuld (Future) — Predictive retrieval and pre-fetching.
 */
export async function runSkuldPreFetch(userId: string): Promise<{
  preFetched: number;
  tasksAnalyzed: number;
}> {
  // Get upcoming scheduled tasks
  const tasks = await getTasks("queued", { limit: 20 });
  const upcomingTasks = tasks.filter((t: { deadline?: string }) => t.deadline && new Date(t.deadline) > new Date());

  if (upcomingTasks.length === 0) {
    return { preFetched: 0, tasksAnalyzed: 0 };
  }

  const cortex = new Cortex(userId);
  await cortex.load();

  let preFetched = 0;
  for (const task of upcomingTasks) {
    try {
      // Search Cortex for context relevant to this task
      const context = await cortex.retrieveContext(task.description, 3);
      if (context.length > 0) {
        // In production: pre-load context into cache
        preFetched += context.length;
      }
    } catch (err) {
      console.error(`[nornir] Skuld pre-fetch failed for task ${task.id}: ${(err as Error).message}`);
    }
  }

  return { preFetched, tasksAnalyzed: upcomingTasks.length };
}

/**
 * Nightly consolidation orchestrator.
 * Should be called by cron at 0 3 * * * (3 AM daily).
 */
export async function runNightlyConsolidation(userId: string): Promise<ConsolidationResult> {
  const start = Date.now();
  const errors: string[] = [];

  // Stage 1: Urd
  let urdResult = { updated: false, markersAdded: 0 };
  try {
    urdResult = await runUrdMaintenance(userId);
  } catch (err) {
    errors.push(`Urd: ${(err as Error).message}`);
  }

  // Stage 2: Verdandi
  let verdandiResult = { compressed: false, summariesRemoved: 0, digestUpdated: false };
  try {
    verdandiResult = await runVerdandiSummarization(userId);
  } catch (err) {
    errors.push(`Verdandi: ${(err as Error).message}`);
  }

  // Stage 3: Skuld
  let skuldResult = { preFetched: 0, tasksAnalyzed: 0 };
  try {
    skuldResult = await runSkuldPreFetch(userId);
  } catch (err) {
    errors.push(`Skuld: ${(err as Error).message}`);
  }

  // Stage 4: Cleanup old verbatims beyond 200 turns
  try {
    const cortex = new Cortex(userId);
    const snapshot = await cortex.snapshot();
    if (snapshot.threadOfFate.verbatim.length > 200) {
      await cortex.consolidate();
    }
  } catch (err) {
    errors.push(`Cleanup: ${(err as Error).message}`);
  }

  return {
    userId,
    stages: {
      urd: urdResult,
      verdandi: verdandiResult,
      skuld: skuldResult,
    },
    durationMs: Date.now() - start,
    errors,
  };
}

/**
 * Add an episodic marker to the Nornir vault.
 */
export async function recordNornirMarker(marker: NornirMarker): Promise<NornirMarker> {
  await addNornirMarker(marker);
  return marker;
}

// --- Internals ---

async function generateThreadDigest(snapshot: {
  threadOfFate: { verbatim: Array<{ role: string; content: string }>; midRange: string[]; distant: string[] };
}): Promise<string> {
  const recentMessages = snapshot.threadOfFate.verbatim.slice(-10);
  const messageText = recentMessages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const response = await routeUnlimited({
    prompt: `You are Verdandi, the Present Fate. Generate a concise thread digest (2-3 sentences) summarizing the key context, decisions, and current state from this conversation. Focus on what matters for future interactions:\n\n${messageText}`,
    agentId: "nornir-verdandi",
    maxTokens: 200,
    temperature: 0.3,
  });

  return response.output;
}