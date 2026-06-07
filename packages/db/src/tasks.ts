/**
 * Task Queue - manages task lifecycle in Supabase.
 * Handles task creation, assignment, retry, and completion.
 */

import { getSupabaseClient } from "./client.js";

export type TaskStatus = "pending" | "queued" | "processing" | "done" | "failed" | "cancelled";
export type TaskPriority = "low" | "normal" | "high" | "critical";

export interface TaskRecord {
  id?: string;
  description: string;
  originAgent: string;
  status: TaskStatus;
  priority: TaskPriority;
  requiredSkills: string[];
  maxTokens: number;
  maxCostUsd: number;
  assignedAgent?: string;
  auctionId?: string;
  planGraph?: Record<string, unknown>;
  output?: string;
  error?: string;
  errorCode?: string;
  tokensUsed: number;
  costUsd: number;
  durationMs: number;
  retryCount: number;
  maxRetries: number;
  idempotencyKey?: string;
  preferLocal: boolean;
  dependsOn: string[];
  context: Record<string, unknown>;
  deadline?: string;
}

export interface TaskCreateInput {
  description: string;
  originAgent?: string;
  priority?: TaskPriority;
  requiredSkills?: string[];
  maxTokens?: number;
  maxCostUsd?: number;
  preferLocal?: boolean;
  dependsOn?: string[];
  context?: Record<string, unknown>;
  deadline?: Date;
  idempotencyKey?: string;
}

/**
 * Create a new task in the queue.
 */
export async function createTask(input: TaskCreateInput): Promise<TaskRecord> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from("talos_tasks")
    .insert({
      description: input.description,
      origin_agent: input.originAgent ?? "system",
      status: "queued" as TaskStatus,
      priority: input.priority ?? "normal",
      required_skills: input.requiredSkills ?? [],
      max_tokens: input.maxTokens ?? 100_000,
      max_cost_usd: input.maxCostUsd ?? 10,
      prefer_local: input.preferLocal ?? true,
      depends_on: input.dependsOn ?? [],
      context: input.context ?? {},
      deadline: input.deadline?.toISOString(),
      idempotency_key: input.idempotencyKey,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create task: ${error.message}`);

  return mapTaskFromDb(data);
}

/**
 * Get a task by ID.
 */
export async function getTask(taskId: string): Promise<TaskRecord | null> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from("talos_tasks")
    .select("*")
    .eq("id", taskId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to get task: ${error.message}`);
  }

  return mapTaskFromDb(data);
}

/**
 * List tasks by status, ordered by priority and creation time.
 */
export async function listTasks(
  status?: TaskStatus,
  options: { limit?: number; offset?: number } = {}
): Promise<TaskRecord[]> {
  const client = getSupabaseClient();

  let query = client
    .from("talos_tasks")
    .select("*")
    .order("created_at", { ascending: true });

  if (status) {
    query = query.eq("status", status);
  }

  if (options.limit) {
    const offset = options.offset ?? 0;
    query = query.range(offset, offset + options.limit - 1);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list tasks: ${error.message}`);

  return (data ?? []).map(mapTaskFromDb);
}

/**
 * Claim a task for processing (atomic update).
 */
export async function claimTask(taskId: string, agentId: string): Promise<TaskRecord | null> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from("talos_tasks")
    .update({
      status: "processing" as TaskStatus,
      assigned_agent: agentId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId)
    .eq("status", "queued")
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to claim task: ${error.message}`);
  }

  return mapTaskFromDb(data);
}

/**
 * Mark a task as completed.
 */
export async function completeTask(
  taskId: string,
  result: {
    output: string;
    tokensUsed: number;
    costUsd: number;
    durationMs: number;
  }
): Promise<void> {
  const client = getSupabaseClient();

  const { error } = await client
    .from("talos_tasks")
    .update({
      status: "done" as TaskStatus,
      output: result.output,
      tokens_used: result.tokensUsed,
      cost_usd: result.costUsd,
      duration_ms: result.durationMs,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  if (error) throw new Error(`Failed to complete task: ${error.message}`);
}

/**
 * Mark a task as failed, with retry logic.
 */
export async function failTask(
  taskId: string,
  error: { message: string; code?: string }
): Promise<{ willRetry: boolean; nextRetryAt?: Date }> {
  const client = getSupabaseClient();

  const task = await getTask(taskId);
  if (!task) throw new Error(`Task ${taskId} not found`);

  const willRetry = task.retryCount < task.maxRetries;
  const nextStatus: TaskStatus = willRetry ? "queued" : "failed";
  const nextRetryAt = willRetry ? calculateNextRetry(task.retryCount) : undefined;

  const update: Record<string, unknown> = {
    status: nextStatus,
    error: error.message,
    error_code: error.code,
    updated_at: new Date().toISOString(),
  };

  if (willRetry) {
    update.retry_count = task.retryCount + 1;
  } else {
    update.completed_at = new Date().toISOString();
  }

  const { error: dbError } = await client
    .from("talos_tasks")
    .update(update)
    .eq("id", taskId);

  if (dbError) throw new Error(`Failed to fail task: ${dbError.message}`);

  return { willRetry, nextRetryAt };
}

/**
 * Cancel a task.
 */
export async function cancelTask(taskId: string): Promise<void> {
  const client = getSupabaseClient();

  const { error } = await client
    .from("talos_tasks")
    .update({
      status: "cancelled" as TaskStatus,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId)
    .in("status", ["pending", "queued"]);

  if (error) throw new Error(`Failed to cancel task: ${error.message}`);
}

/**
 * Subscribe to task status changes (real-time).
 */
export function subscribeToTasks(
  onChange: (task: TaskRecord) => void
): { unsubscribe: () => void } {
  const client = getSupabaseClient();

  const subscription = client
    .channel("talos_tasks_changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "talos_tasks" },
      (payload: { new: Record<string, unknown> }) => {
        if (payload.new) {
          onChange(mapTaskFromDb(payload.new));
        }
      }
    )
    .subscribe();

  return {
    unsubscribe: () => {
      void client.removeChannel(subscription);
    },
  };
}

function calculateNextRetry(retryCount: number): Date {
  // Exponential backoff: 30s, 5min, 30min
  const delays = [30_000, 300_000, 1_800_000];
  const delay = delays[Math.min(retryCount, delays.length - 1)] ?? 1_800_000;
  return new Date(Date.now() + delay);
}

function mapTaskFromDb(row: Record<string, unknown>): TaskRecord {
  return {
    id: row.id as string,
    description: row.description as string,
    originAgent: row.origin_agent as string,
    status: row.status as TaskStatus,
    priority: row.priority as TaskPriority,
    requiredSkills: (row.required_skills as string[]) ?? [],
    maxTokens: (row.max_tokens as number) ?? 100_000,
    maxCostUsd: (row.max_cost_usd as number) ?? 10,
    assignedAgent: row.assigned_agent as string | undefined,
    auctionId: row.auction_id as string | undefined,
    planGraph: row.plan_graph as Record<string, unknown> | undefined,
    output: row.output as string | undefined,
    error: row.error as string | undefined,
    errorCode: row.error_code as string | undefined,
    tokensUsed: (row.tokens_used as number) ?? 0,
    costUsd: (row.cost_usd as number) ?? 0,
    durationMs: (row.duration_ms as number) ?? 0,
    retryCount: (row.retry_count as number) ?? 0,
    maxRetries: (row.max_retries as number) ?? 3,
    idempotencyKey: row.idempotency_key as string | undefined,
    preferLocal: (row.prefer_local as boolean) ?? true,
    dependsOn: (row.depends_on as string[]) ?? [],
    context: (row.context as Record<string, unknown>) ?? {},
    deadline: row.deadline as string | undefined,
  };
}