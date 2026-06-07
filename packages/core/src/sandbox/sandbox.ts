/**
 * Sandbox executor - runs untrusted code in an isolated Docker container.
 * No network access by default. Auto-destroyed after execution.
 *
 * Part of the security architecture described in Section 13.1 of the blueprint.
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";

const execAsync = promisify(exec);

export interface SandboxConfig {
  code: string;
  language?: "javascript" | "typescript" | "python" | "bash";
  dependencies?: string[];
  timeoutMs?: number;
  networkAccess?: boolean;
  memoryLimitMb?: number;
  cpuLimit?: number;
}

export interface SandboxResult {
  containerId: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  killed: boolean;
}

/**
 * Execute untrusted code in an isolated Docker sandbox.
 * Network is blocked by default. Container is destroyed after execution.
 */
export async function executeSandbox(config: SandboxConfig): Promise<SandboxResult> {
  const containerId = `talos-sandbox-${randomUUID().slice(0, 8)}`;
  const start = Date.now();
  const language = config.language ?? "javascript";
  const timeoutMs = config.timeoutMs ?? 30_000;
  const memoryLimitMb = config.memoryLimitMb ?? 512;
  const cpuLimit = config.cpuLimit ?? 1.0;

  try {
    // Write code to temp file
    const codePath = await writeCodeToTemp(config.code, language);

    // Docker run with strict isolation
    const dockerArgs = [
      "run",
      "--rm",
      "--name",
      containerId,
      "-m",
      `${memoryLimitMb}m`,
      "--cpus",
      cpuLimit.toString(),
      ...(config.networkAccess ? [] : ["--network", "none"]),
      "--read-only",
      "--tmpfs",
      "/tmp:size=64m",
      "-v",
      `${codePath}:/code.${getExtension(language)}:ro`,
      "talos-sandbox-runner:latest",
      "node",
      `/code.${getExtension(language)}`,
    ];

    const { stdout, stderr } = await execAsync(
      `docker ${dockerArgs.map((a) => `"${a.replace(/"/g, '\\"')}"`).join(" ")}`,
      { timeout: timeoutMs }
    );

    return {
      containerId,
      exitCode: 0,
      stdout,
      stderr,
      durationMs: Date.now() - start,
      killed: false,
    };
  } catch (err: unknown) {
    const execError = err as { code?: number; stdout?: string; stderr?: string; killed?: boolean };
    return {
      containerId,
      exitCode: execError.code ?? 1,
      stdout: execError.stdout ?? "",
      stderr: execError.stderr ?? (err as Error).message,
      durationMs: Date.now() - start,
      killed: execError.killed ?? false,
    };
  } finally {
    // Always destroy the container
    try {
      await execAsync(`docker rm -f ${containerId} 2>/dev/null || true`);
    } catch {
      // Container may have already been auto-removed with --rm
    }
  }
}

async function writeCodeToTemp(code: string, language: string): Promise<string> {
  const { writeFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const path = `${tmpdir()}/talos-sandbox-${randomUUID().slice(0, 8)}.${getExtension(language)}`;
  await writeFile(path, code, "utf-8");
  return path;
}

function getExtension(language: string): string {
  const map: Record<string, string> = {
    javascript: "js",
    typescript: "ts",
    python: "py",
    bash: "sh",
  };
  return map[language] ?? "js";
}