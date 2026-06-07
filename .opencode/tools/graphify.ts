import { tool } from "@opencode-ai/plugin";
import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface Triple {
  id: string;
  subject: string;
  predicate: string;
  object: string;
  context?: string;
  createdAt: string;
  weight: number;
}

function resolveStorePath(): string {
  const envPath = process.env["TALOS_GRAPHIFY_PATH"];
  if (envPath) return envPath;
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const workspaceRoot = resolve(here, "..", "..");
    return join(workspaceRoot, ".talos", "graphify.json");
  } catch {
    return join(process.cwd(), ".talos", "graphify.json");
  }
}

const STORE_PATH = resolveStorePath();

async function ensureStore(): Promise<void> {
  const dir = dirname(STORE_PATH);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

async function loadTriples(): Promise<Triple[]> {
  try {
    const data = await readFile(STORE_PATH, "utf-8");
    return JSON.parse(data) as Triple[];
  } catch {
    return [];
  }
}

async function saveTriples(triples: Triple[]): Promise<void> {
  await ensureStore();
  await writeFile(STORE_PATH, JSON.stringify(triples, null, 2), "utf-8");
}

export const addKnowledge = tool({
  description: "Store a knowledge triple (entity-relation-entity) in the Talos knowledge graph",
  args: {
    subject: tool.schema.string().describe("Subject entity (e.g., 'OdinAgent')"),
    predicate: tool.schema.string().describe("Relation/predicate (e.g., 'depends_on')"),
    object: tool.schema.string().describe("Object entity (e.g., 'AiEngine')"),
    context: tool.schema.string().optional().describe("Optional context or source reference"),
  },
  async execute(args) {
    const triples = await loadTriples();
    const triple: Triple = {
      id: randomUUID(),
      subject: args.subject,
      predicate: args.predicate,
      object: args.object,
      context: args.context,
      createdAt: new Date().toISOString(),
      weight: 1,
    };
    triples.push(triple);
    await saveTriples(triples);
    return JSON.stringify(triple, null, 2);
  },
});

export const queryKnowledge = tool({
  description: "Query the Talos knowledge graph by entity, relation, subject, or object",
  args: {
    entity: tool.schema.string().optional().describe("Filter by subject or object entity (partial match)"),
    predicate: tool.schema.string().optional().describe("Filter by relation/predicate (partial match)"),
    subject: tool.schema.string().optional().describe("Filter by subject (partial match)"),
    object: tool.schema.string().optional().describe("Filter by object (partial match)"),
    limit: tool.schema.number().optional().default(100).describe("Max results"),
    offset: tool.schema.number().optional().default(0).describe("Result offset"),
  },
  async execute(args) {
    const triples = await loadTriples();
    let results: Triple[] = triples;
    if (args.entity) {
      const term = args.entity.toLowerCase();
      results = results.filter(
        (t) => t.subject.toLowerCase().includes(term) || t.object.toLowerCase().includes(term)
      );
    }
    if (args.predicate) {
      const term = args.predicate.toLowerCase();
      results = results.filter((t) => t.predicate.toLowerCase().includes(term));
    }
    if (args.subject) {
      const term = args.subject.toLowerCase();
      results = results.filter((t) => t.subject.toLowerCase().includes(term));
    }
    if (args.object) {
      const term = args.object.toLowerCase();
      results = results.filter((t) => t.object.toLowerCase().includes(term));
    }
    const limit = args.limit ?? 100;
    const offset = args.offset ?? 0;
    results = results.slice(offset, offset + limit);
    if (results.length === 0) return "No results found in knowledge graph.";
    return JSON.stringify(results, null, 2);
  },
});

export const getGraphStats = tool({
  description: "Get statistics about the knowledge graph",
  args: {},
  async execute() {
    const triples = await loadTriples();
    const subjects = new Set(triples.map((t) => t.subject));
    const predicates = new Set(triples.map((t) => t.predicate));
    const objects = new Set(triples.map((t) => t.object));
    let totalWeight = 0;
    const byPredicate: Record<string, number> = {};
    for (const t of triples) {
      totalWeight += t.weight;
      byPredicate[t.predicate] = (byPredicate[t.predicate] ?? 0) + 1;
    }
    return JSON.stringify(
      {
        totalTriples: triples.length,
        uniqueSubjects: subjects.size,
        uniquePredicates: predicates.size,
        uniqueObjects: objects.size,
        totalWeight,
        byPredicate,
      },
      null,
      2
    );
  },
});
