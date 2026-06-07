import { access, readFile, writeFile, unlink, readdir } from "node:fs/promises";
import { join, resolve, relative } from "node:path";
import type { ACPRequest, ACPResponse } from "../types/plugin.js";

const ALLOWED_BASE = resolve(process.cwd());
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function isPathAllowed(target: string): boolean {
  const resolved = resolve(target);
  return resolved.startsWith(ALLOWED_BASE);
}

export async function handleACP(request: ACPRequest): Promise<ACPResponse> {
  const start = Date.now();
  const targetPath = resolve(join(ALLOWED_BASE, request.path));

  if (!isPathAllowed(targetPath)) {
    return {
      success: false,
      error: `Path traversal denied: ${request.path}`,
      metadata: { operation: request.operation, path: request.path, durationMs: Date.now() - start },
    };
  }

  try {
    switch (request.operation) {
      case "read":
        return await handleRead(targetPath, request, start);
      case "write":
        return await handleWrite(targetPath, request, start);
      case "exec":
        return await handleExec(targetPath, request, start);
      case "lint":
        return await handleLint(targetPath, request, start);
      case "search":
        return await handleSearch(targetPath, request, start);
      default:
        return {
          success: false,
          error: `Unknown ACP operation: ${request.operation}`,
          metadata: { operation: request.operation, path: request.path, durationMs: Date.now() - start },
        };
    }
  } catch (err) {
    return {
      success: false,
      error: (err as Error).message,
      metadata: { operation: request.operation, path: request.path, durationMs: Date.now() - start },
    };
  }
}

async function handleRead(targetPath: string, request: ACPRequest, start: number): Promise<ACPResponse> {
  await access(targetPath);
  const content = await readFile(targetPath, "utf-8");
  return {
    success: true,
    data: { content, path: relative(ALLOWED_BASE, targetPath) },
    metadata: { operation: "read", path: request.path, size: content.length, durationMs: Date.now() - start },
  };
}

async function handleWrite(targetPath: string, request: ACPRequest, start: number): Promise<ACPResponse> {
  if (!request.content || request.content.length > MAX_FILE_SIZE) {
    return {
      success: false,
      error: request.content ? "File exceeds maximum size (10MB)" : "No content provided",
      metadata: { operation: "write", path: request.path, durationMs: Date.now() - start },
    };
  }
  await writeFile(targetPath, request.content, "utf-8");
  return {
    success: true,
    data: { path: relative(ALLOWED_BASE, targetPath), bytes: request.content.length },
    metadata: { operation: "write", path: request.path, size: request.content.length, durationMs: Date.now() - start },
  };
}

async function handleExec(targetPath: string, _request: ACPRequest, start: number): Promise<ACPResponse> {
  const { executeSandbox } = await import("../sandbox/sandbox.js");
  const content = await readFile(targetPath, "utf-8");
  const ext = targetPath.split(".").pop() ?? "js";
  const languageMap: Record<string, "javascript" | "typescript" | "python" | "bash"> = {
    js: "javascript", ts: "typescript", py: "python", sh: "bash", mjs: "javascript", cjs: "javascript",
  };

  const result = await executeSandbox({
    code: content,
    language: languageMap[ext] ?? "javascript",
    timeoutMs: 30000,
  });

  return {
    success: result.exitCode === 0,
    data: { stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode },
    metadata: { operation: "exec", path: _request.path, durationMs: Date.now() - start },
  };
}

async function handleLint(targetPath: string, _request: ACPRequest, start: number): Promise<ACPResponse> {
  const ext = targetPath.split(".").pop() ?? "js";
  const content = await readFile(targetPath, "utf-8");
  const lines = content.split("\n");
  const issues: Array<{ line: number; column: number; message: string; severity: string }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.length > 120) {
      issues.push({ line: i + 1, column: 121, message: "Line exceeds 120 characters", severity: "warning" });
    }
    if (line.match(/\s+$/)) {
      issues.push({ line: i + 1, column: line.length, message: "Trailing whitespace", severity: "warning" });
    }
  }

  return {
    success: true,
    data: { file: _request.path, issues, totalLines: lines.length, language: ext },
    metadata: { operation: "lint", path: _request.path, durationMs: Date.now() - start },
  };
}

async function handleSearch(targetPath: string, request: ACPRequest, start: number): Promise<ACPResponse> {
  const entries = await readdir(targetPath, { withFileTypes: true });
  const files = entries.map((e) => ({
    name: e.name,
    type: e.isDirectory() ? "directory" : "file",
    path: join(relative(ALLOWED_BASE, targetPath), e.name),
  }));

  return {
    success: true,
    data: { files, total: files.length },
    metadata: { operation: "search", path: request.path, durationMs: Date.now() - start },
  };
}

export { isPathAllowed };
