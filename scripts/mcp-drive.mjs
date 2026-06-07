#!/usr/bin/env node
// Drive any MCP via stdio JSON-RPC: magic, open-design-mcp
// Usage: node scripts/mcp-drive.mjs <pkg> [tool-name] [args-json]

import { spawn } from "child_process";

const pkg = process.argv[2];
const toolName = process.argv[3];
const argsFile = process.argv[4];
let argsJson = "{}";
if (argsFile) {
  const fs = await import("fs");
  argsJson = fs.readFileSync(argsFile, "utf8");
} else if (process.argv[4]) {
  argsJson = process.argv[4];
}
if (!pkg) {
  console.error("Usage: node mcp-drive.mjs <pkg> [tool-name] [args-json-file]");
  console.error("  pkg: @21st-dev/magic | open-design-mcp");
  process.exit(1);
}

const env = { ...process.env };
if (pkg === "@21st-dev/magic") env.API_KEY = process.env.TWENTYFIRST_API_KEY;
if (pkg === "open-design-mcp") env.OD_DAEMON_URL = process.env.OD_DAEMON_URL || "http://localhost:7456";

const proc = spawn("npx.cmd", ["-y", pkg, "--transport=stdio"], {
  stdio: ["pipe", "pipe", "pipe"],
  env,
  shell: true,
});

let buffer = "";
let stderrBuf = "";
let requestId = 0;
const pending = new Map();

function send(method, params) {
  const id = ++requestId;
  const msg = { jsonrpc: "2.0", id, method, params };
  proc.stdin.write(JSON.stringify(msg) + "\n");
  return id;
}

function handle(msg) {
  if (msg.id && pending.has(msg.id)) {
    const action = pending.get(msg.id);
    pending.delete(msg.id);
    action(msg);
    return true;
  }
  return false;
}

proc.stdout.on("data", (chunk) => {
  buffer += chunk.toString();
  let idx;
  while ((idx = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    try {
      handle(JSON.parse(line));
    } catch {}
  }
});
proc.stderr.on("data", (chunk) => { stderrBuf += chunk.toString(); });

// initialize
const initId = send("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "talos-mcp-driver", version: "1.0.0" } });
pending.set(initId, () => {
  proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
  const listId = send("tools/list", {});
  pending.set(listId, (msg) => {
    if (toolName === "tools/list" || !toolName) {
      if (msg.result && msg.result.tools) {
        console.log(JSON.stringify(msg.result.tools.map(t => ({ name: t.name, description: (t.description || "").slice(0, 200), inputSchema: t.inputSchema })), null, 2));
      } else {
        console.log(JSON.stringify(msg, null, 2));
      }
      proc.kill();
      process.exit(msg.error ? 1 : 0);
    } else {
      const callId = send("tools/call", { name: toolName, arguments: JSON.parse(argsJson) });
      pending.set(callId, (msg) => {
        console.log(JSON.stringify(msg, null, 2));
        proc.kill();
        process.exit(msg.error ? 1 : 0);
      });
    }
  });
});

setTimeout(() => {
  console.error("Timeout.\nStderr:\n" + stderrBuf);
  proc.kill();
  process.exit(2);
}, 60000);
