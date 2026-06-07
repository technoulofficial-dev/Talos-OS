/**
 * Session ritual core — pure data layer for the opencode session start/end tools.
 *
 * Lives in @talos/core so it can be unit-tested under vitest. The opencode
 * tool wrapper at `.opencode/tools/session.ts` is a thin shell that calls
 * into this module.
 */

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { getOrCreateUserIdentity } from "../identity/user.js";

export interface Triple {
  id: string;
  subject: string;
  predicate: string;
  object: string;
  context?: string;
  createdAt: string;
  weight: number;
}

export interface Learning {
  subject: string;
  predicate: string;
  object: string;
  context?: string;
}

export interface SessionStartResult {
  startedAt: string;
  date: string;
  userId: string;
  knowledgeGraph: {
    totalTriples: number;
    recentCount: number;
    recentTriples: Triple[];
  };
  obsidianVault: {
    sessionLogsFound: number;
    recentSessionLogs: string[];
    lastSessionLog: { path: string; preview: string } | null;
  };
  projectRules: {
    agentsMdHeadings: string;
  };
  recommendations: string[];
}

export interface SessionEndInput {
  summary: string;
  decisions?: string[];
  learnings?: Learning[];
  nextSteps?: string[];
  tags?: string[];
  persistToGraph?: boolean;
  writeSessionLog?: boolean;
}

export interface SessionEndResult {
  endedAt: string;
  date: string;
  sessionLogPath: string | null;
  persistedTripleCount: number;
  persistedTripleIds: string[];
  stats: {
    decisions: number;
    learnings: number;
    nextSteps: number;
  };
  nextSessionPrompt: string;
}

export interface CaptureLearningInput {
  subject: string;
  predicate: string;
  object: string;
  context?: string;
}

export interface RitualPaths {
  workspaceRoot: string;
  graphifyPath: string;
  vaultPath: string;
  agentsPath: string;
  sessionDir: string;
}

export function resolveRitualPaths(workspaceRoot: string): RitualPaths {
  return {
    workspaceRoot,
    graphifyPath: join(workspaceRoot, ".talos", "graphify.json"),
    vaultPath: join(workspaceRoot, ".talos-notes"),
    agentsPath: join(workspaceRoot, "AGENTS.md"),
    sessionDir: join(workspaceRoot, ".talos-notes", "session"),
  };
}

export function resolveDefaultPaths(): RitualPaths {
  const envRoot = process.env["TALOS_WORKSPACE_ROOT"];
  if (envRoot) return resolveRitualPaths(envRoot);
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const workspaceRoot = resolve(here, "..", "..", "..", "..");
    return resolveRitualPaths(workspaceRoot);
  } catch {
    return resolveRitualPaths(process.cwd());
  }
}

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function readTriplesAt(path: string): Promise<Triple[]> {
  try {
    const raw = await readFile(path, "utf-8");
    return JSON.parse(raw) as Triple[];
  } catch {
    return [];
  }
}

export async function writeTriplesAt(path: string, triples: Triple[]): Promise<void> {
  const dir = dirname(path);
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  await writeFile(path, JSON.stringify(triples, null, 2), "utf-8");
}

export async function listRecentSessionLogsAt(sessionDir: string, limit: number): Promise<string[]> {
  if (!existsSync(sessionDir)) return [];
  try {
    const files = (await readdir(sessionDir))
      .filter((f) => f.endsWith(".md"))
      .sort()
      .reverse();
    return files.slice(0, limit);
  } catch {
    return [];
  }
}

export async function readLastSessionLogAt(sessionDir: string): Promise<{ path: string; content: string } | null> {
  const files = await listRecentSessionLogsAt(sessionDir, 1);
  if (files.length === 0) return null;
  const filename = files[0]!;
  const filepath = join(sessionDir, filename);
  try {
    const content = await readFile(filepath, "utf-8");
    return { path: filename, content };
  } catch {
    return null;
  }
}

export function parseAgentsHeadings(content: string, maxLines = 30): string {
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

export async function sessionStart(
  paths: RitualPaths = resolveDefaultPaths(),
  tripleLimit = 20,
  sessionLogLimit = 3
): Promise<SessionStartResult> {
  const identity = await getOrCreateUserIdentity();
  const triples = await readTriplesAt(paths.graphifyPath);
  const recentTriples = [...triples]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, tripleLimit);

  const sessionLogs = await listRecentSessionLogsAt(paths.sessionDir, sessionLogLimit);
  const lastLog = await readLastSessionLogAt(paths.sessionDir);

  let agentsHeadings = "(AGENTS.md not found)";
  try {
    const agentsContent = await readFile(paths.agentsPath, "utf-8");
    agentsHeadings = parseAgentsHeadings(agentsContent, 30);
  } catch {
    /* fall through to default */
  }

  return {
    startedAt: nowIso(),
    date: todayStamp(),
    userId: identity.userId,
    knowledgeGraph: {
      totalTriples: triples.length,
      recentCount: recentTriples.length,
      recentTriples,
    },
    obsidianVault: {
      sessionLogsFound: sessionLogs.length,
      recentSessionLogs: sessionLogs,
      lastSessionLog: lastLog
        ? { path: lastLog.path, preview: lastLog.content.slice(0, 1500) }
        : null,
    },
    projectRules: {
      agentsMdHeadings: agentsHeadings,
    },
    recommendations: [
      "Read the recent triples to recall architecture decisions from prior sessions",
      "Skim the last session log to understand what was just completed",
      "Use `load_skill` for any task matching a skill description (code-architect before design, code-reviewer after impl, etc.)",
      "Record every significant decision via `graphify_addKnowledge`",
    ],
  };
}

export function buildSessionMarkdown(input: SessionEndInput, date: string): string {
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
    for (const d of input.decisions) {
      lines.push(`- ${d}`);
    }
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
    for (const n of input.nextSteps) {
      lines.push(`- [ ] ${n}`);
    }
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

export async function sessionEnd(
  input: SessionEndInput,
  paths: RitualPaths = resolveDefaultPaths()
): Promise<SessionEndResult> {
  const date = todayStamp();
  const createdTripleIds: string[] = [];
  const persistToGraph = input.persistToGraph ?? true;
  const writeLog = input.writeSessionLog ?? true;

  if (persistToGraph && input.learnings && input.learnings.length > 0) {
    const triples = await readTriplesAt(paths.graphifyPath);
    for (const l of input.learnings) {
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
    await writeTriplesAt(paths.graphifyPath, triples);
  }

  let sessionLogPath: string | null = null;
  if (writeLog) {
    if (!existsSync(paths.sessionDir)) await mkdir(paths.sessionDir, { recursive: true });
    const filename = `${date}-session.md`;
    const filepath = join(paths.sessionDir, filename);
    const markdown = buildSessionMarkdown(input, date);
    await writeFile(filepath, markdown, "utf-8");
    sessionLogPath = filename;
  }

  return {
    endedAt: nowIso(),
    date,
    sessionLogPath,
    persistedTripleCount: createdTripleIds.length,
    persistedTripleIds: createdTripleIds,
    stats: {
      decisions: input.decisions?.length ?? 0,
      learnings: input.learnings?.length ?? 0,
      nextSteps: input.nextSteps?.length ?? 0,
    },
    nextSessionPrompt: `Start with \`talos_sessionStart\` to load prior context. Review session log at \`.talos-notes/session/${sessionLogPath ?? date + "-session.md"}\`.`,
  };
}

export async function captureLearning(
  input: CaptureLearningInput,
  paths: RitualPaths = resolveDefaultPaths()
): Promise<Triple> {
  const triples = await readTriplesAt(paths.graphifyPath);
  const triple: Triple = {
    id: randomUUID(),
    subject: input.subject,
    predicate: input.predicate,
    object: input.object,
    context: input.context,
    createdAt: nowIso(),
    weight: 1,
  };
  triples.push(triple);
  await writeTriplesAt(paths.graphifyPath, triples);
  return triple;
}
