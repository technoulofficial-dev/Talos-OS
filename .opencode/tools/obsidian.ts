import { tool } from "@opencode-ai/plugin";
import { readFile, writeFile, mkdir, readdir } from "fs/promises";
import { existsSync } from "fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function resolveVaultPath(): string {
  const envPath = process.env["TALOS_VAULT_PATH"];
  if (envPath) return envPath;
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const workspaceRoot = resolve(here, "..", "..");
    return join(workspaceRoot, ".talos-notes");
  } catch {
    return join(process.cwd(), ".talos-notes");
  }
}

const DEFAULT_VAULT = resolveVaultPath();

async function findMdFiles(dir: string, prefix = ""): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (entry.name !== ".git" && entry.name !== "node_modules") {
        files.push(...(await findMdFiles(join(dir, entry.name), rel)));
      }
    } else if (entry.name.endsWith(".md")) {
      files.push(rel);
    }
  }
  return files;
}

export const readNote = tool({
  description: "Read a markdown note from the vault",
  args: {
    path: tool.schema.string().describe("Path to note relative to vault (e.g., 'architecture/decisions.md')"),
  },
  async execute(args) {
    const fullPath = join(DEFAULT_VAULT, args.path);
    if (!existsSync(fullPath)) return `Note not found: ${args.path}`;
    return await readFile(fullPath, "utf-8");
  },
});

export const writeNote = tool({
  description: "Write a markdown note to the vault",
  args: {
    path: tool.schema.string().describe("Path to note relative to vault (e.g., 'architecture/decisions.md')"),
    content: tool.schema.string().describe("Markdown content"),
  },
  async execute(args) {
    const fullPath = join(DEFAULT_VAULT, args.path);
    const parentDir = dirname(fullPath);
    if (!existsSync(parentDir)) {
      await mkdir(parentDir, { recursive: true });
    }
    await writeFile(fullPath, args.content, "utf-8");
    return `Written: ${args.path}`;
  },
});

export const listNotes = tool({
  description: "List all markdown notes in the vault",
  args: {},
  async execute() {
    if (!existsSync(DEFAULT_VAULT)) return "No vault directory found (.talos-notes). Create one with writeNote first.";
    const files = await findMdFiles(DEFAULT_VAULT);
    if (files.length === 0) return "No notes found";
    return files.sort().join("\n");
  },
});

export const searchNotes = tool({
  description: "Search notes by keyword",
  args: {
    query: tool.schema.string().describe("Search keyword or phrase"),
  },
  async execute(args) {
    if (!existsSync(DEFAULT_VAULT)) return `No vault directory found`;
    const files = await findMdFiles(DEFAULT_VAULT);
    const results: { file: string; snippet: string }[] = [];
    for (const file of files) {
      const content = await readFile(join(DEFAULT_VAULT, file), "utf-8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(args.query.toLowerCase())) {
          results.push({ file, snippet: lines[i].trim().slice(0, 200) });
          break;
        }
      }
    }
    if (results.length === 0) return `No matches for "${args.query}"`;
    return JSON.stringify(results, null, 2);
  },
});
