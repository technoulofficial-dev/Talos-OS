/**
 * Workflows - Supabase-backed persistence for Talos workflows.
 * Mirrors the talos_workflows, talos_workflow_runs, talos_run_logs tables
 * (blueprint §3.5, §20). Optional client injection pattern (same as skills.ts).
 *
 * NOTE: Structural types are defined locally to avoid @talos/db depending on
 * @talos/core. Core's persistence.ts maps its own types to these shapes.
 */

import { getSupabaseClient, type SupabaseClient } from "./client.js";

export type NodeStateDb = "pending" | "running" | "completed" | "failed" | "skipped";
export type WorkflowStateDb = "draft" | "pending" | "running" | "completed" | "failed" | "cancelled";

export interface NodeRunStateDb {
  nodeId: string;
  state: NodeStateDb;
  attempts: number;
  output?: unknown;
  error?: string;
  durationMs: number;
  startedAt?: Date;
  completedAt?: Date;
}

export interface WorkflowRunDb {
  runId: string;
  workflowId: string;
  workflowName: string;
  state: WorkflowStateDb;
  variables: Record<string, unknown>;
  triggeredBy: string;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
  nodes: NodeRunStateDb[];
}

export interface WorkflowDefinitionDb {
  id: string;
  name: string;
  description: string;
  version: string;
  variables: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  nodes: unknown[];
}

export interface WorkflowsDbClient {
  // Loose typing: supabase client chains are deeply generic; we only model
  // the calls we make. Cast through `unknown` in resolveClient.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
}

function resolveClient(client?: SupabaseClient | WorkflowsDbClient): WorkflowsDbClient {
  return (client ?? getSupabaseClient()) as unknown as WorkflowsDbClient;
}

function serializeWorkflow(wf: WorkflowDefinitionDb): Record<string, unknown> {
  return {
    id: wf.id,
    name: wf.name,
    description: wf.description,
    version: wf.version,
    definition: wf,
    variables: wf.variables,
    created_at: wf.createdAt.toISOString(),
    updated_at: wf.updatedAt.toISOString(),
  };
}

function deserializeWorkflow(row: Record<string, unknown>): WorkflowDefinitionDb {
  const def = row["definition"] as WorkflowDefinitionDb;
  return {
    ...def,
    id: row["id"] as string,
    name: row["name"] as string,
    description: (row["description"] as string) ?? "",
    version: (row["version"] as string) ?? "1.0.0",
    variables: (row["variables"] as Record<string, unknown>) ?? {},
    createdAt: new Date(row["created_at"] as string),
    updatedAt: new Date(row["updated_at"] as string),
  };
}

function serializeRun(run: WorkflowRunDb): Record<string, unknown> {
  return {
    run_id: run.runId,
    workflow_id: run.workflowId,
    workflow_name: run.workflowName,
    state: run.state,
    variables: run.variables,
    triggered_by: run.triggeredBy,
    error: run.error ?? null,
    started_at: run.startedAt.toISOString(),
    completed_at: run.completedAt ? run.completedAt.toISOString() : null,
  };
}

function deserializeRun(row: Record<string, unknown>, nodes: NodeRunStateDb[]): WorkflowRunDb {
  return {
    runId: row["run_id"] as string,
    workflowId: row["workflow_id"] as string,
    workflowName: row["workflow_name"] as string,
    state: row["state"] as WorkflowStateDb,
    variables: (row["variables"] as Record<string, unknown>) ?? {},
    triggeredBy: (row["triggered_by"] as string) ?? "api",
    error: (row["error"] as string) ?? undefined,
    startedAt: new Date(row["started_at"] as string),
    completedAt: row["completed_at"] ? new Date(row["completed_at"] as string) : undefined,
    nodes,
  };
}

export async function saveWorkflowToDb(
  workflow: WorkflowDefinitionDb,
  client?: SupabaseClient | WorkflowsDbClient
): Promise<void> {
  const c = resolveClient(client);
  const { error } = await c
    .from("talos_workflows")
    .insert(serializeWorkflow(workflow))
    .select()
    .single();
  if (error) throw new Error(`Failed to save workflow: ${error.message}`);
}

export async function loadWorkflowFromDb(
  id: string,
  client?: SupabaseClient | WorkflowsDbClient
): Promise<WorkflowDefinitionDb | null> {
  const c = resolveClient(client);
  const { data, error } = await c
    .from("talos_workflows")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  if (!data) return null;
  return deserializeWorkflow(data as Record<string, unknown>);
}

export async function listWorkflowsFromDb(
  client?: SupabaseClient | WorkflowsDbClient
): Promise<Array<{ id: string; name: string; updatedAt: string }>> {
  const c = resolveClient(client);
  const { data, error } = await c
    .from("talos_workflows")
    .select("id, name, updated_at")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`Failed to list workflows: ${error.message}`);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r["id"] as string,
    name: r["name"] as string,
    updatedAt: r["updated_at"] as string,
  }));
}

export async function deleteWorkflowFromDb(
  id: string,
  client?: SupabaseClient | WorkflowsDbClient
): Promise<boolean> {
  const c = resolveClient(client);
  const { error } = await c.from("talos_workflows").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete workflow: ${error.message}`);
  return true;
}

export async function saveRunToDb(
  run: WorkflowRunDb,
  client?: SupabaseClient | WorkflowsDbClient
): Promise<void> {
  const c = resolveClient(client);
  const { error } = await c
    .from("talos_workflow_runs")
    .insert(serializeRun(run))
    .select()
    .single();
  if (error) throw new Error(`Failed to save run: ${error.message}`);

  if (run.nodes.length > 0) {
    const logRows = run.nodes.map((n) => ({
      run_id: run.runId,
      node_id: n.nodeId,
      state: n.state,
      attempts: n.attempts,
      output: n.output ?? null,
      error: n.error ?? null,
      duration_ms: n.durationMs,
    }));
    for (const row of logRows) {
      const { error: logErr } = await c.from("talos_run_logs").insert(row);
      if (logErr) {
        // Non-fatal: log entry creation shouldn't fail the run
        // eslint-disable-next-line no-console
        console.warn(`talos_run_logs insert warning: ${logErr.message}`);
      }
    }
  }
}

export async function loadRunFromDb(
  runId: string,
  client?: SupabaseClient | WorkflowsDbClient
): Promise<WorkflowRunDb | null> {
  const c = resolveClient(client);
  const { data, error } = await c
    .from("talos_workflow_runs")
    .select("*")
    .eq("run_id", runId)
    .single();
  if (error) return null;
  if (!data) return null;
  const row = data as Record<string, unknown>;
  const nodes = await loadRunLogs(runId, c);
  return deserializeRun(row, nodes);
}

async function loadRunLogs(
  runId: string,
  c: WorkflowsDbClient
): Promise<NodeRunStateDb[]> {
  const { data, error } = await c
    .from("talos_run_logs")
    .select("node_id, state, attempts, output, error, duration_ms, created_at")
    .eq("run_id", runId);
  if (error) return [];
  return (data ?? []).map((r: Record<string, unknown>) => {
    const out: NodeRunStateDb = {
      nodeId: r["node_id"] as string,
      state: r["state"] as NodeStateDb,
      attempts: (r["attempts"] as number) ?? 0,
      output: r["output"] ?? undefined,
      error: (r["error"] as string) ?? undefined,
      durationMs: (r["duration_ms"] as number) ?? 0,
    };
    const startedAt = r["created_at"] as string | undefined;
    if (startedAt) {
      out.startedAt = new Date(startedAt);
      out.completedAt = new Date(startedAt);
    }
    return out;
  });
}

export async function listRunsFromDb(
  workflowId: string | undefined,
  client?: SupabaseClient | WorkflowsDbClient
): Promise<Array<{ runId: string; workflowId: string; state: string; startedAt: string }>> {
  const c = resolveClient(client);
  let query = c.from("talos_workflow_runs").select("run_id, workflow_id, state, started_at");
  if (workflowId) {
    const { data, error } = await query
      .eq("workflow_id", workflowId)
      .order("started_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(`Failed to list runs: ${error.message}`);
    return (data ?? []).map((r: Record<string, unknown>) => ({
      runId: r["run_id"] as string,
      workflowId: r["workflow_id"] as string,
      state: r["state"] as string,
      startedAt: r["started_at"] as string,
    }));
  }
  const { data, error } = await query
    .order("started_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`Failed to list runs: ${error.message}`);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    runId: r["run_id"] as string,
    workflowId: r["workflow_id"] as string,
    state: r["state"] as string,
    startedAt: r["started_at"] as string,
  }));
}
