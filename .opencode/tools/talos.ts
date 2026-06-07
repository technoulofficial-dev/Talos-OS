import { tool } from "@opencode-ai/plugin";
import { execSync } from "child_process";
import { readdirSync } from "fs";
import { join } from "path";

function run(cmd: string): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execSync(cmd, { cwd: process.cwd(), encoding: "utf-8", timeout: 120000 });
    return { stdout, stderr: "", exitCode: 0 };
  } catch (e: any) {
    return {
      stdout: e.stdout || "",
      stderr: e.stderr || e.message || "",
      exitCode: e.status || 1,
    };
  }
}

export const runBuild = tool({
  description: "Build one or all Talos OS packages",
  args: {
    package: tool.schema.string().optional().describe("Package name (core, db, cli, memory, ui) or omit for all"),
  },
  async execute(args) {
    const filter = args.package ? `--filter @talos/${args.package}` : "";
    const cmd = filter ? `pnpm ${filter} build` : "pnpm -r build";
    const result = run(`cmd /c "${cmd}"`);
    if (result.exitCode !== 0) {
      return `Build failed (exit ${result.exitCode}):\n${result.stderr.slice(0, 2000) || result.stdout.slice(0, 2000)}`;
    }
    return `Build succeeded for ${args.package || "all packages"}`;
  },
});

export const runTests = tool({
  description: "Run tests for Talos OS packages",
  args: {
    package: tool.schema.string().optional().describe("Package name (core, db, cli, memory, ui) or omit for all"),
    watch: tool.schema.boolean().optional().default(false).describe("Run in watch mode"),
  },
  async execute(args) {
    const watchFlag = args.watch ? " --watch" : "";
    const filter = args.package ? `--filter @talos/${args.package}` : "";
    const cmd = filter
      ? `pnpm ${filter} test${watchFlag}`
      : `pnpm test${watchFlag}`;
    const result = run(`cmd /c "${cmd}"`);
    if (result.exitCode !== 0) {
      return `Tests failed (exit ${result.exitCode}):\n${result.stderr.slice(0, 2000) || result.stdout.slice(0, 2000)}`;
    }
    return `Tests passed for ${args.package || "all packages"}`;
  },
});

export const checkHealth = tool({
  description: "Check Talos OS project health (build passes)",
  args: {},
  async execute() {
    const result = run('cmd /c "pnpm -r build"');
    const health = { build: result.exitCode === 0 ? "PASS" : "FAIL" };
    if (result.exitCode !== 0) {
      (health as any).error = result.stderr.slice(0, 1000) || result.stdout.slice(0, 1000);
    }
    return JSON.stringify(health, null, 2);
  },
});

export const listAgents = tool({
  description: "List all Talos OS internal agent directories",
  args: {},
  async execute() {
    const agentsDir = join(process.cwd(), "talos-agents");
    try {
      const entries = readdirSync(agentsDir, { withFileTypes: true });
      const agents = entries
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .filter((n) => n !== ".git")
        .sort();
      return agents.length > 0 ? agents.join("\n") : "No agents found";
    } catch {
      return "talos-agents directory not found";
    }
  },
});
