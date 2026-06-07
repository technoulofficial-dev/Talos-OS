import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm, readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  sessionStart,
  sessionEnd,
  captureLearning,
  buildSessionMarkdown,
  parseAgentsHeadings,
  resolveRitualPaths,
  readTriplesAt,
  type Triple,
} from "../rituals/session.js";

let tempDir: string;
let originalEnv: Record<string, string | undefined>;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "talos-rituals-"));
  originalEnv = {
    TALOS_WORKSPACE_ROOT: process.env["TALOS_WORKSPACE_ROOT"],
    TALOS_GRAPHIFY_PATH: process.env["TALOS_GRAPHIFY_PATH"],
    TALOS_VAULT_PATH: process.env["TALOS_VAULT_PATH"],
  };
  process.env["TALOS_WORKSPACE_ROOT"] = tempDir;
  delete process.env["TALOS_GRAPHIFY_PATH"];
  delete process.env["TALOS_VAULT_PATH"];

  // Pin the system date so sessionEnd's todayStamp() returns 2026-06-05
  // deterministically (otherwise midnight-UTC rollover would break the test).
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-05T15:00:00.000Z"));

  const { mkdir, writeFile } = await import("node:fs/promises");
  await mkdir(join(tempDir, ".talos"), { recursive: true });
  await mkdir(join(tempDir, ".talos-notes", "session"), { recursive: true });
  await writeFile(
    join(tempDir, "AGENTS.md"),
    "# Project AGENTS\n## Code Standards\n### TypeScript\n## Commands\n## Session Log\n"
  );
});

afterEach(async () => {
  vi.useRealTimers();
  for (const [k, v] of Object.entries(originalEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  await rm(tempDir, { recursive: true, force: true });
});

function paths() {
  return resolveRitualPaths(tempDir);
}

describe("Rituals — Path Resolution", () => {
  it("resolves all four standard paths under the workspace root", () => {
    const p = paths();
    expect(p.workspaceRoot).toBe(tempDir);
    expect(p.graphifyPath).toBe(join(tempDir, ".talos", "graphify.json"));
    expect(p.vaultPath).toBe(join(tempDir, ".talos-notes"));
    expect(p.agentsPath).toBe(join(tempDir, "AGENTS.md"));
    expect(p.sessionDir).toBe(join(tempDir, ".talos-notes", "session"));
  });
});

describe("Rituals — parseAgentsHeadings", () => {
  it("extracts h1, h2, h3 headings", () => {
    const content = "# H1\n## H2\n### H3\ntext\n#### H4 ignored\n";
    const result = parseAgentsHeadings(content);
    expect(result).toContain("# H1");
    expect(result).toContain("## H2");
    expect(result).toContain("### H3");
    expect(result).not.toContain("#### H4");
  });

  it("returns empty string for content with no headings", () => {
    expect(parseAgentsHeadings("just text\nmore text")).toBe("");
  });

  it("respects maxLines limit", () => {
    const content = Array.from({ length: 50 }, (_, i) => `## Heading ${i}`).join("\n");
    const result = parseAgentsHeadings(content, 5);
    expect(result.split("\n")).toHaveLength(5);
  });
});

describe("Rituals — sessionStart", () => {
  it("returns the expected shape with empty knowledge graph and vault", async () => {
    const result = await sessionStart(paths());
    expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.startedAt).toBeDefined();
    expect(result.knowledgeGraph.totalTriples).toBe(0);
    expect(result.knowledgeGraph.recentTriples).toEqual([]);
    expect(result.obsidianVault.sessionLogsFound).toBe(0);
    expect(result.obsidianVault.lastSessionLog).toBeNull();
    expect(result.projectRules.agentsMdHeadings).toContain("# Project AGENTS");
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it("loads recent triples sorted by createdAt desc", async () => {
    const { writeFile } = await import("node:fs/promises");
    const triples: Triple[] = [
      { id: "1", subject: "Old", predicate: "p", object: "o", createdAt: "2025-01-01T00:00:00.000Z", weight: 1 },
      { id: "2", subject: "Newer", predicate: "p", object: "o", createdAt: "2026-01-01T00:00:00.000Z", weight: 1 },
      { id: "3", subject: "Newest", predicate: "p", object: "o", createdAt: "2026-06-01T00:00:00.000Z", weight: 1 },
    ];
    await writeFile(paths().graphifyPath, JSON.stringify(triples));
    const result = await sessionStart(paths(), 2, 3);
    expect(result.knowledgeGraph.totalTriples).toBe(3);
    expect(result.knowledgeGraph.recentCount).toBe(2);
    expect(result.knowledgeGraph.recentTriples[0]?.subject).toBe("Newest");
    expect(result.knowledgeGraph.recentTriples[1]?.subject).toBe("Newer");
  });

  it("lists recent session logs", async () => {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(join(paths().sessionDir, "2026-06-01-session.md"), "# Earlier");
    await writeFile(join(paths().sessionDir, "2026-06-05-session.md"), "# Latest");
    const result = await sessionStart(paths(), 5, 3);
    expect(result.obsidianVault.sessionLogsFound).toBe(2);
    expect(result.obsidianVault.recentSessionLogs[0]).toBe("2026-06-05-session.md");
    expect(result.obsidianVault.lastSessionLog?.path).toBe("2026-06-05-session.md");
    expect(result.obsidianVault.lastSessionLog?.preview).toContain("Latest");
  });

  it("handles missing AGENTS.md gracefully", async () => {
    const { unlink } = await import("node:fs/promises");
    await unlink(paths().agentsPath);
    const result = await sessionStart(paths());
    expect(result.projectRules.agentsMdHeadings).toBe("(AGENTS.md not found)");
  });
});

describe("Rituals — buildSessionMarkdown", () => {
  it("includes summary heading and body", () => {
    const md = buildSessionMarkdown({ summary: "Built workflow engine" }, "2026-06-05");
    expect(md).toContain("# Session Log — 2026-06-05");
    expect(md).toContain("## Summary");
    expect(md).toContain("Built workflow engine");
  });

  it("includes decisions section when provided", () => {
    const md = buildSessionMarkdown(
      { summary: "x", decisions: ["Use DAG", "JSON persistence"] },
      "2026-06-05"
    );
    expect(md).toContain("## Key Decisions");
    expect(md).toContain("- Use DAG");
    expect(md).toContain("- JSON persistence");
  });

  it("includes learnings as graphify triples", () => {
    const md = buildSessionMarkdown(
      {
        summary: "x",
        learnings: [
          { subject: "Workflow", predicate: "uses", object: "JSON" },
          { subject: "X", predicate: "p", object: "Y", context: "ctx" },
        ],
      },
      "2026-06-05"
    );
    expect(md).toContain("## Learnings");
    expect(md).toContain("`Workflow --[uses]--> JSON`");
    expect(md).toContain("`X --[p]--> Y` *(ctx)*");
  });

  it("includes next steps and tags", () => {
    const md = buildSessionMarkdown(
      {
        summary: "x",
        nextSteps: ["Build UI", "Write tests"],
        tags: ["phase2", "workflow"],
      },
      "2026-06-05"
    );
    expect(md).toContain("## Next Steps");
    expect(md).toContain("- [ ] Build UI");
    expect(md).toContain("## Tags");
    expect(md).toContain("#phase2 #workflow");
  });

  it("omits empty sections", () => {
    const md = buildSessionMarkdown({ summary: "x" }, "2026-06-05");
    expect(md).not.toContain("## Key Decisions");
    expect(md).not.toContain("## Learnings");
    expect(md).not.toContain("## Next Steps");
  });
});

describe("Rituals — sessionEnd", () => {
  it("writes a session log file and persists learnings", async () => {
    const result = await sessionEnd(
      {
        summary: "Tested rituals",
        decisions: ["Use pure data layer"],
        learnings: [
          { subject: "Rituals", predicate: "tested_by", object: "vitest" },
        ],
        nextSteps: ["Build UI"],
      },
      paths()
    );
    expect(result.sessionLogPath).toBe("2026-06-05-session.md");
    expect(result.persistedTripleCount).toBe(1);
    expect(result.persistedTripleIds).toHaveLength(1);
    expect(result.stats.decisions).toBe(1);
    expect(result.stats.learnings).toBe(1);
    expect(result.stats.nextSteps).toBe(1);
    expect(result.nextSessionPrompt).toContain("talos_sessionStart");

    const logFile = join(paths().sessionDir, "2026-06-05-session.md");
    expect(existsSync(logFile)).toBe(true);
    const content = await readFile(logFile, "utf-8");
    expect(content).toContain("Tested rituals");
    expect(content).toContain("Use pure data layer");

    const triples = await readTriplesAt(paths().graphifyPath);
    expect(triples).toHaveLength(1);
    expect(triples[0]?.subject).toBe("Rituals");
  });

  it("skips persistence when persistToGraph=false", async () => {
    const result = await sessionEnd(
      { summary: "x", learnings: [{ subject: "A", predicate: "p", object: "B" }], persistToGraph: false },
      paths()
    );
    expect(result.persistedTripleCount).toBe(0);
    const triples = await readTriplesAt(paths().graphifyPath);
    expect(triples).toHaveLength(0);
  });

  it("skips log writing when writeSessionLog=false", async () => {
    const result = await sessionEnd(
      { summary: "x", writeSessionLog: false },
      paths()
    );
    expect(result.sessionLogPath).toBeNull();
    const files = await readdir(paths().sessionDir);
    expect(files.filter((f) => f.endsWith(".md"))).toHaveLength(0);
  });

  it("appends to existing graphify file rather than overwriting", async () => {
    const { writeFile } = await import("node:fs/promises");
    const existing: Triple[] = [
      { id: "pre-1", subject: "Pre", predicate: "p", object: "X", createdAt: "2025-01-01T00:00:00.000Z", weight: 1 },
    ];
    await writeFile(paths().graphifyPath, JSON.stringify(existing));
    await sessionEnd(
      { summary: "x", learnings: [{ subject: "New", predicate: "p", object: "Y" }] },
      paths()
    );
    const triples = await readTriplesAt(paths().graphifyPath);
    expect(triples).toHaveLength(2);
    expect(triples.find((t) => t.id === "pre-1")).toBeDefined();
  });
});

describe("Rituals — captureLearning", () => {
  it("adds a single triple to the knowledge graph", async () => {
    const triple = await captureLearning(
      { subject: "MidSession", predicate: "discovery", object: "X" },
      paths()
    );
    expect(triple.id).toBeDefined();
    expect(triple.subject).toBe("MidSession");
    const triples = await readTriplesAt(paths().graphifyPath);
    expect(triples).toHaveLength(1);
  });

  it("appends to existing triples", async () => {
    const { writeFile } = await import("node:fs/promises");
    const existing: Triple[] = [
      { id: "p", subject: "A", predicate: "p", object: "B", createdAt: "2025-01-01T00:00:00.000Z", weight: 1 },
    ];
    await writeFile(paths().graphifyPath, JSON.stringify(existing));
    await captureLearning({ subject: "C", predicate: "p", object: "D" }, paths());
    const triples = await readTriplesAt(paths().graphifyPath);
    expect(triples).toHaveLength(2);
  });
});
