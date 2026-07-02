import { randomUUID } from "node:crypto";
import { z } from "zod";
import type {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowRun,
  NodeRunState,
  WorkflowValidationResult,
  ValidationIssue,
} from "./types.js";
import { WorkflowNodeSchema } from "./types.js";
import { saveRun, saveWorkflow, loadRun, loadWorkflow, listRuns as persistListRuns, listWorkflows, deleteWorkflow as persistDeleteWorkflow, getStoreDir as getPersistStoreDir } from "./persistence.js";
import { routeUnlimited } from "../ai-engine/router.js";
import { executeTool } from "../plugin/mcp.js";
import { createSession, executeSession } from "../council/session.js";
import { addTriple, queryTriples } from "../graphify/store.js";
import { compressOutput } from "./compress.js";

const workflows = new Map<string, WorkflowDefinition>();
const runs = new Map<string, WorkflowRun>();
const runCallbacks = new Map<string, (run: WorkflowRun) => void>();

// ---------------------------------------------------------------------------
// Template resolution
// ---------------------------------------------------------------------------

/**
 * Split a dotted path into segments, escaping literal dots with backslash.
 * "fetch-source.output.body" → ["fetch-source", "output", "body"]
 * "a\.b.c" → ["a.b", "c"]
 */
function splitPath(path: string): string[] {
  const segments: string[] = [];
  let current = "";
  for (let i = 0; i < path.length; i++) {
    if (path[i] === "\\" && i + 1 < path.length && path[i + 1] === ".") {
      current += ".";
      i++;
    } else if (path[i] === ".") {
      segments.push(current);
      current = "";
    } else {
      current += path[i];
    }
  }
  segments.push(current);
  return segments;
}

/**
 * Resolve {{variable}} and {{dotted.path}} references in a string.
 * Values are coerced to strings (objects → JSON.stringify).
 * Unresolved references are left as-is.
 */
export function resolveVariables(value: string, variables: Record<string, unknown>): string {
  return value.replace(/\{\{([^}]+)\}\}/g, (_match, rawPath: string) => {
    const parts = splitPath(rawPath.trim());
    let current: unknown = variables;
    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== "object") {
        return _match; // unresolved
      }
      if (part in (current as Record<string, unknown>)) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return _match; // unresolved
      }
    }
    return typeof current === "string" ? current : JSON.stringify(current);
  });
}

function deepResolveStrings(
  value: unknown,
  variables: Record<string, unknown>,
): unknown {
  if (typeof value === "string" && value.includes("{{")) {
    return resolveVariables(value, variables);
  }
  if (Array.isArray(value)) {
    return value.map((v) => deepResolveStrings(v, variables));
  }
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = deepResolveStrings(v, variables);
    }
    return result;
  }
  return value;
}

/**
 * Resolve {{...}} placeholders in all string config fields for a node.
 * Deep-resolves nested objects (args, passThrough, proposal, body-as-object).
 */
function resolveConfig(
  config: Record<string, unknown>,
  variables: Record<string, unknown>,
): void {
  const stringFields = [
    "prompt", "url", "body", "graphifyEntity", "graphifyPredicate",
    "expression", "code", "agentId", "iterSource", "subWorkflowId",
    "language", "method",
  ];
  for (const field of stringFields) {
    const val = config[field];
    if (typeof val === "string" && val.includes("{{")) {
      config[field] = resolveVariables(val, variables);
    }
  }
  // Resolve string values in headers map
  const headers = config["headers"];
  if (headers && typeof headers === "object" && !Array.isArray(headers)) {
    for (const [k, v] of Object.entries(headers as Record<string, unknown>)) {
      if (typeof v === "string" && v.includes("{{")) {
        (headers as Record<string, unknown>)[k] = resolveVariables(v, variables);
      }
    }
  }
  // Deep-resolve nested objects: args, passThrough, proposal, body (as object)
  for (const field of ["args", "passThrough", "proposal", "body"]) {
    const val = config[field];
    if (val && typeof val === "object") {
      config[field] = deepResolveStrings(val, variables);
    }
  }
}

function topoOrder(nodes: WorkflowNode[]): WorkflowNode[] {
  const inDeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const n of nodes) {
    inDeg.set(n.id, 0);
    adj.set(n.id, []);
  }
  for (const n of nodes) {
    for (const dep of n.dependsOn) {
      adj.get(dep)!.push(n.id);
      inDeg.set(n.id, (inDeg.get(n.id) ?? 0) + 1);
    }
  }
  const queue: string[] = [];
  for (const [id, deg] of inDeg) if (deg === 0) queue.push(id);
  const order: WorkflowNode[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    const node = nodes.find((n) => n.id === id)!;
    order.push(node);
    for (const next of adj.get(id) ?? []) {
      const d = (inDeg.get(next) ?? 0) - 1;
      inDeg.set(next, d);
      if (d === 0) queue.push(next);
    }
  }
  return order.length === nodes.length ? order : [];
}

function detectCycle(nodes: WorkflowNode[]): string[] {
  const inDeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const n of nodes) {
    inDeg.set(n.id, 0);
    adj.set(n.id, []);
  }
  for (const n of nodes) {
    for (const dep of n.dependsOn) {
      if (!adj.has(dep)) continue;
      adj.get(dep)!.push(n.id);
      inDeg.set(n.id, (inDeg.get(n.id) ?? 0) + 1);
    }
  }
  const queue: string[] = [];
  for (const [id, deg] of inDeg) if (deg === 0) queue.push(id);
  let processed = 0;
  while (queue.length) {
    const id = queue.shift()!;
    processed++;
    for (const next of adj.get(id) ?? []) {
      const d = (inDeg.get(next) ?? 0) - 1;
      inDeg.set(next, d);
      if (d === 0) queue.push(next);
    }
  }
  if (processed !== nodes.length) {
    return nodes.map((n) => n.id).filter((id) => (inDeg.get(id) ?? 0) > 0);
  }
  return [];
}

export function validateWorkflow(definition: WorkflowDefinition | { nodes: Array<z.input<typeof WorkflowNodeSchema>>; id?: string; name?: string }): WorkflowValidationResult {
  const parsedNodes: WorkflowNode[] = [];
  const schemaIssues: ValidationIssue[] = [];
  for (const n of definition.nodes) {
    const result = WorkflowNodeSchema.safeParse(n);
    if (result.success) {
      parsedNodes.push(result.data);
    } else {
      const id = (n as { id?: string }).id ?? "<unknown>";
      schemaIssues.push({
        code: "missing_required_config",
        message: `Schema validation failed for node ${id}: ${result.error.message}`,
        nodeIds: id === "<unknown>" ? [] : [id],
      });
    }
  }
  const semantic = validateParsedNodes(parsedNodes);
  return { valid: semantic.valid && schemaIssues.length === 0, issues: [...schemaIssues, ...semantic.issues] };
}

function validateParsedNodes(nodes: WorkflowNode[]): WorkflowValidationResult {
  const issues: ValidationIssue[] = [];

  if (nodes.length === 0) {
    issues.push({ code: "empty_workflow", message: "Workflow has no nodes", nodeIds: [] });
    return { valid: false, issues };
  }

  const ids = new Set<string>();
  for (const n of nodes) {
    if (ids.has(n.id)) {
      issues.push({ code: "duplicate_node_id", message: `Duplicate node id: ${n.id}`, nodeIds: [n.id] });
    }
    ids.add(n.id);
  }

  for (const n of nodes) {
    for (const dep of n.dependsOn) {
      if (!ids.has(dep)) {
        issues.push({ code: "unknown_dependency", message: `Node ${n.id} depends on unknown node ${dep}`, nodeIds: [n.id] });
      }
    }
  }

  const cyclicNodes = detectCycle(nodes);
  if (cyclicNodes.length > 0) {
    issues.push({ code: "cycle", message: `Cycle detected involving nodes: ${cyclicNodes.join(", ")}`, nodeIds: cyclicNodes });
  }

  for (const n of nodes) {
    if (n.type === "agent" && !n.config.agentId) {
      issues.push({ code: "missing_required_config", message: `Agent node ${n.id} requires config.agentId`, nodeIds: [n.id] });
    }
    if (n.type === "plugin" && (!n.config.endpointId || !n.config.tool)) {
      issues.push({ code: "missing_required_config", message: `Plugin node ${n.id} requires config.endpointId and config.tool`, nodeIds: [n.id] });
    }
    if (n.type === "http" && !n.config.url) {
      issues.push({ code: "missing_required_config", message: `HTTP node ${n.id} requires config.url`, nodeIds: [n.id] });
    }
    if (n.type === "council" && !n.config.proposal) {
      issues.push({ code: "missing_required_config", message: `Council node ${n.id} requires config.proposal`, nodeIds: [n.id] });
    }
    if (n.type === "sub_workflow" && !n.config.subWorkflowId) {
      issues.push({ code: "missing_required_config", message: `Sub-workflow node ${n.id} requires config.subWorkflowId`, nodeIds: [n.id] });
    }
    if (n.type === "graphify" && !n.config.graphifyEntity && !n.config.graphifyPredicate) {
      issues.push({ code: "missing_required_config", message: `Graphify node ${n.id} requires config.graphifyEntity or config.graphifyPredicate`, nodeIds: [n.id] });
    }
  }

  return { valid: issues.length === 0, issues };
}

export async function createWorkflow(input: {
  name: string;
  description?: string;
  nodes: Array<z.input<typeof WorkflowNodeSchema>>;
  variables?: Record<string, unknown>;
}): Promise<WorkflowDefinition> {
  const now = new Date();
  const parsedNodes: WorkflowNode[] = input.nodes.map((n) => WorkflowNodeSchema.parse(n));
  const definition: WorkflowDefinition = {
    id: randomUUID(),
    name: input.name,
    description: input.description ?? "",
    version: "1.0.0",
    nodes: parsedNodes,
    variables: input.variables ?? {},
    createdAt: now,
    updatedAt: now,
  };

  const validation = validateWorkflow(definition);
  if (!validation.valid) {
    const msgs = validation.issues.map((i) => i.message).join("; ");
    throw new Error(`Invalid workflow: ${msgs}`);
  }

  workflows.set(definition.id, definition);
  await saveWorkflow(definition);
  return definition;
}

export function getWorkflow(id: string): WorkflowDefinition | undefined {
  return workflows.get(id);
}

export async function loadAndRegisterWorkflow(id: string): Promise<WorkflowDefinition | null> {
  const existing = workflows.get(id);
  if (existing) return existing;
  const wf = await loadWorkflow(id);
  if (wf) workflows.set(wf.id, wf);
  return wf;
}

export async function listAllWorkflows(): Promise<Array<{ id: string; name: string; updatedAt: string }>> {
  return listWorkflows();
}

export async function removeWorkflow(id: string): Promise<boolean> {
  workflows.delete(id);
  return persistDeleteWorkflow(id);
}

interface NodeExecutionContext {
  workflow: WorkflowDefinition;
  run: WorkflowRun;
  nodeRun: NodeRunState;
  variables: Record<string, unknown>;
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function executeAgentNode(ctx: NodeExecutionContext): Promise<unknown> {
  const { config } = ctx.workflow.nodes.find((n) => n.id === ctx.nodeRun.nodeId)!;
  if (!config.agentId) throw new Error("agent node missing agentId");
  const response = await routeUnlimited({
    agentId: config.agentId,
    prompt: config.prompt ?? "",
    maxTokens: 1024,
  });
  return { provider: response.provider, output: response.output, model: response.model };
}

async function executeCouncilNode(ctx: NodeExecutionContext): Promise<unknown> {
  const { config } = ctx.workflow.nodes.find((n) => n.id === ctx.nodeRun.nodeId)!;
  if (!config.proposal) throw new Error("council node missing proposal");
  const { sessionId } = createSession({
    title: config.proposal.title,
    description: config.proposal.description,
    context: config.proposal.context,
    priority: config.proposal.priority ?? "normal",
  });
  const session = await executeSession(sessionId);
  return { sessionId, verdict: session.verdict, reports: session.reports.length };
}

async function executePluginNode(ctx: NodeExecutionContext): Promise<unknown> {
  const { config } = ctx.workflow.nodes.find((n) => n.id === ctx.nodeRun.nodeId)!;
  if (!config.endpointId || !config.tool) throw new Error("plugin node missing endpointId/tool");
  const result = await executeTool({
    endpointId: config.endpointId,
    tool: config.tool,
    args: config.args,
  });
  if (!result.success) throw new Error(result.error ?? "plugin tool execution failed");
  return result;
}

async function executeConditionNode(ctx: NodeExecutionContext): Promise<unknown> {
  if (process.env["TALOS_WORKFLOW_CODE_ENABLED"] !== "true") {
    throw new Error("condition node is disabled: set TALOS_WORKFLOW_CODE_ENABLED=true to enable arbitrary JS evaluation");
  }
  const { config } = ctx.workflow.nodes.find((n) => n.id === ctx.nodeRun.nodeId)!;
  if (!config.expression) return { branch: 0, evaluated: true };
  let result = false;
  try {
    const fn = new Function("variables", `with (variables) { return (${config.expression}); }`);
    result = Boolean(fn(ctx.variables));
  } catch (err) {
    throw new Error(`condition expression error: ${(err as Error).message}`);
  }
  return { branch: result ? 1 : 0, evaluated: result };
}

async function executeParallelNode(ctx: NodeExecutionContext): Promise<unknown> {
  const { config } = ctx.workflow.nodes.find((n) => n.id === ctx.nodeRun.nodeId)!;
  return { parallelBranches: config.branches, status: "fanned_out" };
}

async function executeLoopNode(ctx: NodeExecutionContext): Promise<unknown> {
  const { config } = ctx.workflow.nodes.find((n) => n.id === ctx.nodeRun.nodeId)!;
  const source = config.iterSource ? ctx.variables[config.iterSource] : undefined;
  const items = Array.isArray(source) ? source : [];
  return { iterations: Math.min(items.length, config.maxIterations), maxIterations: config.maxIterations };
}

async function executeHttpNode(ctx: NodeExecutionContext): Promise<unknown> {
  const { config } = ctx.workflow.nodes.find((n) => n.id === ctx.nodeRun.nodeId)!;
  if (!config.url) throw new Error("http node missing url");
  const method = config.method;
  const init: RequestInit = { method, headers: config.headers };
  if (method !== "GET" && method !== "DELETE" && config.body !== undefined) {
    init.body = typeof config.body === "string" ? config.body : JSON.stringify(config.body);
    if (!("Content-Type" in config.headers)) {
      init.headers = { ...config.headers, "Content-Type": "application/json" };
    }
  }
  const res = await fetch(config.url, init);
  const text = await res.text();
  let body: unknown = text;
  try { body = JSON.parse(text); } catch { /* leave as text */ }
  return { status: res.status, ok: res.ok, body };
}

async function executeCodeNode(ctx: NodeExecutionContext): Promise<unknown> {
  if (process.env["TALOS_WORKFLOW_CODE_ENABLED"] !== "true") {
    throw new Error("code node is disabled: set TALOS_WORKFLOW_CODE_ENABLED=true to enable arbitrary JS evaluation");
  }
  const { config } = ctx.workflow.nodes.find((n) => n.id === ctx.nodeRun.nodeId)!;
  if (!config.code) return { executed: false, note: "no code" };
  const fn = new Function("variables", config.code);
  return fn(ctx.variables);
}

async function executeSubWorkflowNode(ctx: NodeExecutionContext): Promise<unknown> {
  const { config } = ctx.workflow.nodes.find((n) => n.id === ctx.nodeRun.nodeId)!;
  if (!config.subWorkflowId) throw new Error("sub_workflow node missing subWorkflowId");
  const child = await executeWorkflow(
    config.subWorkflowId,
    { ...ctx.variables, ...config.passThrough },
    `parent:${ctx.run.runId}`
  );
  return {
    childRunId: child.runId,
    childState: child.state,
    childError: child.error,
    childNodeCount: child.nodes.length,
  };
}

async function executeGraphifyNode(ctx: NodeExecutionContext): Promise<unknown> {
  const { config } = ctx.workflow.nodes.find((n) => n.id === ctx.nodeRun.nodeId)!;
  const action = config.graphifyAction ?? "query";

  if (action === "add") {
    const subject = config.graphifyEntity ?? "workflow";
    const predicate = config.graphifyPredicate ?? "produced";
    const object = typeof ctx.nodeRun.output === "string"
      ? ctx.nodeRun.output
      : JSON.stringify(ctx.nodeRun.output ?? {});
    const context = `workflow:${ctx.run.runId}:${ctx.nodeRun.nodeId}`;
    const triple = await addTriple(subject, predicate, object, context);
    return { added: true, triple };
  }

  const triples = await queryTriples({
    entity: config.graphifyEntity,
    predicate: config.graphifyPredicate,
    limit: config.graphifyLimit,
  });
  return { count: triples.length, triples };
}

const NODE_EXECUTORS: Record<WorkflowNode["type"], (ctx: NodeExecutionContext) => Promise<unknown>> = {
  agent: executeAgentNode,
  council: executeCouncilNode,
  plugin: executePluginNode,
  condition: executeConditionNode,
  parallel: executeParallelNode,
  loop: executeLoopNode,
  http: executeHttpNode,
  code: executeCodeNode,
  sub_workflow: executeSubWorkflowNode,
  graphify: executeGraphifyNode,
};

export function setNodeExecutor(type: WorkflowNode["type"], executor: (ctx: NodeExecutionContext) => Promise<unknown>): void {
  NODE_EXECUTORS[type] = executor;
}

export function resetNodeExecutor(type: WorkflowNode["type"]): void {
  const originals: Record<WorkflowNode["type"], (ctx: NodeExecutionContext) => Promise<unknown>> = {
    agent: executeAgentNode,
    council: executeCouncilNode,
    plugin: executePluginNode,
    condition: executeConditionNode,
    parallel: executeParallelNode,
    loop: executeLoopNode,
    http: executeHttpNode,
    code: executeCodeNode,
    sub_workflow: executeSubWorkflowNode,
    graphify: executeGraphifyNode,
  };
  NODE_EXECUTORS[type] = originals[type];
}

async function runNode(workflow: WorkflowDefinition, run: WorkflowRun, node: WorkflowNode): Promise<void> {
  const nodeRun = run.nodes.find((n) => n.nodeId === node.id)!;
  const ctx: NodeExecutionContext = { workflow, run, nodeRun, variables: run.variables };

  // Resolve {{...}} placeholders in string config fields before execution
  const configCopy = { ...node.config } as Record<string, unknown>;
  resolveConfig(configCopy, run.variables);
  // Patch the workflow node's config in-place for this execution
  // (executors read from ctx.workflow.nodes, so we temporarily swap)
  const originalConfig = node.config;
  (node as { config: typeof node.config }).config = configCopy as typeof node.config;

  nodeRun.state = "running";
  nodeRun.startedAt = new Date();
  nodeRun.attempts++;
  run.state = "running";
  await saveRun(run);

  const executor = NODE_EXECUTORS[node.type];
  if (!executor) {
    nodeRun.state = "failed";
    nodeRun.error = `Unknown node type: ${node.type}`;
    (node as { config: typeof node.config }).config = originalConfig;
    throw new Error(nodeRun.error);
  }

  const attempt = async (): Promise<void> => {
    try {
      const rawOutput = await withTimeout(executor(ctx), node.timeoutMs);
      nodeRun.output = compressOutput(rawOutput);
      nodeRun.state = "completed";
      nodeRun.completedAt = new Date();
      nodeRun.durationMs = nodeRun.completedAt.getTime() - (nodeRun.startedAt?.getTime() ?? Date.now());
    } catch (err) {
      nodeRun.error = (err as Error).message;
      throw err;
    }
  };

  try {
    await attempt();
    // Inject node output into run.variables so downstream nodes can reference it
    // e.g. {{fetch-source.output.body}} resolves via variables["fetch-source"]["output"]["body"]
    if (nodeRun.output !== undefined) {
      run.variables[node.id] = nodeRun.output;
    }
  } catch (err) {
    if (nodeRun.attempts <= node.maxRetries) {
      const remaining = node.maxRetries - nodeRun.attempts + 1;
      for (let i = 0; i < remaining; i++) {
        try {
          nodeRun.startedAt = new Date();
          nodeRun.attempts++;
          await attempt();
          err = null;
          // Inject output after successful retry
          if (nodeRun.output !== undefined) {
            run.variables[node.id] = nodeRun.output;
          }
          break;
        } catch (err2) {
          err = err2;
          if (i === remaining - 1) {
            nodeRun.state = "failed";
            nodeRun.completedAt = new Date();
            nodeRun.durationMs = nodeRun.completedAt.getTime() - (nodeRun.startedAt?.getTime() ?? Date.now());
            throw err2;
          }
        }
      }
    } else {
      nodeRun.state = "failed";
      nodeRun.completedAt = new Date();
      nodeRun.durationMs = nodeRun.completedAt.getTime() - (nodeRun.startedAt?.getTime() ?? Date.now());
      throw err;
    }
  } finally {
    // Restore original config (with {{...}} intact) for persistence
    (node as { config: typeof node.config }).config = originalConfig;
  }
}

export async function executeWorkflow(
  workflowId: string,
  variables: Record<string, unknown> = {},
  triggeredBy = "api"
): Promise<WorkflowRun> {
  let workflow = workflows.get(workflowId);
  if (!workflow) workflow = await loadAndRegisterWorkflow(workflowId) ?? undefined;
  if (!workflow) throw new Error(`Workflow not found: ${workflowId}`);

  const validation = validateWorkflow(workflow);
  if (!validation.valid) {
    throw new Error(`Cannot execute invalid workflow: ${validation.issues.map((i) => i.message).join("; ")}`);
  }

  const runId = randomUUID();
  const run: WorkflowRun = {
    runId,
    workflowId: workflow.id,
    workflowName: workflow.name,
    state: "pending",
    startedAt: new Date(),
    nodes: workflow.nodes.map((n) => ({
      nodeId: n.id,
      state: "pending",
      attempts: 0,
      durationMs: 0,
    })),
    variables: { ...workflow.variables, ...variables },
    triggeredBy,
  };
  runs.set(runId, run);
  await saveRun(run);

  const order = topoOrder(workflow.nodes);
  const cb = runCallbacks.get(workflowId);
  if (cb) cb(run);

  let failed = false;
  for (const node of order) {
    if (failed) {
      const nodeRun = run.nodes.find((n) => n.nodeId === node.id)!;
      nodeRun.state = "skipped";
      nodeRun.completedAt = new Date();
      continue;
    }
    const allDepsDone = node.dependsOn.every((dep) => {
      const depState = run.nodes.find((n) => n.nodeId === dep)?.state;
      return depState === "completed" || depState === "skipped";
    });
    if (!allDepsDone) {
      const nodeRun = run.nodes.find((n) => n.nodeId === node.id)!;
      nodeRun.state = "skipped";
      nodeRun.completedAt = new Date();
      continue;
    }
    try {
      await runNode(workflow, run, node);
    } catch (err) {
      const lastNode = run.nodes.find((n) => n.nodeId === node.id)!;
      run.error = lastNode.error ?? (err as Error).message;
      failed = true;
    }
    const partialCb = runCallbacks.get(runId);
    if (partialCb) partialCb(run);
  }

  if (failed) {
    run.state = "failed";
    run.completedAt = new Date();
  } else {
    run.state = "completed";
    run.completedAt = new Date();
  }

  const finalCb = runCallbacks.get(runId);
  if (finalCb) finalCb(run);
  runCallbacks.delete(runId);

  await saveRun(run);
  return run;
}

export function getRun(runId: string): WorkflowRun | undefined {
  return runs.get(runId) ?? undefined;
}

export async function loadAndRegisterRun(runId: string): Promise<WorkflowRun | null> {
  const existing = runs.get(runId);
  if (existing) return existing;
  const r = await loadRun(runId);
  if (r) runs.set(r.runId, r);
  return r;
}

export async function listAllRuns(workflowId?: string): Promise<Array<{ runId: string; workflowId: string; state: string; startedAt: string }>> {
  return persistListRuns(workflowId);
}

export function onRunUpdate(runId: string, callback: (run: WorkflowRun) => void): void {
  runCallbacks.set(runId, callback);
}

export function clearRunCallback(runId: string): void {
  runCallbacks.delete(runId);
}

export function getStoreLocation(): string {
  return getPersistStoreDir();
}
