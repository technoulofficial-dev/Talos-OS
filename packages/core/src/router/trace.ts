/**
 * SYS-ROUTER R6: ExecutionTrace
 * Dual-mode audit log for every routing decision:
 * - In-memory array (default, TALOS_AUDIT_DB_ENABLED unset or "false")
 * - Supabase via @talos/db (when TALOS_AUDIT_DB_ENABLED=true)
 *
 * The dual-mode strategy keeps existing router tests passing unchanged
 * while letting production deploy with real database persistence.
 */

export interface TraceEntry {
  taskId: string;
  agentId: string;
  decision: string;
  reason?: string;
  endpoint?: string;
  model?: string;
  latencyMs: number;
  costUsd: number;
  timestamp: Date;
}

function dbEnabled(): boolean {
  return process.env["TALOS_AUDIT_DB_ENABLED"] === "true";
}

let dbModulePromise: Promise<typeof import("@talos/db")> | null = null;
async function loadDb() {
  if (!dbModulePromise) {
    dbModulePromise = import("@talos/db");
  }
  return dbModulePromise;
}

// ---------------------------------------------------------------------------
// In-memory store (default mode)
// ---------------------------------------------------------------------------

const traces: TraceEntry[] = [];

// ---------------------------------------------------------------------------
// Public API — dual-mode
// ---------------------------------------------------------------------------

export async function recordTrace(entry: Omit<TraceEntry, "timestamp">): Promise<void> {
  const full: TraceEntry = { ...entry, timestamp: new Date() };

  if (dbEnabled()) {
    try {
      const db = await loadDb();
      await db.logEvent({
        eventType: "routing_decision",
        agentId: full.agentId,
        taskId: full.taskId || undefined,
        detail: {
          decision: full.decision,
          reason: full.reason,
          endpoint: full.endpoint,
          model: full.model,
          latencyMs: full.latencyMs,
          costUsd: full.costUsd,
        },
      });
    } catch {
      // DB write failed; continue with in-memory
    }
  }

  traces.push(full);
}

export function getRecentTraces(limit: number = 100): TraceEntry[] {
  return traces.slice(-limit);
}

export function getTracesForAgent(agentId: string): TraceEntry[] {
  return traces.filter((t) => t.agentId === agentId);
}

export function clearTraces(): void {
  traces.length = 0;
}
