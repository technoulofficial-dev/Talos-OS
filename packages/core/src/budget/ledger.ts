import { randomUUID } from "crypto";
import {
  type SpendRecord,
  type SpendLedgerSummary,
  SpendRecordSchema,
} from "../types/budget.js";
import { getCurrentMonthPeriod, getCurrentHourPeriod } from "./state.js";

/**
 * SYS-BUDGET B2: SpendLedger
 * Dual-mode ledger that tracks every cloud API call cost:
 * - In-memory array (default, TALOS_SPEND_DB_ENABLED unset or "false")
 * - Supabase via @talos/db (when TALOS_SPEND_DB_ENABLED=true)
 *
 * The dual-mode strategy keeps existing budget tests passing unchanged
 * while letting production deploy with real database persistence.
 */

function dbEnabled(): boolean {
  return process.env["TALOS_SPEND_DB_ENABLED"] === "true";
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

const records: SpendRecord[] = [];

// ---------------------------------------------------------------------------
// Public API — dual-mode
// ---------------------------------------------------------------------------

export async function recordSpend(params: {
  agentId: string;
  providerId: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  taskId?: string;
  timestamp: Date;
}): Promise<SpendRecord> {
  const periodId = getCurrentMonthPeriod();
  const record = SpendRecordSchema.parse({
    id: randomUUID(),
    agentId: params.agentId,
    providerId: params.providerId,
    tokensIn: params.tokensIn,
    tokensOut: params.tokensOut,
    totalTokens: params.tokensIn + params.tokensOut,
    costUsd: params.costUsd,
    taskId: params.taskId,
    timestamp: params.timestamp,
    periodId,
  });

  if (dbEnabled()) {
    try {
      const db = await loadDb();
      await db.recordSpend({
        agentId: record.agentId,
        providerId: record.providerId,
        tokensIn: record.tokensIn,
        tokensOut: record.tokensOut,
        totalTokens: record.totalTokens,
        costUsd: record.costUsd,
        taskId: record.taskId,
        periodId: record.periodId,
      });
    } catch {
      // DB write failed; continue with in-memory
    }
  }

  records.push(record);
  return record;
}

/** Get all records for the current month */
export async function getMonthlyRecords(): Promise<SpendRecord[]> {
  const period = getCurrentMonthPeriod();
  return records.filter((r) => r.periodId === period);
}

/** Get all records for the current hour */
export async function getHourlyRecords(): Promise<SpendRecord[]> {
  const hourPrefix = getCurrentHourPeriod();
  return records.filter((r) => {
    const ts = r.timestamp.toISOString();
    return ts.startsWith(hourPrefix);
  });
}

/** Get records from the last N minutes */
export async function getRecentMinutesRecords(minutes: number): Promise<SpendRecord[]> {
  const cutoff = new Date(Date.now() - minutes * 60 * 1000);
  return records.filter((r) => r.timestamp >= cutoff);
}

/** Build a full SpendLedgerSummary */
export async function getLedgerSummary(): Promise<SpendLedgerSummary> {
  const monthlyRecords = await getMonthlyRecords();
  const hourlyRecords = await getHourlyRecords();
  const minuteRecords = await getRecentMinutesRecords(1);

  return {
    currentPeriod: getCurrentMonthPeriod(),
    monthlyUsd: monthlyRecords.reduce((sum, r) => sum + r.costUsd, 0),
    hourlyUsd: hourlyRecords.reduce((sum, r) => sum + r.costUsd, 0),
    monthlyTokens: monthlyRecords.reduce((sum, r) => sum + r.totalTokens, 0),
    minuteRequests: minuteRecords.length,
    lastRequestAt: monthlyRecords.length > 0
      ? monthlyRecords[monthlyRecords.length - 1]!.timestamp
      : undefined,
    records: monthlyRecords,
  };
}

/** Clear all records (for testing) */
export function clearLedger(): void {
  records.length = 0;
}

/** Get raw records count (for testing) */
export function getRecordCount(): number {
  return records.length;
}
