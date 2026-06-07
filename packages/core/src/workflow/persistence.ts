import { readFile, writeFile, mkdir, readdir, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { WorkflowDefinition, WorkflowRun } from "./types.js";

/**
 * Workflow persistence with two backends:
 * - JSON files at .talos/workflows/ (default; tested with __setStoreDir)
 * - Supabase via @talos/db (when TALOS_WORKFLOW_DB_ENABLED=true)
 *
 * The dual-mode strategy keeps the existing 37+ workflow tests passing
 * unchanged (they don't set the env flag) while letting production deploy
 * with real database persistence matching blueprint §3.5/§20.
 *
 * In DB mode, the file-system helpers become no-ops and `getStoreDir()`
 * returns a sentinel ("supabase://talos_workflows") for diagnostic use.
 */

function dbEnabled(): boolean {
  return process.env["TALOS_WORKFLOW_DB_ENABLED"] === "true";
}

let dbModulePromise: Promise<typeof import("@talos/db")> | null = null;
async function loadDb() {
  if (!dbModulePromise) {
    dbModulePromise = import("@talos/db");
  }
  return dbModulePromise;
}

function defaultStoreDir(): string {
  if (dbEnabled()) return "supabase://talos_workflows";
  const env = process.env["TALOS_WORKFLOW_DIR"];
  return env ?? join(process.cwd(), ".talos", "workflows");
}

let storeDir: string = defaultStoreDir();
let indexFile: string = dbEnabled() ? "" : join(storeDir, "_index.json");

function getIndexFile(): string { return indexFile; }

interface WorkflowIndex {
  workflows: Array<{ id: string; name: string; updatedAt: string }>;
  runs: Array<{ runId: string; workflowId: string; state: string; startedAt: string }>;
}

let indexCache: WorkflowIndex | null = null;

async function ensureDir(): Promise<void> {
  if (dbEnabled()) return;
  const dir = getStoreDir();
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

export async function loadIndex(): Promise<WorkflowIndex> {
  if (dbEnabled()) {
    return { workflows: [], runs: [] };
  }
  if (indexCache) return indexCache;
  await ensureDir();
  try {
    const raw = await readFile(getIndexFile(), "utf-8");
    indexCache = JSON.parse(raw) as WorkflowIndex;
    return indexCache;
  } catch {
    indexCache = { workflows: [], runs: [] };
    return indexCache;
  }
}

async function saveIndex(): Promise<void> {
  if (dbEnabled()) return;
  if (!indexCache) return;
  await ensureDir();
  await writeFile(getIndexFile(), JSON.stringify(indexCache, null, 2), "utf-8");
}

function workflowPath(id: string): string {
  return join(getStoreDir(), `workflow-${id}.json`);
}

function runPath(id: string): string {
  return join(getStoreDir(), `run-${id}.json`);
}

export async function saveWorkflow(workflow: WorkflowDefinition): Promise<void> {
  if (dbEnabled()) {
    const db = await loadDb();
    await db.saveWorkflowToDb(workflow as unknown as import("@talos/db").WorkflowDefinitionDb);
    return;
  }
  await ensureDir();
  await writeFile(workflowPath(workflow.id), JSON.stringify(workflow, null, 2), "utf-8");
  const idx = await loadIndex();
  const existing = idx.workflows.findIndex((w) => w.id === workflow.id);
  const entry = { id: workflow.id, name: workflow.name, updatedAt: workflow.updatedAt.toISOString() };
  if (existing >= 0) {
    idx.workflows[existing] = entry;
  } else {
    idx.workflows.push(entry);
  }
  await saveIndex();
}

export async function loadWorkflow(id: string): Promise<WorkflowDefinition | null> {
  if (dbEnabled()) {
    const db = await loadDb();
    return (await db.loadWorkflowFromDb(id)) as unknown as WorkflowDefinition | null;
  }
  try {
    const raw = await readFile(workflowPath(id), "utf-8");
    const data = JSON.parse(raw) as Omit<WorkflowDefinition, "createdAt" | "updatedAt"> & {
      createdAt: string;
      updatedAt: string;
    };
    return {
      ...data,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
    };
  } catch {
    return null;
  }
}

export async function listWorkflows(): Promise<Array<{ id: string; name: string; updatedAt: string }>> {
  if (dbEnabled()) {
    const db = await loadDb();
    return db.listWorkflowsFromDb();
  }
  const idx = await loadIndex();
  return idx.workflows;
}

export async function deleteWorkflow(id: string): Promise<boolean> {
  if (dbEnabled()) {
    const db = await loadDb();
    return db.deleteWorkflowFromDb(id);
  }
  try {
    await unlink(workflowPath(id));
    const idx = await loadIndex();
    const before = idx.workflows.length;
    idx.workflows = idx.workflows.filter((w) => w.id !== id);
    if (idx.workflows.length < before) {
      await saveIndex();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function saveRun(run: WorkflowRun): Promise<void> {
  if (dbEnabled()) {
    const db = await loadDb();
    await db.saveRunToDb(run as unknown as import("@talos/db").WorkflowRunDb);
    return;
  }
  await ensureDir();
  await writeFile(runPath(run.runId), JSON.stringify(run, null, 2), "utf-8");
  const idx = await loadIndex();
  const existing = idx.runs.findIndex((r) => r.runId === run.runId);
  const entry = {
    runId: run.runId,
    workflowId: run.workflowId,
    state: run.state,
    startedAt: run.startedAt.toISOString(),
  };
  if (existing >= 0) {
    idx.runs[existing] = entry;
  } else {
    idx.runs.push(entry);
  }
  await saveIndex();
}

export async function loadRun(runId: string): Promise<WorkflowRun | null> {
  if (dbEnabled()) {
    const db = await loadDb();
    return (await db.loadRunFromDb(runId)) as unknown as WorkflowRun | null;
  }
  try {
    const raw = await readFile(runPath(runId), "utf-8");
    const data = JSON.parse(raw) as Omit<WorkflowRun, "startedAt" | "completedAt" | "nodes"> & {
      startedAt: string;
      completedAt?: string;
      nodes: Array<Omit<WorkflowRun["nodes"][number], "startedAt" | "completedAt"> & {
        startedAt?: string;
        completedAt?: string;
      }>;
    };
    return {
      ...data,
      startedAt: new Date(data.startedAt),
      completedAt: data.completedAt ? new Date(data.completedAt) : undefined,
      nodes: data.nodes.map((n) => ({
        ...n,
        startedAt: n.startedAt ? new Date(n.startedAt) : undefined,
        completedAt: n.completedAt ? new Date(n.completedAt) : undefined,
      })),
    };
  } catch {
    return null;
  }
}

export async function listRuns(workflowId?: string): Promise<Array<{ runId: string; workflowId: string; state: string; startedAt: string }>> {
  if (dbEnabled()) {
    const db = await loadDb();
    return db.listRunsFromDb(workflowId);
  }
  const idx = await loadIndex();
  return workflowId ? idx.runs.filter((r) => r.workflowId === workflowId) : idx.runs;
}

export function clearCache(): void {
  indexCache = null;
}

export function getStoreDir(): string {
  return storeDir;
}

export function __setStoreDir(dir: string): void {
  storeDir = dir;
  indexFile = join(dir, "_index.json");
  indexCache = null;
}

export async function listWorkflowFiles(): Promise<string[]> {
  if (dbEnabled()) return [];
  const dir = getStoreDir();
  if (!existsSync(dir)) return [];
  const files = await readdir(dir);
  return files.filter((f) => f.startsWith("workflow-") && f.endsWith(".json"));
}
