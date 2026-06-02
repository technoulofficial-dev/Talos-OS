import {
  type SpendRecord,
  type SpendLedgerSummary,
  SpendRecordSchema,
} from "../types/budget.js";
import { getCurrentMonthPeriod, getCurrentHourPeriod } from "./state.js";

/**
 * SYS-BUDGET B2: SpendLedger
 * DB-backed ledger that tracks every cloud API call cost.
 * In-memory store for Phase 1; swaps to Supabase for Phase 2+.
 */

/** In-memory ledger (Phase 1). Replace with Supabase client for Phase 2+. */
const records: SpendRecord[] = [];

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
    id: (() => {
      const s = () => Math.random().toString(36).slice(2, 10);
      return `${s()}-${s()}-${s()}`;
    })(),
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