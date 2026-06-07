import { tool } from "@opencode-ai/plugin";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

interface Triple {
  id: string;
  subject: string;
  predicate: string;
  object: string;
  context?: string;
  createdAt: string;
  weight: number;
}

interface Learning {
  subject: string;
  predicate: string;
  object: string;
  context?: string;
}

function resolveWorkspaceRoot(): string {
  const envRoot = process.env["TALOS_WORKSPACE_ROOT"];
  if (envRoot) return envRoot;
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    return resolve(here, "..", "..");
  } catch {
    return process.cwd();
  }
}

const ROOT = resolveWorkspaceRoot();
const GRAPHIFY_PATH = join(ROOT, ".talos", "graphify.json");
const VAULT_PATH = join(ROOT, ".talos-notes");
const SESSION_DIR = join(VAULT_PATH, "session");
const AGENTS_PATH = join(ROOT, "AGENTS.md");

function nowIso(): string {
  return new Date().toISOString();
}

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

async function readTriples(): Promise<Triple[]> {
  try {
    const raw = await readFile(GRAPHIFY_PATH, "utf-8");
    return JSON.parse(raw) as Triple[];
  } catch {
    return [];
  }
}

async function writeTriples(triples: Triple[]): Promise<void> {
  const dir = dirname(GRAPHIFY_PATH);
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  await writeFile(GRAPHIFY_PATH, JSON.stringify(triples, null, 2), "utf-8");
}

async function listRecentSessionLogs(limit: number): Promise<string[]> {
  if (!existsSync(SESSION_DIR)) return [];
  try {
    const files = (await readdir(SESSION_DIR))
      .filter((f) => f.endsWith(".md"))
      .sort()
      .reverse();
    return files.slice(0, limit);
  } catch {
    return [];
  }
}

async function readLastSessionLog(): Promise<{ path: string; content: string } | null> {
  const files = await listRecentSessionLogs(1);
  if (files.length === 0) return null;
  const filename = files[0]!;
  try {
    const content = await readFile(join(SESSION_DIR, filename), "utf-8");
    return { path: filename, content };
  } catch {
    return null;
  }
}

function parseAgentsHeadings(content: string, maxLines = 30): string {
  const lines = content.split("\n");
  const headings: string[] = [];
  for (const line of lines) {
    if (line.startsWith("# ") || line.startsWith("## ") || line.startsWith("### ")) {
      headings.push(line);
      if (headings.length >= maxLines) break;
    }
  }
  return headings.join("\n");
}

function buildSessionMarkdown(
  input: { summary: string; decisions?: string[]; learnings?: Learning[]; nextSteps?: string[]; tags?: string[] },
  date: string
): string {
  const lines: string[] = [];
  lines.push(`# Session Log — ${date}`);
  lines.push("");
  lines.push(`**Ended:** ${nowIso()}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(input.summary);
  lines.push("");
  if (input.decisions && input.decisions.length > 0) {
    lines.push("## Key Decisions");
    lines.push("");
    for (const d of input.decisions) lines.push(`- ${d}`);
    lines.push("");
  }
  if (input.learnings && input.learnings.length > 0) {
    lines.push("## Learnings");
    lines.push("");
    for (const l of input.learnings) {
      const ctx = l.context ? ` *(${l.context})*` : "";
      lines.push(`- \`${l.subject} --[${l.predicate}]--> ${l.object}\`${ctx}`);
    }
    lines.push("");
  }
  if (input.nextSteps && input.nextSteps.length > 0) {
    lines.push("## Next Steps");
    lines.push("");
    for (const n of input.nextSteps) lines.push(`- [ ] ${n}`);
    lines.push("");
  }
  if (input.tags && input.tags.length > 0) {
    lines.push("## Tags");
    lines.push("");
    lines.push(input.tags.map((t) => `#${t}`).join(" "));
    lines.push("");
  }
  return lines.join("\n");
}

export const sessionStart = tool({
  description:
    "Opencode session start ritual: load recent knowledge graph triples, last obsidian session log, and AGENTS.md headings. Returns a context summary to seed the session.",
  args: {
    tripleLimit: tool.schema.number().optional().default(20).describe("How many recent graphify triples to load (default 20)"),
    sessionLogLimit: tool.schema.number().optional().default(3).describe("How many recent session logs to list (default 3)"),
  },
  async execute(args) {
    const tripleLimit = args.tripleLimit ?? 20;
    const sessionLogLimit = args.sessionLogLimit ?? 3;
    const triples = await readTriples();
    const recentTriples = [...triples]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, tripleLimit);
    const sessionLogs = await listRecentSessionLogs(sessionLogLimit);
    const lastLog = await readLastSessionLog();
    let agentsHeadings = "(AGENTS.md not found)";
    try {
      const agentsContent = await readFile(AGENTS_PATH, "utf-8");
      agentsHeadings = parseAgentsHeadings(agentsContent, 30);
    } catch { /* keep default */ }
    return JSON.stringify({
      startedAt: nowIso(),
      date: todayStamp(),
      knowledgeGraph: { totalTriples: triples.length, recentCount: recentTriples.length, recentTriples },
      obsidianVault: {
        sessionLogsFound: sessionLogs.length,
        recentSessionLogs: sessionLogs,
        lastSessionLog: lastLog ? { path: lastLog.path, preview: lastLog.content.slice(0, 1500) } : null,
      },
      projectRules: { agentsMdHeadings: agentsHeadings },
      recommendations: [
        "Read the recent triples to recall architecture decisions from prior sessions",
        "Skim the last session log to understand what was just completed",
        "Use `load_skill` for any task matching a skill description (code-architect before design, code-reviewer after impl, etc.)",
        "Record every significant decision via `graphify_addKnowledge`",
      ],
    }, null, 2);
  },
});

export const sessionEnd = tool({
  description:
    "Opencode session end ritual: capture summary to a dated obsidian session log, optionally persist learnings to the knowledge graph, and return a handoff bundle for the next session.",
  args: {
    summary: tool.schema.string().describe("One-paragraph summary of what was accomplished this session"),
    decisions: tool.schema.array(tool.schema.string()).optional().describe("Key decisions made this session"),
    learnings: tool.schema
      .array(
        tool.schema.object({
          subject: tool.schema.string(),
          predicate: tool.schema.string(),
          object: tool.schema.string(),
          context: tool.schema.string().optional(),
        })
      )
      .optional()
      .describe("Knowledge graph triples to persist from this session"),
    nextSteps: tool.schema.array(tool.schema.string()).optional().describe("Actionable next steps for the next session"),
    tags: tool.schema.array(tool.schema.string()).optional().describe("Tags for indexing"),
    persistToGraph: tool.schema.boolean().optional().default(true).describe("Write learnings to graphify.json (default true)"),
    writeSessionLog: tool.schema.boolean().optional().default(true).describe("Write dated session log to .talos-notes/session/ (default true)"),
  },
  async execute(args) {
    const date = todayStamp();
    const createdTripleIds: string[] = [];
    if ((args.persistToGraph ?? true) && args.learnings && args.learnings.length > 0) {
      const triples = await readTriples();
      for (const l of args.learnings) {
        const triple: Triple = {
          id: randomUUID(),
          subject: l.subject,
          predicate: l.predicate,
          object: l.object,
          context: l.context,
          createdAt: nowIso(),
          weight: 1,
        };
        triples.push(triple);
        createdTripleIds.push(triple.id);
      }
      await writeTriples(triples);
    }
    let sessionLogPath: string | null = null;
    if (args.writeSessionLog ?? true) {
      if (!existsSync(SESSION_DIR)) await mkdir(SESSION_DIR, { recursive: true });
      const filename = `${date}-session.md`;
      await writeFile(
        join(SESSION_DIR, filename),
        buildSessionMarkdown(
          { summary: args.summary, decisions: args.decisions, learnings: args.learnings, nextSteps: args.nextSteps, tags: args.tags },
          date
        ),
        "utf-8"
      );
      sessionLogPath = filename;
    }
    return JSON.stringify({
      endedAt: nowIso(),
      date,
      sessionLogPath,
      persistedTripleCount: createdTripleIds.length,
      persistedTripleIds: createdTripleIds,
      stats: {
        decisions: args.decisions?.length ?? 0,
        learnings: args.learnings?.length ?? 0,
        nextSteps: args.nextSteps?.length ?? 0,
      },
      nextSessionPrompt: `Start with \`talos_sessionStart\` to load prior context. Review session log at \`.talos-notes/session/${sessionLogPath ?? date + "-session.md"}\`.`,
    }, null, 2);
  },
});

export const captureLearning = tool({
  description:
    "Mid-session helper: persist a single learning triple to the knowledge graph. Use this for significant discoveries or decisions that should survive across sessions.",
  args: {
    subject: tool.schema.string().describe("Subject entity"),
    predicate: tool.schema.string().describe("Relation/predicate"),
    object: tool.schema.string().describe("Object entity"),
    context: tool.schema.string().optional().describe("Optional context or source"),
  },
  async execute(args) {
    const triples = await readTriples();
    const triple: Triple = {
      id: randomUUID(),
      subject: args.subject,
      predicate: args.predicate,
      object: args.object,
      context: args.context,
      createdAt: nowIso(),
      weight: 1,
    };
    triples.push(triple);
    await writeTriples(triples);
    return JSON.stringify(triple, null, 2);
  },
});
