/**
 * Talos OS v8.0 — Hermes Task Queue
 * In-memory task queue for Phase 1.
 * Phase 2+: swap to pg-boss backed by Supabase PostgreSQL.
 */

import { randomUUID } from "node:crypto";
import type { TaskResult, TaskStatus } from "../types/task.js";

export interface QueuedTask {
  id: string;
  description: string;
  originAgent: string;
  status: TaskStatus;
  priority: "low" | "normal" | "high" | "critical";
  requiredSkills: string[];
  maxTokens: number;
  maxCostUsd: number;
  preferLocal: boolean;
  dependsOn: string[];
  context: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  output?: string;
  error?: string;
  errorCode?: string;
  tokensUsed: number;
  costUsd: number;
  durationMs: number;
  retryCount: number;
  maxRetries: number;
  idempotencyKey?: string;
}

const tasks: Map<string, QueuedTask> = new Map();

export interface SubmitTaskRequest {
  description: string;
  originAgent?: string;
  priority?: "low" | "normal" | "high" | "critical";
  requiredSkills?: string[];
  maxTokens?: number;
  maxCostUsd?: number;
  preferLocal?: boolean;
  dependsOn?: string[];
  context?: Record<string, unknown>;
  idempotencyKey?: string;
  modelHints?: string[];
  systemPrompt?: string;
  prompt?: string;
}

export async function submitTask(request: SubmitTaskRequest): Promise<string> {
  const id = request.idempotencyKey
    ? `idem-${request.idempotencyKey}`
    : randomUUID();

  const existing = Array.from(tasks.values()).find(
    (t) => t.idempotencyKey === request.idempotencyKey && t.status !== "completed" && t.status !== "failed"
  );
  if (existing) {
    return existing.id;
  }

  const task: QueuedTask = {
    id,
    description: request.description,
    originAgent: request.originAgent ?? "system",
    status: "queued",
    priority: request.priority ?? "normal",
    requiredSkills: request.requiredSkills ?? [],
    maxTokens: request.maxTokens ?? 100_000,
    maxCostUsd: request.maxCostUsd ?? 10,
    preferLocal: request.preferLocal ?? true,
    dependsOn: request.dependsOn ?? [],
    context: request.context ?? {},
    createdAt: new Date(),
    updatedAt: new Date(),
    tokensUsed: 0,
    costUsd: 0,
    durationMs: 0,
    retryCount: 0,
    maxRetries: 3,
    idempotencyKey: request.idempotencyKey,
  };

  tasks.set(id, task);
  return id;
}

export async function getTask(taskId: string): Promise<TaskResult | null> {
  const task = tasks.get(taskId);
  if (!task) return null;
  return buildTaskResult(task);
}

export async function listTasks(filter?: { status?: TaskStatus }): Promise<TaskResult[]> {
  let all = Array.from(tasks.values());
  if (filter?.status) {
    all = all.filter((t) => t.status === filter.status);
  }
  return all.map(buildTaskResult);
}

export type TaskStatusUpdate = Partial<Pick<QueuedTask, "status" | "output" | "error" | "errorCode" | "tokensUsed" | "costUsd" | "durationMs" | "completedAt" | "retryCount">>;

export async function updateTaskStatus(taskId: string, updates: TaskStatusUpdate): Promise<void> {
  const task = tasks.get(taskId);
  if (!task) return;
  Object.assign(task, updates, { updatedAt: new Date() });
}

export async function getQueuedTasks(): Promise<QueuedTask[]> {
  return Array.from(tasks.values()).filter((t) => t.status === "queued");
}

export async function getTaskById(taskId: string): Promise<QueuedTask | undefined> {
  return tasks.get(taskId);
}

function buildTaskResult(task: QueuedTask): TaskResult {
  return {
    taskId: task.id,
    status: task.status,
    assignedAgent: undefined,
    output: task.output,
    error: task.error,
    errorCode: task.errorCode,
    tokensUsed: task.tokensUsed,
    costUsd: task.costUsd,
    durationMs: task.durationMs,
    completedAt: task.completedAt,
  };
}

export async function clearTaskQueue(): Promise<void> {
  tasks.clear();
}