/**
 * Spend Ledger - tracks AI API spending per agent and period in Supabase.
 * Mirrors the talos_spend_ledger table (blueprint §5 budget tracking).
 */

import { z } from "zod";
import { getSupabaseClient, type SupabaseClient } from "./client.js";

export const SpendRecordSchema = z.object({
  id: z.string().uuid().optional(),
  agentId: z.string().min(1),
  providerId: z.string().min(1),
  taskId: z.string().uuid().optional(),
  tokensIn: z.number().int().min(0).default(0),
  tokensOut: z.number().int().min(0).default(0),
  totalTokens: z.number().int().min(0).default(0),
  costUsd: z.number().min(0).default(0),
  periodId: z.string().min(1),
  createdAt: z.string().optional(),
});
export type SpendRecord = z.infer<typeof SpendRecordSchema>;

export const RecordSpendInputSchema = SpendRecordSchema.omit({
  id: true,
  createdAt: true,
}).partial({
  taskId: true,
  tokensIn: true,
  tokensOut: true,
  totalTokens: true,
  costUsd: true,
});
export type RecordSpendInput = z.input<typeof RecordSpendInputSchema>;

export interface SpendLedgerClient {
  from: (table: string) => {
    select: (cols?: string) => {
      eq: (col: string, val: unknown) => {
        eq: (col: string, val: unknown) => {
          order: (col: string, opts?: { ascending?: boolean }) => {
            limit: (n: number) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
          };
        };
        single: () => Promise<{ data: unknown; error: { message: string } | null }>;
        order: (col: string, opts?: { ascending?: boolean }) => {
          limit: (n: number) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
        };
      };
      order: (col: string, opts?: { ascending?: boolean }) => {
        limit: (n: number) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
      };
    };
    insert: (rows: unknown) => {
      select: () => {
        single: () => Promise<{ data: unknown; error: { message: string } | null }>;
      };
    };
  };
}

const SPEND_COLS =
  "id, agent_id, provider_id, task_id, tokens_in, tokens_out, total_tokens, cost_usd, period_id, created_at";

function mapSpendFromDb(row: Record<string, unknown>): SpendRecord {
  return {
    id: row["id"] as string,
    agentId: row["agent_id"] as string,
    providerId: row["provider_id"] as string,
    taskId: row["task_id"] as string | undefined,
    tokensIn: (row["tokens_in"] as number) ?? 0,
    tokensOut: (row["tokens_out"] as number) ?? 0,
    totalTokens: (row["total_tokens"] as number) ?? 0,
    costUsd: (row["cost_usd"] as number) ?? 0,
    periodId: row["period_id"] as string,
    createdAt: row["created_at"] as string | undefined,
  };
}

function resolveClient(client?: SupabaseClient | SpendLedgerClient): SpendLedgerClient {
  return (client ?? getSupabaseClient()) as unknown as SpendLedgerClient;
}

export async function recordSpend(
  input: RecordSpendInput,
  client?: SupabaseClient | SpendLedgerClient
): Promise<SpendRecord> {
  const parsed = RecordSpendInputSchema.parse(input);
  const c = resolveClient(client);
  const { data, error } = await c
    .from("talos_spend_ledger")
    .insert({
      agent_id: parsed.agentId,
      provider_id: parsed.providerId,
      task_id: parsed.taskId,
      tokens_in: parsed.tokensIn,
      tokens_out: parsed.tokensOut,
      total_tokens: parsed.totalTokens,
      cost_usd: parsed.costUsd,
      period_id: parsed.periodId,
    })
    .select()
    .single();
  if (error) throw new Error(`Failed to record spend: ${error.message}`);
  return mapSpendFromDb(data as Record<string, unknown>);
}

export async function getAgentSpend(
  agentId: string,
  periodId: string,
  client?: SupabaseClient | SpendLedgerClient
): Promise<SpendRecord[]> {
  const c = resolveClient(client);
  const { data, error } = await c
    .from("talos_spend_ledger")
    .select(SPEND_COLS)
    .eq("agent_id", agentId)
    .eq("period_id", periodId)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error(`Failed to get agent spend: ${error.message}`);
  return (data ?? []).map((r) => mapSpendFromDb(r as Record<string, unknown>));
}

export async function getPeriodTotal(
  periodId: string,
  client?: SupabaseClient | SpendLedgerClient
): Promise<{ totalTokens: number; totalCostUsd: number; recordCount: number }> {
  const c = resolveClient(client);
  const records = await getAgentSpend("*", periodId, client);
  const filtered = periodId === "*" ? records : records;
  let totalTokens = 0;
  let totalCostUsd = 0;
  for (const r of filtered) {
    totalTokens += r.totalTokens;
    totalCostUsd += r.costUsd;
  }
  return { totalTokens, totalCostUsd, recordCount: filtered.length };
}

export async function listRecentSpend(
  options: { limit?: number; agentId?: string } = {},
  client?: SupabaseClient | SpendLedgerClient
): Promise<SpendRecord[]> {
  const c = resolveClient(client);
  const limit = options.limit ?? 100;
  let query = c.from("talos_spend_ledger").select(SPEND_COLS);
  if (options.agentId) {
    const { data, error } = await query
      .eq("agent_id", options.agentId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(`Failed to list spend: ${error.message}`);
    return (data ?? []).map((r) => mapSpendFromDb(r as Record<string, unknown>));
  }
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Failed to list spend: ${error.message}`);
  return (data ?? []).map((r) => mapSpendFromDb(r as Record<string, unknown>));
}
