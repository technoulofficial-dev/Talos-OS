/**
 * Audit Trail - logs system events to Supabase.
 * Mirrors the talos_audit_trail table. Every significant action
 * (task assignment, agent status change, budget spend, etc.) is logged here.
 */

import { z } from "zod";
import { getSupabaseClient, type SupabaseClient } from "./client.js";

export const AuditEventSchema = z.object({
  id: z.string().uuid().optional(),
  eventType: z.string().min(1),
  agentId: z.string().optional(),
  taskId: z.string().uuid().optional(),
  detail: z.record(z.unknown()).default({}),
  createdAt: z.string().optional(),
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;

export const LogEventInputSchema = AuditEventSchema.omit({
  id: true,
  createdAt: true,
}).partial({
  agentId: true,
  taskId: true,
});
export type LogEventInput = z.input<typeof LogEventInputSchema>;

export interface AuditTrailClient {
  from: (table: string) => {
    select: (cols?: string) => {
      eq: (col: string, val: unknown) => {
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

const AUDIT_COLS =
  "id, event_type, agent_id, task_id, detail, created_at";

function mapAuditFromDb(row: Record<string, unknown>): AuditEvent {
  return {
    id: row["id"] as string,
    eventType: row["event_type"] as string,
    agentId: row["agent_id"] as string | undefined,
    taskId: row["task_id"] as string | undefined,
    detail: (row["detail"] as Record<string, unknown>) ?? {},
    createdAt: row["created_at"] as string | undefined,
  };
}

function resolveClient(client?: SupabaseClient | AuditTrailClient): AuditTrailClient {
  return (client ?? getSupabaseClient()) as unknown as AuditTrailClient;
}

export async function logEvent(
  input: LogEventInput,
  client?: SupabaseClient | AuditTrailClient
): Promise<AuditEvent> {
  const parsed = LogEventInputSchema.parse(input);
  const c = resolveClient(client);
  const { data, error } = await c
    .from("talos_audit_trail")
    .insert({
      event_type: parsed.eventType,
      agent_id: parsed.agentId,
      task_id: parsed.taskId,
      detail: parsed.detail,
    })
    .select()
    .single();
  if (error) throw new Error(`Failed to log event: ${error.message}`);
  return mapAuditFromDb(data as Record<string, unknown>);
}

export async function getEventsByAgent(
  agentId: string,
  options: { limit?: number } = {},
  client?: SupabaseClient | AuditTrailClient
): Promise<AuditEvent[]> {
  const c = resolveClient(client);
  const limit = options.limit ?? 100;
  const { data, error } = await c
    .from("talos_audit_trail")
    .select(AUDIT_COLS)
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Failed to get events: ${error.message}`);
  return (data ?? []).map((r) => mapAuditFromDb(r as Record<string, unknown>));
}

export async function getEventsByType(
  eventType: string,
  options: { limit?: number } = {},
  client?: SupabaseClient | AuditTrailClient
): Promise<AuditEvent[]> {
  const c = resolveClient(client);
  const limit = options.limit ?? 100;
  const { data, error } = await c
    .from("talos_audit_trail")
    .select(AUDIT_COLS)
    .eq("event_type", eventType)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Failed to get events: ${error.message}`);
  return (data ?? []).map((r) => mapAuditFromDb(r as Record<string, unknown>));
}

export async function listRecentEvents(
  options: { limit?: number } = {},
  client?: SupabaseClient | AuditTrailClient
): Promise<AuditEvent[]> {
  const c = resolveClient(client);
  const limit = options.limit ?? 100;
  const { data, error } = await c
    .from("talos_audit_trail")
    .select(AUDIT_COLS)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Failed to list events: ${error.message}`);
  return (data ?? []).map((r) => mapAuditFromDb(r as Record<string, unknown>));
}
