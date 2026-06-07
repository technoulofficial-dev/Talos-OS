/**
 * Talos OS v8.0 — Hermes HTTP API Server
 * Runs on port TALOS_PORT (default 8642)
 *
 * Endpoints:
 *   GET  /              — Bronze-punk TUI banner
 *   GET  /v1/health     — Health check
 *   POST /v1/chat      — Main chat endpoint (route prompt → AI → response)
 *   GET  /v1/models    — Available G0DM0D3 free models
 *   POST /v1/tasks     — Submit a task to the execution queue
 *   GET  /v1/tasks/:id — Poll task status
 *   GET  /v1/audit     — Recent routing traces
 *   GET  /v1/budget    — Current budget state
 */

import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";
import { loadTalosConfig } from "../config/loader.js";
import { route } from "../router/router.js";
import { getRecentTraces } from "../router/trace.js";
import { getLedgerSummary } from "../budget/ledger.js";
import { buildBudgetState } from "../budget/state.js";
import { getModelInfo, G0DM0D3_FREE_MODELS } from "../g0dm0d3/models.js";
import { isLocalOllamaAlive, isG0DM0D3Alive } from "../g0dm0d3/executor.js";
import { submitTask, getTask, type SubmitTaskRequest } from "./task-queue.js";
import { createSnapshot, checkContextBudget, estimateConversationTokens, getSnapshots, type SnapshotRecord } from "../cortex/index.js";
import type { TaskConfig } from "../types/provider.js";

const PORT = parseInt((process.env as Record<string, string | undefined>)["TALOS_PORT"] ?? "8642", 10);
const config = loadTalosConfig();

const BANNER = `
╔══════════════════════════════════════════════════════╗
║  █████  ██████  ██████  ███▄ ▄███  ██████  ██████  ██████  ║
║ ██      ██  ██  ██   ██ ██ ███ ██  ██  ██  ██   ██      ██ ║
║ ██ ▄███ ██  ██  ██   ██ ██  █  ██  ██  ██  ██   ██  █████  ║
║ ██  ██  ██  ██  ██   ██ ██     ██  ██  ██  ██   ██      ██ ║
║  ██████  ████   ██████  ██     ██   ████   ██████  ██████  ║
║ ────────────────────────────────────────────────────── ║
║  The Bronze Automaton · Adjustable · Self-Improving    ║
║  Bearer of the Digital World · Metis Corp · v8.0       ║
╚══════════════════════════════════════════════════════╝
`;

type MethodHandler = (url: URL, body: string | null, res: ServerResponse) => Promise<void>;

async function handleCortexBudget(_url: URL, _body: string | null, res: ServerResponse): Promise<void> {
  const agentId = _url.searchParams.get("agentId") ?? "odin";
  const maxContext = parseInt(_url.searchParams.get("maxContext") ?? String(config.hermes.max_context_tokens), 10);
  const messages = JSON.parse(_url.searchParams.get("messages") ?? "[]") as Array<{ content: string }>;
  const systemPrompt = _url.searchParams.get("systemPrompt") ?? "";
  const totalTokens = estimateConversationTokens(messages.map(m => ({ role: "user", content: m.content })), systemPrompt);
  const budget = checkContextBudget(totalTokens, maxContext);
  json(res, 200, budget);
}

async function handleCortexSnapshot(url: URL, body: string | null, res: ServerResponse): Promise<void> {
  const isGet = body === null;

  if (isGet) {
    const sessionId = url.searchParams.get("sessionId") ?? "";
    const snaps = getSnapshots(sessionId || undefined);
    json(res, 200, { count: snaps.length, snapshots: snaps });
    return;
  }

  if (!body) {
    json(res, 400, { error: "Request body required" });
    return;
  }

  let parsed: {
    sessionId: string;
    threadOfFate?: unknown;
    identityCore?: unknown;
    summary?: string;
    estimatedTokens?: number;
  };
  try {
    parsed = JSON.parse(body) as typeof parsed;
  } catch {
    json(res, 400, { error: "Invalid JSON body" });
    return;
  }

  const snapshot = await createSnapshot(
    parsed.sessionId,
    parsed.threadOfFate ?? {},
    parsed.identityCore ?? {},
    parsed.summary ?? "",
    parsed.estimatedTokens ?? 0
  );

  json(res, 201, {
    snapshotId: snapshot.snapshotId,
    sessionId: snapshot.sessionId,
    timestamp: snapshot.timestamp.toISOString(),
    estimatedTokens: snapshot.estimatedTokens,
    message: "Session snapshot saved. New context window available.",
  });
}

const handlers: Record<string, Record<string, MethodHandler>> = {
  "/": { GET: handleRoot },
  "/v1/health": { GET: handleHealth },
  "/v1/chat": { POST: handleChat },
  "/v1/models": { GET: handleModels },
  "/v1/tasks": { GET: handleListTasks, POST: handleCreateTask },
  "/v1/audit": { GET: handleAudit },
  "/v1/budget": { GET: handleBudget },
  "/v1/cortex/snapshot": { GET: handleCortexSnapshot, POST: handleCortexSnapshot },
  "/v1/cortex/budget": { GET: handleCortexBudget },
};

for (const [path, methods] of Object.entries(handlers)) {
  if (path !== "/v1/tasks") continue;
  handlers[path] = { ...methods };
  // Tasks routes with ID
  handlers[`/v1/tasks/:id`] = {};
}

async function handleRoot(_url: URL, _body: string | null, res: ServerResponse): Promise<void> {
  json(res, 200, {
    name: "Talos OS",
    version: config.version,
    mode: config.mode,
    hermes_anchor: config.hermes_anchor,
    banner: BANNER,
    endpoints: [
      "GET  /              — This banner",
      "GET  /v1/health    — Health check",
      "POST /v1/chat      — Route prompt → AI → response",
      "GET  /v1/models    — Available G0DM0D3 free models",
      "POST /v1/tasks     — Submit task to execution queue",
      "GET  /v1/tasks/:id  — Poll task status",
      "GET  /v1/audit     — Recent routing traces",
      "GET  /v1/budget    — Current budget state",
    ],
  });
}

async function handleHealth(_url: URL, _body: string | null, res: ServerResponse): Promise<void> {
  const ollamaAlive = await isLocalOllamaAlive();
  const g0dm0d3Alive = await isG0DM0D3Alive();
  const budgetState = buildBudgetState();
  const ledger = await getLedgerSummary();

  json(res, 200, {
    status: "ok",
    version: config.version,
    providers: {
      local_ollama: ollamaAlive,
      g0dm0d3_openrouter: g0dm0d3Alive,
    },
    budget: {
      monthly_usd: ledger.monthlyUsd,
      monthly_cap: budgetState.monthlyCapUsd,
      hourly_usd: ledger.hourlyUsd,
      hourly_cap: budgetState.hourlyCapUsd,
      enabled: budgetState.enabled,
    },
    timestamp: new Date().toISOString(),
  });
}

async function handleChat(url: URL, body: string | null, res: ServerResponse): Promise<void> {
  if (!body) {
    json(res, 400, { error: "Request body required" });
    return;
  }

  let parsed: ChatRequest;
  try {
    parsed = JSON.parse(body) as ChatRequest;
  } catch {
    json(res, 400, { error: "Invalid JSON body" });
    return;
  }

  const agentId = parsed.agentId ?? config.hermes.agent_id;
  const maxTokens = parsed.maxTokens ?? 4096;
  const temperature = parsed.temperature ?? config.hermes.temperature;

  const taskConfig: TaskConfig = {
    agentId,
    maxTokens,
    temperature,
    preferLocal: parsed.preferLocal ?? true,
    priority: parsed.priority ?? "normal",
    requiredSkills: parsed.requiredSkills ?? [],
    modelHints: parsed.modelHints ?? [],
    requiresTools: parsed.requiresTools ?? false,
    systemPrompt: parsed.systemPrompt ?? undefined,
    prompt: parsed.prompt,
    messages: (parsed.messages ?? []).map(m => ({
      role: m.role as "system" | "user" | "assistant",
      content: m.content,
    })),
  };

  try {
    const decision = await route(taskConfig);

    // Handle context budget exceeded — signal client to snapshot session
    if (decision.type === "none" && decision.reason === "context_budget_exceeded") {
      json(res, 503, {
        error: "snapshot_required",
        reason: "context_budget_exceeded",
        message: decision.contextBudget?.message ?? "Context window at 95%. Snapshot session to Supabase before continuing.",
        contextBudget: {
          usedPct: decision.contextBudget?.usedPct,
          currentTokens: decision.contextBudget?.currentTokens,
          maxTokens: decision.contextBudget?.maxTokens,
          snapshotNeeded: true,
        },
        suggestion: "POST /v1/cortex/snapshot with current session state, then retry",
      });
      return;
    }

    if (decision.type === "none") {
      json(res, 429, {
        error: "no_provider_available",
        reason: decision.reason,
        contextBudget: decision.contextBudget,
      });
      return;
    }

    json(res, 200, {
      output: decision.output,
      model: decision.model,
      provider: decision.type,
      tokensIn: decision.tokensIn ?? 0,
      tokensOut: decision.tokensOut ?? 0,
      latencyMs: decision.latencyMs ?? 0,
      costUsd: decision.costUsd ?? 0,
    });
  } catch (err) {
    console.error("[hermes] Chat error:", err);
    json(res, 500, {
      error: "execution_failed",
      message: (err as Error).message,
    });
  }
}

async function handleModels(_url: URL, _body: string | null, res: ServerResponse): Promise<void> {
  const models = G0DM0D3_FREE_MODELS.map((m) => ({
    id: m.id,
    name: m.name,
    context_length: m.contextLength,
    description: m.description,
  }));

  json(res, 200, {
    object: "list",
    data: models,
  });
}

async function handleCreateTask(url: URL, body: string | null, res: ServerResponse): Promise<void> {
  if (!body) {
    json(res, 400, { error: "Request body required" });
    return;
  }

  let parsed: SubmitTaskRequest;
  try {
    parsed = JSON.parse(body) as SubmitTaskRequest;
  } catch {
    json(res, 400, { error: "Invalid JSON body" });
    return;
  }

  try {
    const taskId = await submitTask(parsed);
    json(res, 202, {
      taskId,
      status: "queued",
      message: "Task submitted to queue",
    });
  } catch (err) {
    json(res, 500, {
      error: "queue_failed",
      message: (err as Error).message,
    });
  }
}

async function handleListTasks(url: URL, _body: string | null, res: ServerResponse): Promise<void> {
  const status = url.searchParams.get("status");
  json(res, 200, { message: "Task listing not yet implemented (Phase A3)" });
}

async function handleAudit(_url: URL, _body: string | null, res: ServerResponse): Promise<void> {
  const traces = getRecentTraces(100);
  json(res, 200, {
    count: traces.length,
    traces: traces.map((t) => ({
      agentId: t.agentId,
      decision: t.decision,
      reason: t.reason,
      model: t.model,
      latencyMs: t.latencyMs,
      costUsd: t.costUsd,
      timestamp: t.timestamp.toISOString(),
    })),
  });
}

async function handleBudget(_url: URL, _body: string | null, res: ServerResponse): Promise<void> {
  const state = buildBudgetState();
  const ledger = await getLedgerSummary();
  json(res, 200, {
    monthly: {
      spent_usd: ledger.monthlyUsd,
      cap_usd: state.monthlyCapUsd,
      used_pct: state.monthlyCapUsd > 0 ? Math.round((ledger.monthlyUsd / state.monthlyCapUsd) * 100) : 0,
    },
    hourly: {
      spent_usd: ledger.hourlyUsd,
      cap_usd: state.hourlyCapUsd,
    },
    minute_requests: ledger.minuteRequests,
    per_minute_cap: state.perMinuteRequests,
    enabled: state.enabled,
  });
}

function json(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "X-Powered-By": "Talos OS v8.0",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(data, null, 2));
}

function parseBody(req: IncomingMessage): Promise<string | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      if (chunks.length === 0) { resolve(null); return; }
      resolve(Buffer.concat(chunks).toString("utf-8"));
    });
    req.on("error", () => resolve(null));
  });
}

interface ChatRequest {
  agentId?: string;
  prompt: string;
  systemPrompt?: string;
  modelHints?: string[];
  maxTokens?: number;
  temperature?: number;
  preferLocal?: boolean;
  priority?: "low" | "normal" | "high" | "critical";
  requiredSkills?: string[];
  requiresTools?: boolean;
  messages?: Array<{ role: string; content: string }>;
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const method = req.method ?? "GET";
  const path = url.pathname;

  // Handle CORS preflight
  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });
    res.end();
    return;
  }

  // Route matching
  let handler: MethodHandler | undefined;
  let matchedPath = path;

  // Exact match
  if (handlers[path]?.[method]) {
    handler = handlers[path]![method] as MethodHandler;
  }

  // /v1/tasks/:id pattern
  if (!handler && path.startsWith("/v1/tasks/")) {
    const id = path.replace("/v1/tasks/", "");
    (url as URL & { taskId?: string }).taskId = id;
    handler = (handlers["/v1/tasks/:id"] as Record<string, MethodHandler>)?.[method];
  }

  if (!handler) {
    json(res, 404, { error: "not_found", path, method });
    return;
  }

  const body = method === "POST" || method === "PUT" ? await parseBody(req) : null;

  try {
    await handler(url, body, res);
  } catch (err) {
    console.error(`[hermes] Handler error (${method} ${path}):`, err);
    json(res, 500, { error: "internal_error", message: (err as Error).message });
  }
});

server.listen(PORT, () => {
  console.log(BANNER);
  console.log(`[Hermes] Talos Core API running on http://localhost:${PORT}`);
  console.log(`[Hermes] G0DM0D3: ${config.g0dm0d3.enabled ? "enabled" : "disabled"}`);
  console.log(`[Hermes] Cloud budget: $${config.cloud.budget.monthly_usd}/mo, $${config.cloud.budget.hourly_usd}/hr`);
});

export { server };