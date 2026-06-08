import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { WorkflowNode } from "../workflow/types.js";
import { WorkflowNodeSchema } from "../workflow/types.js";
import { z } from "zod";
import {
  validateWorkflow,
  createWorkflow,
  getWorkflow,
  executeWorkflow,
  getRun,
  listAllWorkflows,
  listAllRuns,
  removeWorkflow,
  setNodeExecutor,
  resetNodeExecutor,
  getStoreLocation,
  resolveVariables,
} from "../workflow/engine.js";
import {
  loadWorkflow as persistLoad,
  listWorkflows as persistList,
  loadRun as persistLoadRun,
  listRuns as persistListRuns,
  clearCache as persistClearCache,
  getStoreDir,
} from "../workflow/persistence.js";
import { __setStoreDir } from "../workflow/_test_hooks.js";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "talos-workflow-"));
  __setStoreDir(tempDir);
  persistClearCache();
  process.env["TALOS_WORKFLOW_CODE_ENABLED"] = "true";

  setNodeExecutor("http", async () => ({ status: 200, ok: true, body: { mocked: true } }));
  setNodeExecutor("agent", async () => ({ provider: "mock", content: "mock agent response", model: "mock-model" }));
  setNodeExecutor("plugin", async () => ({ success: true, result: { mocked: true }, durationMs: 1 }));
  setNodeExecutor("council", async () => ({ sessionId: "mock-session", verdict: { summary: "mock verdict" }, reports: 5 }));
});

afterEach(async () => {
  resetNodeExecutor("http");
  resetNodeExecutor("agent");
  resetNodeExecutor("plugin");
  resetNodeExecutor("council");
  __setStoreDir(join(process.cwd(), ".talos", "workflows"));
  await rm(tempDir, { recursive: true, force: true });
});

function makeNode(overrides: Partial<z.input<typeof WorkflowNodeSchema>> = {}): z.input<typeof WorkflowNodeSchema> {
  return {
    id: "n1",
    type: "http",
    name: "Test Node",
    config: { url: "https://example.com" },
    dependsOn: [],
    timeoutMs: 5000,
    retryOn: ["error"],
    maxRetries: 0,
    ...overrides,
  };
}

describe("Workflow — Types & Validation", () => {
  it("validates a single-node workflow", () => {
    const result = validateWorkflow({ name: "test", nodes: [makeNode()] });
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("rejects empty workflow", () => {
    const result = validateWorkflow({ name: "test", nodes: [] });
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.code).toBe("empty_workflow");
  });

  it("detects duplicate node ids", () => {
    const result = validateWorkflow({
      name: "test",
      nodes: [makeNode({ id: "a" }), makeNode({ id: "a" })],
    });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "duplicate_node_id")).toBe(true);
  });

  it("detects unknown dependencies", () => {
    const result = validateWorkflow({
      name: "test",
      nodes: [makeNode({ id: "a", dependsOn: ["ghost"] })],
    });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "unknown_dependency")).toBe(true);
  });

  it("detects cycles", () => {
    const result = validateWorkflow({
      name: "test",
      nodes: [
        makeNode({ id: "a", dependsOn: ["b"] }),
        makeNode({ id: "b", dependsOn: ["a"] }),
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "cycle")).toBe(true);
  });

  it("detects missing required config for agent nodes", () => {
    const result = validateWorkflow({
      name: "test",
      nodes: [makeNode({ type: "agent" })],
    });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "missing_required_config")).toBe(true);
  });

  it("detects missing required config for plugin nodes", () => {
    const result = validateWorkflow({
      name: "test",
      nodes: [makeNode({ type: "plugin" })],
    });
    expect(result.valid).toBe(false);
  });

  it("detects missing required config for http nodes", () => {
    const result = validateWorkflow({
      name: "test",
      nodes: [makeNode({ type: "http", config: { headers: {} } })],
    });
    expect(result.valid).toBe(false);
  });

  it("detects missing required config for council nodes", () => {
    const result = validateWorkflow({
      name: "test",
      nodes: [makeNode({ type: "council" })],
    });
    expect(result.valid).toBe(false);
  });

  it("reports schema violations without crashing", () => {
    const result = validateWorkflow({
      name: "test",
      nodes: [
        {
          id: "x",
          type: "http",
          name: "X",
          config: { headers: "oops" as unknown as Record<string, string> },
          dependsOn: [],
          timeoutMs: 5000,
          retryOn: ["error"],
          maxRetries: 0,
        },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});

describe("Workflow — Engine", () => {
  it("creates and registers a workflow", async () => {
    const wf = await createWorkflow({
      name: "Test Flow",
      nodes: [makeNode()],
    });
    expect(wf.id).toBeDefined();
    expect(wf.name).toBe("Test Flow");
    expect(getWorkflow(wf.id)).toBeDefined();
  });

  it("rejects creation of invalid workflow", async () => {
    await expect(
      createWorkflow({ name: "Bad", nodes: [] })
    ).rejects.toThrow(/Invalid workflow/);
  });

  it("executes a simple http workflow and marks nodes completed", async () => {
    const wf = await createWorkflow({
      name: "HTTP Flow",
      nodes: [makeNode({ id: "fetch", type: "http" })],
    });
    const run = await executeWorkflow(wf.id);
    expect(run.state).toBe("completed");
    const nodeRun = run.nodes[0]!;
    expect(nodeRun.state).toBe("completed");
    expect(nodeRun.output).toBeDefined();
  });

  it("executes a DAG with two sequential nodes", async () => {
    const wf = await createWorkflow({
      name: "Sequential",
      nodes: [
        makeNode({ id: "first", type: "http" }),
        makeNode({ id: "second", type: "http", dependsOn: ["first"] }),
      ],
    });
    const run = await executeWorkflow(wf.id);
    expect(run.state).toBe("completed");
    const first = run.nodes.find((n) => n.nodeId === "first")!;
    const second = run.nodes.find((n) => n.nodeId === "second")!;
    expect(first.state).toBe("completed");
    expect(second.state).toBe("completed");
    expect(second.startedAt!.getTime()).toBeGreaterThanOrEqual(first.startedAt!.getTime());
  });

  it("executes a parallel-fan-out workflow", async () => {
    const wf = await createWorkflow({
      name: "Parallel",
      nodes: [
        makeNode({ id: "root", type: "http" }),
        makeNode({ id: "branch1", type: "http", dependsOn: ["root"] }),
        makeNode({ id: "branch2", type: "http", dependsOn: ["root"] }),
      ],
    });
    const run = await executeWorkflow(wf.id);
    expect(run.state).toBe("completed");
    expect(run.nodes.every((n) => n.state === "completed")).toBe(true);
  });

  it("marks downstream nodes as skipped when an upstream node fails", async () => {
    setNodeExecutor("http", async () => { throw new Error("upstream 500"); });
    const wf = await createWorkflow({
      name: "Skip Cascade",
      nodes: [
        makeNode({ id: "fail", type: "http" }),
        makeNode({ id: "downstream", type: "http", dependsOn: ["fail"] }),
      ],
    });
    const run = await executeWorkflow(wf.id);
    const failNode = run.nodes.find((n) => n.nodeId === "fail")!;
    const downNode = run.nodes.find((n) => n.nodeId === "downstream")!;
    expect(failNode.state).toBe("failed");
    expect(downNode.state).toBe("skipped");
    expect(run.state).toBe("failed");
  });

  it("evaluates a condition node with a true expression", async () => {
    const wf = await createWorkflow({
      name: "Condition",
      nodes: [makeNode({ id: "cond", type: "condition", config: { expression: "x > 5" } })],
    });
    const run = await executeWorkflow(wf.id, { x: 10 });
    const cond = run.nodes.find((n) => n.nodeId === "cond")!;
    expect(cond.state).toBe("completed");
    expect((cond.output as { branch: number }).branch).toBe(1);
  });

  it("evaluates a condition node with a false expression", async () => {
    const wf = await createWorkflow({
      name: "Condition False",
      nodes: [makeNode({ id: "cond", type: "condition", config: { expression: "x > 5" } })],
    });
    const run = await executeWorkflow(wf.id, { x: 1 });
    const cond = run.nodes.find((n) => n.nodeId === "cond")!;
    expect((cond.output as { branch: number }).branch).toBe(0);
  });

  it("executes a code node", async () => {
    const wf = await createWorkflow({
      name: "Code",
      nodes: [makeNode({ id: "calc", type: "code", config: { code: "return variables.a + variables.b;", language: "javascript" } })],
    });
    const run = await executeWorkflow(wf.id, { a: 2, b: 3 });
    const node = run.nodes.find((n) => n.nodeId === "calc")!;
    expect(node.state).toBe("completed");
    expect(node.output).toBe(5);
  });

  it("refuses code node when TALOS_WORKFLOW_CODE_ENABLED is not set", async () => {
    const prev = process.env["TALOS_WORKFLOW_CODE_ENABLED"];
    delete process.env["TALOS_WORKFLOW_CODE_ENABLED"];
    try {
      const wf = await createWorkflow({
        name: "CodeGated",
        nodes: [makeNode({ id: "calc", type: "code", config: { code: "return 1;", language: "javascript" } })],
      });
      const run = await executeWorkflow(wf.id);
      const node = run.nodes.find((n) => n.nodeId === "calc")!;
      expect(node.state).toBe("failed");
      expect(node.error).toMatch(/disabled/);
    } finally {
      if (prev !== undefined) process.env["TALOS_WORKFLOW_CODE_ENABLED"] = prev;
    }
  });

  it("rejects creation of agent node with missing config", async () => {
    await expect(
      createWorkflow({ name: "Bad Agent", nodes: [makeNode({ id: "agent", type: "agent" })] })
    ).rejects.toThrow();
  });

  it("retries a node on failure when maxRetries > 0", async () => {
    setNodeExecutor("http", async () => { throw new Error("always fails"); });
    const wf = await createWorkflow({
      name: "Retry",
      nodes: [
        makeNode({ id: "flaky", type: "http", maxRetries: 2, retryOn: ["error"] }),
      ],
    });
    const run = await executeWorkflow(wf.id);
    const node = run.nodes.find((n) => n.nodeId === "flaky")!;
    expect(node.state).toBe("failed");
    expect(node.attempts).toBe(3);
  });

  it("retrieves a run by id", async () => {
    const wf = await createWorkflow({
      name: "GetRun",
      nodes: [makeNode({ id: "n", type: "http" })],
    });
    const run = await executeWorkflow(wf.id);
    const fetched = getRun(run.runId);
    expect(fetched).toBeDefined();
    expect(fetched?.runId).toBe(run.runId);
  });

  it("runs an agent node via the mock executor", async () => {
    const wf = await createWorkflow({
      name: "Agent",
      nodes: [makeNode({ id: "ag", type: "agent", config: { agentId: "test-agent", prompt: "hi" } })],
    });
    const run = await executeWorkflow(wf.id);
    const node = run.nodes.find((n) => n.nodeId === "ag")!;
    expect(node.state).toBe("completed");
    expect((node.output as { provider: string }).provider).toBe("mock");
  });

  it("runs a plugin node via the mock executor", async () => {
    const wf = await createWorkflow({
      name: "Plugin",
      nodes: [makeNode({ id: "pl", type: "plugin", config: { endpointId: "ep1", tool: "do-thing" } })],
    });
    const run = await executeWorkflow(wf.id);
    const node = run.nodes.find((n) => n.nodeId === "pl")!;
    expect(node.state).toBe("completed");
  });

  it("runs a loop node and respects maxIterations", async () => {
    const wf = await createWorkflow({
      name: "Loop",
      nodes: [makeNode({ id: "lp", type: "loop", config: { iterSource: "items", maxIterations: 3 } })],
    });
    const run = await executeWorkflow(wf.id, { items: [1, 2, 3, 4, 5] });
    const node = run.nodes.find((n) => n.nodeId === "lp")!;
    expect(node.state).toBe("completed");
    expect((node.output as { iterations: number }).iterations).toBe(3);
  });

  it("runs a parallel node", async () => {
    const wf = await createWorkflow({
      name: "Parallel Marker",
      nodes: [makeNode({ id: "par", type: "parallel", config: { branches: 4 } })],
    });
    const run = await executeWorkflow(wf.id);
    const node = run.nodes.find((n) => n.nodeId === "par")!;
    expect(node.state).toBe("completed");
    expect((node.output as { parallelBranches: number }).parallelBranches).toBe(4);
  });

  it("runs a council node via the mock executor", async () => {
    const wf = await createWorkflow({
      name: "Council",
      nodes: [makeNode({
        id: "c",
        type: "council",
        config: { proposal: { title: "Test", description: "Desc" } },
      })],
    });
    const run = await executeWorkflow(wf.id);
    const node = run.nodes.find((n) => n.nodeId === "c")!;
    expect(node.state).toBe("completed");
  });

  it("fails when agentId is missing at execution time", async () => {
    setNodeExecutor("agent", async () => { throw new Error("no agentId"); });
    const wf = await createWorkflow({
      name: "BadExecAgent",
      nodes: [makeNode({ id: "ag", type: "agent", config: { agentId: "bad-actor" } })],
    });
    const run = await executeWorkflow(wf.id);
    const node = run.nodes.find((n) => n.nodeId === "ag")!;
    expect(node.state).toBe("failed");
  });
});

describe("Workflow — Persistence", () => {
  it("stores workflow on disk after creation", async () => {
    const wf = await createWorkflow({ name: "Persist", nodes: [makeNode()] });
    const loaded = await persistLoad(wf.id);
    expect(loaded).toBeDefined();
    expect(loaded?.id).toBe(wf.id);
    expect(loaded?.name).toBe("Persist");
  });

  it("lists persisted workflows", async () => {
    await createWorkflow({ name: "A", nodes: [makeNode({ id: "a" })] });
    await createWorkflow({ name: "B", nodes: [makeNode({ id: "b" })] });
    const list = await persistList();
    expect(list.length).toBeGreaterThanOrEqual(2);
  });

  it("stores run on disk after execution", async () => {
    const wf = await createWorkflow({
      name: "RunPersist",
      nodes: [makeNode({ id: "n", type: "http" })],
    });
    const run = await executeWorkflow(wf.id);
    const loaded = await persistLoadRun(run.runId);
    expect(loaded).toBeDefined();
    expect(loaded?.state).toBe("completed");
  });

  it("lists persisted runs", async () => {
    const wf = await createWorkflow({
      name: "ListRuns",
      nodes: [makeNode({ id: "n", type: "http" })],
    });
    await executeWorkflow(wf.id);
    const runs = await persistListRuns(wf.id);
    expect(runs.length).toBeGreaterThan(0);
  });

  it("removes a workflow from disk and memory", async () => {
    const wf = await createWorkflow({ name: "Rem", nodes: [makeNode({ id: "r" })] });
    const removed = await removeWorkflow(wf.id);
    expect(removed).toBe(true);
    expect(getWorkflow(wf.id)).toBeUndefined();
    const loaded = await persistLoad(wf.id);
    expect(loaded).toBeNull();
  });

  it("exposes the store directory", () => {
    const dir = getStoreDir();
    expect(dir).toContain("talos-workflow-");
  });

  it("lists workflows via engine API", async () => {
    await createWorkflow({ name: "X", nodes: [makeNode({ id: "x" })] });
    const list = await listAllWorkflows();
    expect(list.length).toBeGreaterThan(0);
  });

  it("lists runs via engine API", async () => {
    const wf = await createWorkflow({
      name: "EngineListRuns",
      nodes: [makeNode({ id: "n", type: "http" })],
    });
    await executeWorkflow(wf.id);
    const runs = await listAllRuns(wf.id);
    expect(runs.length).toBeGreaterThan(0);
  });
});

describe("Workflow — sub_workflow node", () => {
  it("validates a sub_workflow node with subWorkflowId", () => {
    const result = validateWorkflow({
      name: "sub-wf",
      nodes: [
        makeNode({
          id: "child",
          type: "sub_workflow",
          config: { subWorkflowId: "abc-123" },
        }),
      ],
    });
    expect(result.valid).toBe(true);
  });

  it("rejects sub_workflow node without subWorkflowId", () => {
    const result = validateWorkflow({
      name: "sub-wf-bad",
      nodes: [
        makeNode({
          id: "child",
          type: "sub_workflow",
          config: {},
        }),
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "missing_required_config")).toBe(true);
  });

  it("executes a sub_workflow node and returns child run summary", async () => {
    setNodeExecutor("sub_workflow", async (ctx) => ({
      childRunId: "child-run-1",
      childState: "completed",
      childError: undefined,
      childNodeCount: 3,
      _parentRunId: ctx.run.runId,
    }));
    const wf = await createWorkflow({
      name: "SubWorkflowRun",
      nodes: [
        makeNode({
          id: "sw",
          type: "sub_workflow",
          config: { subWorkflowId: "some-other-wf", passThrough: { foo: "bar" } },
        }),
      ],
    });
    const run = await executeWorkflow(wf.id);
    expect(run.state).toBe("completed");
    const nodeRun = run.nodes.find((n) => n.nodeId === "sw")!;
    expect(nodeRun.state).toBe("completed");
    expect(nodeRun.output).toMatchObject({ childRunId: "child-run-1", childState: "completed" });
  });
});

describe("Workflow — graphify node", () => {
  it("validates a graphify node with entity filter", () => {
    const result = validateWorkflow({
      name: "gf",
      nodes: [
        makeNode({
          id: "g",
          type: "graphify",
          config: { graphifyEntity: "WorkflowEngine" },
        }),
      ],
    });
    expect(result.valid).toBe(true);
  });

  it("rejects graphify node with neither entity nor predicate", () => {
    const result = validateWorkflow({
      name: "gf-bad",
      nodes: [
        makeNode({
          id: "g",
          type: "graphify",
          config: {},
        }),
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "missing_required_config")).toBe(true);
  });

  it("executes a graphify node and returns matched triples", async () => {
    setNodeExecutor("graphify", async () => ({
      count: 2,
      triples: [
        { id: "t1", subject: "A", predicate: "depends_on", object: "B" },
        { id: "t2", subject: "B", predicate: "uses", object: "C" },
      ],
    }));
    const wf = await createWorkflow({
      name: "GraphifyRun",
      nodes: [
        makeNode({
          id: "g",
          type: "graphify",
          config: { graphifyEntity: "WorkflowEngine", graphifyLimit: 50 },
        }),
      ],
    });
    const run = await executeWorkflow(wf.id);
    expect(run.state).toBe("completed");
    const nodeRun = run.nodes.find((n) => n.nodeId === "g")!;
    expect(nodeRun.state).toBe("completed");
    expect((nodeRun.output as { count: number }).count).toBe(2);
  });
});

describe("Workflow — Template Resolution", () => {
  it("resolves simple variable", () => {
    expect(resolveVariables("hello {{name}}", { name: "world" })).toBe("hello world");
  });

  it("resolves dotted path", () => {
    const vars = { node1: { output: { body: "content here" } } };
    expect(resolveVariables("{{node1.output.body}}", vars)).toBe("content here");
  });

  it("resolves multiple placeholders", () => {
    const result = resolveVariables("{{a}} and {{b}}", { a: "X", b: "Y" });
    expect(result).toBe("X and Y");
  });

  it("stringifies non-string values", () => {
    expect(resolveVariables("count: {{n}}", { n: 42 })).toBe("count: 42");
    expect(resolveVariables("data: {{d}}", { d: { key: "val" } })).toBe('data: {"key":"val"}');
  });

  it("leaves unresolved references as-is", () => {
    expect(resolveVariables("{{missing}}", {})).toBe("{{missing}}");
    expect(resolveVariables("{{a.b.c}}", { a: {} })).toBe("{{a.b.c}}");
  });

  it("handles hyphenated node IDs in paths", () => {
    const vars = { "fetch-source": { output: { status: 200 } } };
    expect(resolveVariables("{{fetch-source.output.status}}", vars)).toBe("200");
  });

  it("injects node output into run.variables after completion", async () => {
    const captured: Record<string, unknown>[] = [];
    setNodeExecutor("agent", async (ctx) => {
      captured.push({ ...ctx.variables });
      return { provider: "mock", output: "agent-result", model: "mock" };
    });
    const wf = await createWorkflow({
      name: "OutputInjection",
      nodes: [
        makeNode({ id: "step1", type: "http" }),
        makeNode({ id: "step2", type: "agent", config: { agentId: "test", prompt: "go" }, dependsOn: ["step1"] }),
      ],
    });
    const run = await executeWorkflow(wf.id);
    expect(run.state).toBe("completed");
    // step2's mock executor should have seen step1's output in variables
    expect(captured.length).toBe(1);
    expect(captured[0]!["step1"]).toBeDefined();
  });

  it("resolves {{variable}} in agent prompt config", async () => {
    let receivedPrompt = "";
    setNodeExecutor("agent", async (ctx) => {
      const node = ctx.workflow.nodes.find((n) => n.id === ctx.nodeRun.nodeId)!;
      receivedPrompt = node.config.prompt ?? "";
      return { provider: "mock", output: "ok", model: "mock" };
    });
    const wf = await createWorkflow({
      name: "PromptResolve",
      nodes: [
        makeNode({ id: "ag", type: "agent", config: { agentId: "test", prompt: "Summarize: {{content}}" } }),
      ],
    });
    const run = await executeWorkflow(wf.id, { content: "hello world" });
    expect(run.state).toBe("completed");
    expect(receivedPrompt).toBe("Summarize: hello world");
  });

  it("resolves {{nodeId.field}} in agent prompt", async () => {
    let receivedPrompt = "";
    setNodeExecutor("http", async () => ({ status: 200, ok: true, body: "fetched data" }));
    setNodeExecutor("agent", async (ctx) => {
      const node = ctx.workflow.nodes.find((n) => n.id === ctx.nodeRun.nodeId)!;
      receivedPrompt = node.config.prompt ?? "";
      return { provider: "mock", output: "ok", model: "mock" };
    });
    const wf = await createWorkflow({
      name: "NodeOutputResolve",
      nodes: [
        makeNode({ id: "fetch", type: "http" }),
        makeNode({ id: "summarize", type: "agent", config: { agentId: "test", prompt: "Summarize: {{fetch.body}}" }, dependsOn: ["fetch"] }),
      ],
    });
    const run = await executeWorkflow(wf.id);
    expect(run.state).toBe("completed");
    expect(receivedPrompt).toBe("Summarize: fetched data");
  });

  it("resolves {{variable}} in http node url", async () => {
    let receivedUrl = "";
    setNodeExecutor("http", async (ctx) => {
      const node = ctx.workflow.nodes.find((n) => n.id === ctx.nodeRun.nodeId)!;
      receivedUrl = node.config.url ?? "";
      return { status: 200, ok: true, body: {} };
    });
    const wf = await createWorkflow({
      name: "UrlResolve",
      nodes: [
        makeNode({ id: "h", type: "http", config: { url: "https://api.example.com/{{path}}" } }),
      ],
    });
    const run = await executeWorkflow(wf.id, { path: "users/123" });
    expect(run.state).toBe("completed");
    expect(receivedUrl).toBe("https://api.example.com/users/123");
  });

  it("resolves {{variable}} in graphify entity", async () => {
    let receivedEntity = "";
    setNodeExecutor("graphify", async (ctx) => {
      const node = ctx.workflow.nodes.find((n) => n.id === ctx.nodeRun.nodeId)!;
      receivedEntity = node.config.graphifyEntity ?? "";
      return { added: true, triple: {} };
    });
    const wf = await createWorkflow({
      name: "GraphifyResolve",
      nodes: [
        makeNode({ id: "g", type: "graphify", config: { graphifyAction: "add", graphifyEntity: "{{topic}}" } }),
      ],
    });
    const run = await executeWorkflow(wf.id, { topic: "TalosOS" });
    expect(run.state).toBe("completed");
    expect(receivedEntity).toBe("TalosOS");
  });

  it("restores original config after execution (persistence integrity)", async () => {
    setNodeExecutor("agent", async () => ({ provider: "mock", output: "ok", model: "mock" }));
    const wf = await createWorkflow({
      name: "ConfigRestore",
      nodes: [
        makeNode({ id: "ag", type: "agent", config: { agentId: "test", prompt: "Hello {{name}}" } }),
      ],
    });
    await executeWorkflow(wf.id, { name: "World" });
    // After execution, the stored workflow should still have the template
    const stored = getWorkflow(wf.id)!;
    expect(stored.nodes[0]!.config.prompt).toBe("Hello {{name}}");
  });

  it("unresolved placeholders pass through literally", async () => {
    let receivedPrompt = "";
    setNodeExecutor("agent", async (ctx) => {
      const node = ctx.workflow.nodes.find((n) => n.id === ctx.nodeRun.nodeId)!;
      receivedPrompt = node.config.prompt ?? "";
      return { provider: "mock", output: "ok", model: "mock" };
    });
    const wf = await createWorkflow({
      name: "Unresolved",
      nodes: [
        makeNode({ id: "ag", type: "agent", config: { agentId: "test", prompt: "Use {{missing_var}}" } }),
      ],
    });
    const run = await executeWorkflow(wf.id);
    expect(run.state).toBe("completed");
    expect(receivedPrompt).toBe("Use {{missing_var}}");
  });
});
