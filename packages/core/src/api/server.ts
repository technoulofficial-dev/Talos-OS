/**
 * Talos OS — HTTP API Server (Port 8642)
 *
 * The core API that all agents, the UI, and external tools connect to.
 * Implements REST endpoints for routing, task management, and health checks.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { routeUnlimited, checkProviderHealth, type ModelRequest, type ModelResponse } from "../ai-engine/router.js";
import { parseBlueprintDiff, generatePlan } from "../blueprint/blueprint.js";
import { createSession, getSession, executeSession, type CouncilProposal } from "../council/index.js";
import { installPlugin, uninstallPlugin, healthCheck, healthCheckAll, listPlugins, getPlugin, executeTool, handleACP, listMCPEndpoints, listExternalAgents, registerExternalAgentFromMCP, type PluginManifest } from "../plugin/index.js";
import type { ACPRequest } from "../types/plugin.js";
import { addTriple, queryTriples, getStats, deleteTriple, clearGraph, searchByEntity, searchByPredicate, findPath } from "../graphify/index.js";
import { createWorkflow, executeWorkflow, getRun, listAllWorkflows, listAllRuns, validateWorkflow, getStoreLocation } from "../workflow/index.js";
import type { z } from "zod";
import { WorkflowNodeSchema } from "../workflow/types.js";

const PORT = Number(process.env["TALOS_PORT"] ?? 8642);
const HOST = process.env["TALOS_HOST"] ?? "0.0.0.0";

interface RouteRequest {
  prompt: string;
  systemPrompt?: string;
  messages?: Array<{ role: string; content: string }>;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  agentId: string;
  preferLocal?: boolean;
}

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const method = req.method ?? "GET";

  try {
    // Health check
    if (url.pathname === "/health" && method === "GET") {
      return sendJson(res, 200, { success: true, data: { status: "operational", uptime: process.uptime() }, timestamp: new Date().toISOString() });
    }

    // Provider health
    if (url.pathname === "/health/providers" && method === "GET") {
      const health = await checkProviderHealth();
      return sendJson(res, 200, { success: true, data: health, timestamp: new Date().toISOString() });
    }

    // AI route
    if (url.pathname === "/v1/route" && method === "POST") {
      const body = await readBody<RouteRequest>(req);
      const messages = body.messages?.map((m) => ({
        role: m.role as "system" | "user" | "assistant",
        content: m.content,
      }));
      const response = await routeUnlimited({ ...body, messages } as ModelRequest);
      return sendJson(res, 200, { success: true, data: response, timestamp: new Date().toISOString() });
    }

    // Agent execution
    if (url.pathname.startsWith("/v1/agents/") && method === "POST") {
      const agentId = url.pathname.split("/")[3];
      const body = await readBody<RouteRequest>(req);
      const response = await executeAgent(agentId!, body);
      return sendJson(res, 200, { success: true, data: response, timestamp: new Date().toISOString() });
    }

    // Blueprint
    if (url.pathname === "/v1/blueprint/diff" && method === "POST") {
      const diffs = await parseBlueprintDiff();
      return sendJson(res, 200, { success: true, data: diffs, timestamp: new Date().toISOString() });
    }

    if (url.pathname === "/v1/blueprint/plan" && method === "POST") {
      const body = await readBody<{ source: string; target: string }>(req);
      const diffs = await parseBlueprintDiff(`${body.source}..${body.target}`);
      const plan = generatePlan(diffs, body.source, body.target);
      return sendJson(res, 200, { success: true, data: plan, timestamp: new Date().toISOString() });
    }

    // Council: submit proposal
    if (url.pathname === "/v1/council" && method === "POST") {
      const body = await readBody<{ proposal: CouncilProposal }>(req);
      if (!body.proposal?.title || !body.proposal?.description) {
        return sendJson(res, 400, { success: false, error: "Proposal must include title and description", timestamp: new Date().toISOString() });
      }
      const { sessionId } = createSession(body.proposal);
      executeSession(sessionId).catch((err) => console.error(`[council] Session ${sessionId} failed:`, err));
      return sendJson(res, 202, { success: true, data: { sessionId, status: "in_progress", message: "Council session started" }, timestamp: new Date().toISOString() });
    }

    // Council: get session status
    if (url.pathname.startsWith("/v1/council/") && method === "GET") {
      const sessionId = url.pathname.replace("/v1/council/", "");
      if (!sessionId) return sendJson(res, 400, { success: false, error: "Session ID required", timestamp: new Date().toISOString() });
      const session = getSession(sessionId);
      if (!session) return sendJson(res, 404, { success: false, error: "Session not found", timestamp: new Date().toISOString() });
      return sendJson(res, 200, { success: true, data: session, timestamp: new Date().toISOString() });
    }

    // Plugin endpoints
    if (url.pathname === "/v1/plugins" && method === "GET") {
      return sendJson(res, 200, { success: true, data: listPlugins(), timestamp: new Date().toISOString() });
    }

    if (url.pathname === "/v1/plugins" && method === "POST") {
      const body = await readBody<{ manifest: PluginManifest }>(req);
      if (!body.manifest?.name) return sendJson(res, 400, { success: false, error: "Plugin manifest with name required", timestamp: new Date().toISOString() });
      const record = await installPlugin(body.manifest);
      return sendJson(res, 201, { success: true, data: record, timestamp: new Date().toISOString() });
    }

    if (url.pathname === "/v1/plugins/health" && method === "GET") {
      const results = await healthCheckAll();
      return sendJson(res, 200, { success: true, data: results, timestamp: new Date().toISOString() });
    }

    if (url.pathname.startsWith("/v1/plugins/") && method === "GET") {
      const idOrName = url.pathname.replace("/v1/plugins/", "").split("/")[0]!;
      const plugin = getPlugin(idOrName);
      if (!plugin) return sendJson(res, 404, { success: false, error: "Plugin not found", timestamp: new Date().toISOString() });
      return sendJson(res, 200, { success: true, data: plugin, timestamp: new Date().toISOString() });
    }

    if (url.pathname.startsWith("/v1/plugins/") && method === "DELETE") {
      const idOrName = url.pathname.replace("/v1/plugins/", "").split("/")[0]!;
      const removed = await uninstallPlugin(idOrName);
      return sendJson(res, removed ? 200 : 404, { success: removed, data: { removed }, timestamp: new Date().toISOString() });
    }

    // MCP endpoints
    if (url.pathname === "/v1/mcp/endpoints" && method === "GET") {
      const healthyOnly = url.searchParams.get("healthy") === "true";
      return sendJson(res, 200, { success: true, data: listMCPEndpoints(healthyOnly || undefined), timestamp: new Date().toISOString() });
    }

    if (url.pathname === "/v1/mcp/execute" && method === "POST") {
      const body = await readBody<{ endpointId: string; tool: string; args?: Record<string, unknown> }>(req);
      if (!body.endpointId || !body.tool) return sendJson(res, 400, { success: false, error: "endpointId and tool required", timestamp: new Date().toISOString() });
      const result = await executeTool({ endpointId: body.endpointId, tool: body.tool, args: body.args ?? {} });
      return sendJson(res, result.success ? 200 : 502, { success: result.success, data: result, timestamp: new Date().toISOString() });
    }

    // ACP operations
    if (url.pathname === "/v1/acp" && method === "POST") {
      const body = await readBody<ACPRequest>(req);
      if (!body.operation || !body.path) return sendJson(res, 400, { success: false, error: "operation and path required", timestamp: new Date().toISOString() });
      const result = await handleACP(body);
      return sendJson(res, result.success ? 200 : 400, { success: result.success, data: result, timestamp: new Date().toISOString() });
    }

    // External agents
    if (url.pathname === "/v1/agents/external" && method === "GET") {
      const protocol = url.searchParams.get("protocol") as "mcp" | "acp" | "both" | null;
      return sendJson(res, 200, { success: true, data: listExternalAgents(protocol ?? undefined), timestamp: new Date().toISOString() });
    }

    if (url.pathname === "/v1/agents/external/register" && method === "POST") {
      const body = await readBody<{ name: string; mcpUrl: string; tools?: Array<{ name: string; description?: string; inputSchema?: Record<string, unknown> }>; capabilities?: string[] }>(req);
      if (!body.name || !body.mcpUrl) return sendJson(res, 400, { success: false, error: "name and mcpUrl required", timestamp: new Date().toISOString() });
      const tools = (body.tools ?? []).map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema ?? {} }));
      const agent = await registerExternalAgentFromMCP(body.name, body.mcpUrl, tools, body.capabilities ?? []);
      return sendJson(res, 201, { success: true, data: agent, timestamp: new Date().toISOString() });
    }

    // Graphify: add triple
    if (url.pathname === "/v1/graphify/triple" && method === "POST") {
      const body = await readBody<{ subject: string; predicate: string; object: string; context?: string; weight?: number }>(req);
      if (!body.subject || !body.predicate || !body.object) return sendJson(res, 400, { success: false, error: "subject, predicate, and object required", timestamp: new Date().toISOString() });
      const triple = await addTriple(body.subject, body.predicate, body.object, body.context, body.weight);
      return sendJson(res, 201, { success: true, data: triple, timestamp: new Date().toISOString() });
    }

    // Graphify: query triples
    if (url.pathname === "/v1/graphify/triples" && method === "GET") {
      const query = {
        entity: url.searchParams.get("entity") ?? undefined,
        predicate: url.searchParams.get("predicate") ?? undefined,
        subject: url.searchParams.get("subject") ?? undefined,
        object: url.searchParams.get("object") ?? undefined,
        limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
        offset: url.searchParams.get("offset") ? Number(url.searchParams.get("offset")) : undefined,
      };
      const results = await queryTriples(query);
      return sendJson(res, 200, { success: true, data: results, timestamp: new Date().toISOString() });
    }

    // Graphify: get stats
    if (url.pathname === "/v1/graphify/stats" && method === "GET") {
      const stats = await getStats();
      return sendJson(res, 200, { success: true, data: stats, timestamp: new Date().toISOString() });
    }

    // Graphify: delete triple
    if (url.pathname.startsWith("/v1/graphify/triple/") && method === "DELETE") {
      const id = url.pathname.replace("/v1/graphify/triple/", "");
      if (!id) return sendJson(res, 400, { success: false, error: "Triple ID required", timestamp: new Date().toISOString() });
      const removed = await deleteTriple(id);
      return sendJson(res, removed ? 200 : 404, { success: removed, data: { removed }, timestamp: new Date().toISOString() });
    }

    // Graphify: clear all
    if (url.pathname === "/v1/graphify" && method === "DELETE") {
      await clearGraph();
      return sendJson(res, 200, { success: true, data: { cleared: true }, timestamp: new Date().toISOString() });
    }

    // Graphify: search by entity
    if (url.pathname === "/v1/graphify/search/entity" && method === "GET") {
      const q = url.searchParams.get("q");
      if (!q) return sendJson(res, 400, { success: false, error: "q parameter required", timestamp: new Date().toISOString() });
      const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined;
      const results = await searchByEntity(q, limit);
      return sendJson(res, 200, { success: true, data: results, timestamp: new Date().toISOString() });
    }

    // Graphify: search by predicate
    if (url.pathname === "/v1/graphify/search/predicate" && method === "GET") {
      const q = url.searchParams.get("q");
      if (!q) return sendJson(res, 400, { success: false, error: "q parameter required", timestamp: new Date().toISOString() });
      const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined;
      const results = await searchByPredicate(q, limit);
      return sendJson(res, 200, { success: true, data: results, timestamp: new Date().toISOString() });
    }

    // Graphify: find path
    if (url.pathname === "/v1/graphify/path" && method === "GET") {
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      if (!from || !to) return sendJson(res, 400, { success: false, error: "from and to parameters required", timestamp: new Date().toISOString() });
      const maxDepth = url.searchParams.get("maxDepth") ? Number(url.searchParams.get("maxDepth")) : undefined;
      const paths = await findPath(from, to, maxDepth);
      return sendJson(res, 200, { success: true, data: paths, timestamp: new Date().toISOString() });
    }

    // Workflow: create
    if (url.pathname === "/v1/workflow" && method === "POST") {
      const body = await readBody<{ name: string; description?: string; nodes: Array<z.input<typeof WorkflowNodeSchema>>; variables?: Record<string, unknown> }>(req);
      if (!body.name || !body.nodes || body.nodes.length === 0) {
        return sendJson(res, 400, { success: false, error: "name and non-empty nodes required", timestamp: new Date().toISOString() });
      }
      try {
        const wf = await createWorkflow({ name: body.name, description: body.description, nodes: body.nodes, variables: body.variables });
        return sendJson(res, 201, { success: true, data: wf, timestamp: new Date().toISOString() });
      } catch (err) {
        return sendJson(res, 400, { success: false, error: (err as Error).message, timestamp: new Date().toISOString() });
      }
    }

    // Workflow: list
    if (url.pathname === "/v1/workflow" && method === "GET") {
      const wfs = await listAllWorkflows();
      return sendJson(res, 200, { success: true, data: wfs, timestamp: new Date().toISOString() });
    }

    // Workflow: validate (dry-run, no persistence)
    if (url.pathname === "/v1/workflow/validate" && method === "POST") {
      const body = await readBody<{ nodes: Array<z.input<typeof WorkflowNodeSchema>> }>(req);
      if (!body.nodes) {
        return sendJson(res, 400, { success: false, error: "nodes required", timestamp: new Date().toISOString() });
      }
      const result = validateWorkflow({ nodes: body.nodes, name: "ad-hoc" });
      return sendJson(res, 200, { success: true, data: result, timestamp: new Date().toISOString() });
    }

    // Workflow: run (POST /v1/workflow/:id/run)
    if (url.pathname.match(/^\/v1\/workflow\/[^/]+\/run$/) && method === "POST") {
      const id = url.pathname.split("/")[3]!;
      const body = await readBody<{ variables?: Record<string, unknown>; triggeredBy?: string }>(req);
      try {
        const run = await executeWorkflow(id, body.variables ?? {}, body.triggeredBy ?? "api");
        return sendJson(res, 202, { success: true, data: { runId: run.runId, state: run.state, storeLocation: getStoreLocation() }, timestamp: new Date().toISOString() });
      } catch (err) {
        return sendJson(res, 400, { success: false, error: (err as Error).message, timestamp: new Date().toISOString() });
      }
    }

    // Workflow: get run
    if (url.pathname.match(/^\/v1\/workflow\/run\/[^/]+$/) && method === "GET") {
      const runId = url.pathname.split("/")[4]!;
      const run = getRun(runId);
      if (!run) return sendJson(res, 404, { success: false, error: "Run not found", timestamp: new Date().toISOString() });
      return sendJson(res, 200, { success: true, data: run, timestamp: new Date().toISOString() });
    }

    // Workflow: list runs
    if (url.pathname === "/v1/workflow/runs" && method === "GET") {
      const workflowId = url.searchParams.get("workflowId") ?? undefined;
      const runs = await listAllRuns(workflowId ?? undefined);
      return sendJson(res, 200, { success: true, data: runs, timestamp: new Date().toISOString() });
    }

    // 404
    return sendJson(res, 404, { success: false, error: "Not found", timestamp: new Date().toISOString() });
  } catch (err) {
    console.error(`[api] ${method} ${url.pathname} failed:`, err);
    return sendJson(res, 500, {
      success: false,
      error: (err as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

async function executeAgent(agentId: string, body: RouteRequest): Promise<ModelResponse> {
  const messages = body.messages?.map((m) => ({
    role: m.role as "system" | "user" | "assistant",
    content: m.content,
  }));
  return routeUnlimited({
    ...body,
    messages,
    agentId,
  });
}

function readBody<T>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try {
        resolve(data ? (JSON.parse(data) as T) : ({} as T));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: ApiResponse): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

export function startServer(): void {
  server.listen(PORT, HOST, () => {
    console.log(`[talos-api] Listening on http://${HOST}:${PORT}`);
    console.log(`[talos-api] Health: http://${HOST}:${PORT}/health`);
  });
}

export function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve());
  });
}

// Auto-start if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}