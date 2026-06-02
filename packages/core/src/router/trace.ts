/**
 * SYS-ROUTER R6: ExecutionTrace
 * Audit log for every routing decision.
 * Phase 1: in-memory. Phase 2+: talos_audit_trail table.
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

const traces: TraceEntry[] = [];

export async function recordTrace(entry: Omit<TraceEntry, "timestamp">): Promise<void> {
  traces.push({ ...entry, timestamp: new Date() });
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