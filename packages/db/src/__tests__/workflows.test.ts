import { describe, it, expect, beforeEach } from "vitest";
import {
  saveWorkflowToDb,
  loadWorkflowFromDb,
  listWorkflowsFromDb,
  deleteWorkflowFromDb,
  saveRunToDb,
  loadRunFromDb,
  listRunsFromDb,
  type WorkflowsDbClient,
  type WorkflowDefinitionDb,
  type WorkflowRunDb,
} from "../workflows.js";

interface WorkflowRow {
  id: string;
  name: string;
  description: string;
  version: string;
  definition: WorkflowDefinitionDb;
  variables: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface RunRow {
  run_id: string;
  workflow_id: string;
  workflow_name: string;
  state: string;
  variables: Record<string, unknown>;
  triggered_by: string;
  error: string | null;
  started_at: string;
  completed_at: string | null;
}

interface LogRow {
  run_id: string;
  node_id: string;
  state: string;
  attempts: number;
  output: unknown;
  error: string | null;
  duration_ms: number;
  created_at: string;
}

function makeMockClient(): {
  client: WorkflowsDbClient;
  workflows: WorkflowRow[];
  runs: RunRow[];
  logs: LogRow[];
} {
  const workflows: WorkflowRow[] = [];
  const runs: RunRow[] = [];
  const logs: LogRow[] = [];
  const client: WorkflowsDbClient = {
    from(table: string) {
      return {
        insert: (payload: unknown) => {
          if (table === "talos_workflows") {
            const row = payload as WorkflowRow;
            workflows.push({ ...row });
            return {
              select: () => ({
                single: async () => ({ data: row, error: null }),
              }),
            };
          }
          if (table === "talos_workflow_runs") {
            const row = payload as RunRow;
            runs.push({ ...row });
            return {
              select: () => ({
                single: async () => ({ data: row, error: null }),
              }),
            };
          }
          if (table === "talos_run_logs") {
            const row = payload as LogRow;
            logs.push({ ...row });
            return {
              select: () => ({
                single: async () => ({ data: row, error: null }),
              }),
            };
          }
          return {
            select: () => ({
              single: async () => ({ data: null, error: { message: "unknown table" } }),
            }),
          };
        },
        select: () => ({
          eq(col: string, val: unknown) {
            const eqResult = {
              single: async () => {
                if (table === "talos_workflows") {
                  const match = workflows.find((w) => (w as Record<string, unknown>)[col] === val);
                  return { data: match ?? null, error: match ? null : { message: "not found" } };
                }
                if (table === "talos_workflow_runs") {
                  const match = runs.find((r) => (r as Record<string, unknown>)[col] === val);
                  return { data: match ?? null, error: match ? null : { message: "not found" } };
                }
                return { data: null, error: { message: "unknown table" } };
              },
              order() {
                return {
                  limit: async () => {
                    if (table === "talos_workflows") {
                      let filtered = [...workflows];
                      if (col === "id") filtered = filtered.filter((w) => w.id === val);
                      return { data: filtered.map((w) => ({ id: w.id, name: w.name, updated_at: w.updated_at })), error: null };
                    }
                    if (table === "talos_workflow_runs") {
                      let filtered = [...runs];
                      if (col === "workflow_id") filtered = filtered.filter((r) => r.workflow_id === val);
                      return { data: filtered, error: null };
                    }
                    if (table === "talos_run_logs") {
                      const filtered = logs.filter((l) => l.run_id === val);
                      return { data: filtered, error: null };
                    }
                    return { data: [], error: null };
                  },
                };
              },
            };
            // Make the eq() result itself thenable so `await query.eq(...)` works
            return Object.assign(eqResult, {
              then: (resolve: (v: unknown) => void) => {
                if (table === "talos_run_logs") {
                  const filtered = logs.filter((l) => (l as Record<string, unknown>)[col] === val);
                  return resolve({ data: filtered, error: null });
                }
                if (table === "talos_workflows") {
                  const filtered = workflows.filter((w) => (w as Record<string, unknown>)[col] === val);
                  return resolve({ data: filtered, error: null });
                }
                if (table === "talos_workflow_runs") {
                  const filtered = runs.filter((r) => (r as Record<string, unknown>)[col] === val);
                  return resolve({ data: filtered, error: null });
                }
                return resolve({ data: [], error: null });
              },
            });
          },
          order() {
            return {
              limit: async () => {
                if (table === "talos_workflows") {
                  return { data: workflows.map((w) => ({ id: w.id, name: w.name, updated_at: w.updated_at })), error: null };
                }
                if (table === "talos_workflow_runs") {
                  return { data: runs, error: null };
                }
                return { data: [], error: null };
              },
            };
          },
        }),
        update: (patch: unknown) => {
          return {
            eq(col: string, val: unknown) {
              return {
                select: () => ({
                  single: async () => {
                    const target = workflows.find((w) => (w as Record<string, unknown>)[col] === val);
                    if (target) Object.assign(target, patch);
                    return { data: target ?? null, error: target ? null : { message: "not found" } };
                  },
                }),
              };
            },
          };
        },
        delete: () => {
          return {
            eq: async (col: string, val: unknown) => {
              const idx = workflows.findIndex((w) => (w as Record<string, unknown>)[col] === val);
              if (idx >= 0) {
                workflows.splice(idx, 1);
                return { error: null };
              }
              return { error: { message: "not found" } };
            },
          };
        },
      };
    },
  };
  return { client, workflows, runs, logs };
}

function makeWorkflow(overrides: Partial<WorkflowDefinitionDb> = {}): WorkflowDefinitionDb {
  return {
    id: "wf-1",
    name: "Test Workflow",
    description: "test",
    version: "1.0.0",
    variables: { foo: "bar" },
    createdAt: new Date("2026-06-05T10:00:00Z"),
    updatedAt: new Date("2026-06-05T10:00:00Z"),
    nodes: [],
    ...overrides,
  };
}

function makeRun(overrides: Partial<WorkflowRunDb> = {}): WorkflowRunDb {
  return {
    runId: "run-1",
    workflowId: "wf-1",
    workflowName: "Test Workflow",
    state: "completed",
    variables: { foo: "bar" },
    triggeredBy: "api",
    startedAt: new Date("2026-06-05T10:01:00Z"),
    completedAt: new Date("2026-06-05T10:02:00Z"),
    nodes: [
      { nodeId: "n1", state: "completed", attempts: 1, durationMs: 1000 },
    ],
    ...overrides,
  };
}

describe("@talos/db — workflows module", () => {
  let mock: ReturnType<typeof makeMockClient>;
  beforeEach(() => {
    mock = makeMockClient();
  });

  it("saveWorkflowToDb persists a workflow", async () => {
    const wf = makeWorkflow();
    await saveWorkflowToDb(wf, mock.client);
    expect(mock.workflows).toHaveLength(1);
    expect(mock.workflows[0]?.name).toBe("Test Workflow");
  });

  it("loadWorkflowFromDb returns the workflow or null", async () => {
    const wf = makeWorkflow();
    await saveWorkflowToDb(wf, mock.client);
    const loaded = await loadWorkflowFromDb("wf-1", mock.client);
    expect(loaded).not.toBeNull();
    expect(loaded?.id).toBe("wf-1");

    const missing = await loadWorkflowFromDb("nope", mock.client);
    expect(missing).toBeNull();
  });

  it("listWorkflowsFromDb returns all workflows", async () => {
    await saveWorkflowToDb(makeWorkflow({ id: "a" }), mock.client);
    await saveWorkflowToDb(makeWorkflow({ id: "b" }), mock.client);
    const list = await listWorkflowsFromDb(mock.client);
    expect(list).toHaveLength(2);
  });

  it("deleteWorkflowFromDb removes a workflow", async () => {
    await saveWorkflowToDb(makeWorkflow(), mock.client);
    const deleted = await deleteWorkflowFromDb("wf-1", mock.client);
    expect(deleted).toBe(true);
    expect(mock.workflows).toHaveLength(0);
  });

  it("saveRunToDb persists run and writes per-node logs", async () => {
    const run = makeRun({
      nodes: [
        { nodeId: "n1", state: "completed", attempts: 1, durationMs: 500 },
        { nodeId: "n2", state: "skipped", attempts: 0, durationMs: 0 },
      ],
    });
    await saveRunToDb(run, mock.client);
    expect(mock.runs).toHaveLength(1);
    expect(mock.logs).toHaveLength(2);
    expect(mock.logs.find((l) => l.node_id === "n1")?.state).toBe("completed");
    expect(mock.logs.find((l) => l.node_id === "n2")?.state).toBe("skipped");
  });

  it("loadRunFromDb returns the run with its node logs", async () => {
    await saveRunToDb(makeRun(), mock.client);
    const loaded = await loadRunFromDb("run-1", mock.client);
    expect(loaded).not.toBeNull();
    expect(loaded?.state).toBe("completed");
    expect(loaded?.nodes).toHaveLength(1);
    expect(loaded?.nodes[0]?.nodeId).toBe("n1");
  });

  it("listRunsFromDb returns runs filtered by workflowId", async () => {
    await saveRunToDb(makeRun({ runId: "r1", workflowId: "wf-1" }), mock.client);
    await saveRunToDb(makeRun({ runId: "r2", workflowId: "wf-2" }), mock.client);
    const all = await listRunsFromDb(undefined, mock.client);
    expect(all).toHaveLength(2);
    const filtered = await listRunsFromDb("wf-1", mock.client);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.runId).toBe("r1");
  });
});
