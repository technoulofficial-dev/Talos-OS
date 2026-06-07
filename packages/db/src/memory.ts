/**
 * Memory - manages User Cortex and Nornir episodic markers in Supabase.
 * The Cortex holds identity, thread of fate, and retrieved context.
 */

import { getSupabaseClient } from "./client.js";

export interface IdentityCore {
  userId?: string;
  longTermGoals: string[];
  personality: Record<string, unknown>;
  decisionHeuristics: string[];
  preferences: Record<string, unknown>;
  updatedAt?: string;
}

export interface ThreadOfFate {
  verbatim: Array<{
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: string;
  }>;
  midRange: string[];
  distant: string[];
}

export interface CortexRecord {
  userId: string;
  identityCore: IdentityCore;
  threadOfFate: ThreadOfFate;
  threadDigest: string;
  updatedAt?: string;
}

export interface NornirMarkerRecord {
  id?: string;
  userId: string;
  timestamp: string;
  eventType: string;
  summary: string;
  entities: string[];
  importanceScore: number;
  embedding?: number[];
}

const DEFAULT_THREAD: ThreadOfFate = {
  verbatim: [],
  midRange: [],
  distant: [],
};

const DEFAULT_IDENTITY: IdentityCore = {
  longTermGoals: [],
  personality: {},
  decisionHeuristics: [],
  preferences: {},
};

/**
 * Get or create the Cortex for a user.
 */
export async function getOrCreateCortex(userId: string): Promise<CortexRecord> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from("talos_cortex")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new Error(`Failed to get cortex: ${error.message}`);
  }

  if (data) {
    return mapCortexFromDb(data);
  }

  // Create new cortex
  const newCortex: CortexRecord = {
    userId,
    identityCore: { ...DEFAULT_IDENTITY },
    threadOfFate: { ...DEFAULT_THREAD },
    threadDigest: "",
  };

  const { data: created, error: createError } = await client
    .from("talos_cortex")
    .insert({
      user_id: userId,
      identity_core: newCortex.identityCore,
      thread_of_fate: newCortex.threadOfFate,
      thread_digest: newCortex.threadDigest,
    })
    .select()
    .single();

  if (createError) throw new Error(`Failed to create cortex: ${createError.message}`);

  return mapCortexFromDb(created);
}

/**
 * Update the entire Cortex for a user.
 */
export async function updateCortex(cortex: CortexRecord): Promise<CortexRecord> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from("talos_cortex")
    .upsert(
      {
        user_id: cortex.userId,
        identity_core: cortex.identityCore,
        thread_of_fate: cortex.threadOfFate,
        thread_digest: cortex.threadDigest,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    .select()
    .single();

  if (error) throw new Error(`Failed to update cortex: ${error.message}`);

  return mapCortexFromDb(data);
}

/**
 * Append a message to the Thread of Fate (verbatim).
 * Automatically performs progressive compression if the verbatim list grows too long.
 */
export async function appendToThread(
  userId: string,
  message: { role: "user" | "assistant" | "system"; content: string; timestamp: string }
): Promise<CortexRecord> {
  const cortex = await getOrCreateCortex(userId);

  cortex.threadOfFate.verbatim.push(message);

  // Progressive compression: if verbatim > 50, compress oldest 20 into one summary
  if (cortex.threadOfFate.verbatim.length > 50) {
    const toCompress = cortex.threadOfFate.verbatim.splice(0, 20);
    const summary = `[Block of ${toCompress.length} messages from ${toCompress[0]?.timestamp} to ${toCompress[toCompress.length - 1]?.timestamp}]`;
    cortex.threadOfFate.midRange.push(summary);
  }

  return updateCortex(cortex);
}

/**
 * Update the Identity Core.
 */
export async function updateIdentityCore(
  userId: string,
  updates: Partial<IdentityCore>
): Promise<CortexRecord> {
  const cortex = await getOrCreateCortex(userId);

  cortex.identityCore = {
    ...cortex.identityCore,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  return updateCortex(cortex);
}

/**
 * Add a Nornir episodic marker.
 */
export async function addNornirMarker(marker: NornirMarkerRecord): Promise<NornirMarkerRecord> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from("talos_nornir_markers")
    .insert({
      user_id: marker.userId,
      timestamp: marker.timestamp,
      event_type: marker.eventType,
      summary: marker.summary,
      entities: marker.entities,
      importance_score: marker.importanceScore,
      embedding: marker.embedding,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to add nornir marker: ${error.message}`);

  return mapMarkerFromDb(data);
}

/**
 * Get recent Nornir markers for a user.
 */
export async function getNornirMarkers(
  userId: string,
  limit: number = 50
): Promise<NornirMarkerRecord[]> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from("talos_nornir_markers")
    .select("*")
    .eq("user_id", userId)
    .order("timestamp", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to get nornir markers: ${error.message}`);

  return (data ?? []).map(mapMarkerFromDb);
}

function mapCortexFromDb(row: Record<string, unknown>): CortexRecord {
  return {
    userId: row.user_id as string,
    identityCore: (row.identity_core as IdentityCore) ?? { ...DEFAULT_IDENTITY },
    threadOfFate: (row.thread_of_fate as ThreadOfFate) ?? { ...DEFAULT_THREAD },
    threadDigest: (row.thread_digest as string) ?? "",
    updatedAt: row.updated_at as string | undefined,
  };
}

function mapMarkerFromDb(row: Record<string, unknown>): NornirMarkerRecord {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    timestamp: row.timestamp as string,
    eventType: row.event_type as string,
    summary: row.summary as string,
    entities: (row.entities as string[]) ?? [],
    importanceScore: (row.importance_score as number) ?? 0.5,
    embedding: row.embedding as number[] | undefined,
  };
}