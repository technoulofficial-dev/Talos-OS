import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import type { Triple, GraphQueryInput, GraphStats } from "./types.js";

const STORE_PATH = join(process.cwd(), ".talos", "graphify.json");
const triples: Triple[] = [];

export async function loadPersisted(): Promise<void> {
  if (triples.length > 0) return;
  try {
    const raw = await readFile(STORE_PATH, "utf-8");
    const data = JSON.parse(raw) as Triple[];
    triples.length = 0;
    triples.push(...data);
  } catch {
    // No persisted data yet
  }
}

async function persist(): Promise<void> {
  const dir = dirname(STORE_PATH);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  await writeFile(STORE_PATH, JSON.stringify(triples, null, 2), "utf-8");
}

export async function addTriple(
  subject: string,
  predicate: string,
  object: string,
  context?: string,
  weight?: number
): Promise<Triple> {
  await loadPersisted();
  const triple: Triple = {
    id: randomUUID(),
    subject,
    predicate,
    object,
    context,
    createdAt: new Date(),
    weight: weight ?? 1,
  };
  triples.push(triple);
  await persist();
  return triple;
}

export async function queryTriples(query: GraphQueryInput = {}): Promise<Triple[]> {
  await loadPersisted();
  const offset = query.offset ?? 0;
  const limit = query.limit ?? 100;
  let results = triples;
  if (query.entity) {
    const term = query.entity.toLowerCase();
    results = results.filter(
      (t) => t.subject.toLowerCase().includes(term) || t.object.toLowerCase().includes(term)
    );
  }
  if (query.predicate) {
    const term = query.predicate.toLowerCase();
    results = results.filter((t) => t.predicate.toLowerCase().includes(term));
  }
  if (query.subject) {
    const term = query.subject.toLowerCase();
    results = results.filter((t) => t.subject.toLowerCase().includes(term));
  }
  if (query.object) {
    const term = query.object.toLowerCase();
    results = results.filter((t) => t.object.toLowerCase().includes(term));
  }
  return results.slice(offset, offset + limit);
}

export async function getStats(): Promise<GraphStats> {
  await loadPersisted();
  const subjects = new Set<string>();
  const predicates = new Set<string>();
  const objects = new Set<string>();
  const byPredicate: Record<string, number> = {};
  let totalWeight = 0;

  for (const t of triples) {
    subjects.add(t.subject);
    predicates.add(t.predicate);
    objects.add(t.object);
    totalWeight += t.weight;
    byPredicate[t.predicate] = (byPredicate[t.predicate] ?? 0) + 1;
  }

  return {
    totalTriples: triples.length,
    uniqueSubjects: subjects.size,
    uniquePredicates: predicates.size,
    uniqueObjects: objects.size,
    totalWeight,
    byPredicate,
  };
}

export async function deleteTriple(id: string): Promise<boolean> {
  await loadPersisted();
  const idx = triples.findIndex((t) => t.id === id);
  if (idx === -1) return false;
  triples.splice(idx, 1);
  await persist();
  return true;
}

export async function clearGraph(): Promise<void> {
  triples.length = 0;
  await persist();
}

export async function searchByEntity(entity: string, limit = 50): Promise<Triple[]> {
  return queryTriples({ entity, limit });
}

export async function searchByPredicate(predicate: string, limit = 50): Promise<Triple[]> {
  return queryTriples({ predicate, limit });
}

export async function findPath(
  from: string,
  to: string,
  maxDepth = 4
): Promise<Array<Triple[]>> {
  await loadPersisted();
  const adjacency = new Map<string, Array<{ triple: Triple; depth: number }>>();
  for (const t of triples) {
    if (!adjacency.has(t.subject)) adjacency.set(t.subject, []);
    adjacency.get(t.subject)!.push({ triple: t, depth: 0 });
  }

  const paths: Array<Triple[]> = [];
  const visited = new Set<string>();

  function dfs(current: string, target: string, path: Triple[], depth: number): void {
    if (depth > maxDepth || visited.has(current)) return;
    if (current === target && path.length > 0) {
      paths.push([...path]);
      return;
    }
    visited.add(current);
    const neighbors = adjacency.get(current) ?? [];
    for (const { triple } of neighbors) {
      path.push(triple);
      dfs(triple.object, target, path, depth + 1);
      path.pop();
    }
    visited.delete(current);
  }

  dfs(from, to, [], 0);
  return paths;
}
