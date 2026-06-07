/**
 * Talos OS v8.0 — Hermes Task Executor
 * Polling execution loop that processes queued tasks.
 * Phase 1: polls in-memory queue every 2 seconds.
 * Phase 2+: pg-boss with exactly-once delivery.
 */

import { route } from "../router/router.js";
import { getQueuedTasks, updateTaskStatus, type QueuedTask } from "./task-queue.js";
import { recordSpend } from "../budget/ledger.js";
import type { TaskConfig } from "../types/provider.js";

let executorTimer: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

const EXECUTION_INTERVAL_MS = 2000;
const HARD_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const RETRY_DELAYS_MS = [30_000, 5 * 60_000, 30 * 60_000]; // 30s, 5min, 30min

export function startExecutionLoop(intervalMs: number = EXECUTION_INTERVAL_MS): void {
  if (isRunning) return;
  isRunning = true;

  executorTimer = setInterval(async () => {
    await processQueuedTasks();
  }, intervalMs);

  console.log(`[executor] Task execution loop started (poll every ${intervalMs}ms)`);
}

export function stopExecutionLoop(): void {
  if (executorTimer) {
    clearInterval(executorTimer);
    executorTimer = null;
  }
  isRunning = false;
  console.log("[executor] Task execution loop stopped");
}

async function processQueuedTasks(): Promise<void> {
  const queued = await getQueuedTasks();

  for (const task of queued) {
    if (task.status !== "queued") continue;

    const now = Date.now();
    const ageMs = now - task.createdAt.getTime();

    // Hard timeout check
    if (ageMs > HARD_TIMEOUT_MS) {
      await updateTaskStatus(task.id, {
        status: "timeout",
        error: `Task exceeded hard timeout of ${HARD_TIMEOUT_MS}ms`,
        errorCode: "TAL-003",
      });
      continue;
    }

    // Execute the task
    await executeTask(task);
  }
}

async function executeTask(task: QueuedTask): Promise<void> {
  await updateTaskStatus(task.id, { status: "executing" });

  const startTime = Date.now();

  try {
    const taskConfig: TaskConfig = {
      agentId: task.originAgent as TaskConfig["agentId"],
      maxTokens: task.maxTokens,
      temperature: 0.4,
      preferLocal: task.preferLocal,
      priority: task.priority,
      requiredSkills: task.requiredSkills,
      modelHints: [],
      requiresTools: false,
      prompt: task.description,
      messages: [],
    };

    const decision = await route(taskConfig);

    const durationMs = Date.now() - startTime;

    if (decision.type === "none") {
      const retryCount = task.retryCount ?? 0;
      if (retryCount >= task.maxRetries) {
        await updateTaskStatus(task.id, {
          status: "failed",
          error: `All retries exhausted: ${decision.reason}`,
          errorCode: "TAL-001",
          durationMs,
        });
      } else {
        const delay = RETRY_DELAYS_MS[retryCount] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]!;
        console.log(`[executor] Task ${task.id} failed (attempt ${retryCount + 1}), retrying in ${delay}ms`);
        setTimeout(() => {
          updateTaskStatus(task.id, { status: "queued", retryCount: retryCount + 1 });
        }, delay);
      }
      return;
    }

    // Record spend for cloud calls
    if (decision.type === "cloud" && decision.costUsd && decision.costUsd > 0) {
      await recordSpend({
        agentId: task.originAgent,
        providerId: decision.providerId ?? "unknown",
        taskId: task.id,
        tokensIn: decision.tokensIn ?? 0,
        tokensOut: decision.tokensOut ?? 0,
        costUsd: decision.costUsd,
        timestamp: new Date(),
      });
    }

    await updateTaskStatus(task.id, {
      status: "completed",
      output: decision.output,
      tokensUsed: (decision.tokensIn ?? 0) + (decision.tokensOut ?? 0),
      costUsd: decision.costUsd ?? 0,
      durationMs,
      completedAt: new Date(),
    });

    console.log(`[executor] Task ${task.id} completed in ${durationMs}ms (${decision.model})`);
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const retryCount = task.retryCount ?? 0;

    if (retryCount >= task.maxRetries) {
      await updateTaskStatus(task.id, {
        status: "failed",
        error: (err as Error).message,
        errorCode: "TAL-001",
        durationMs,
      });
    } else {
      const delay = RETRY_DELAYS_MS[retryCount] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]!;
      setTimeout(() => {
        updateTaskStatus(task.id, { status: "queued", retryCount: retryCount + 1 });
      }, delay);
    }

    console.error(`[executor] Task ${task.id} error: ${(err as Error).message}`);
  }
}

export async function executeTaskOnce(taskId: string): Promise<void> {
  const { getTask } = await import("./task-queue.js");
  const task = await getTask(taskId);
  if (!task || task.status !== "queued") return;
  const queued = await getQueuedTasks();
  const match = queued.find((t) => t.id === taskId);
  if (match) await executeTask(match);
}