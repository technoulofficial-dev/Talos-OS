#!/usr/bin/env node
// Drives the 21st.dev Magic MCP via stdio JSON-RPC
// Usage: node scripts/mcp-call.mjs <tool-name> [args-json]

import { spawn } from "child_process";

const [toolName, argsJson = "{}"] = process.argv.slice(2);
if (!toolName) {
  console.error("Usage: node mcp-call.mjs <tool-name> [args-json]");
  process.exit(1);
}

const proc = spawn("npx.cmd", ["-y", "@21st-dev/magic@latest"], {
  stdio: ["pipe", "pipe", "pipe"],
  env: { ...process.env, API_KEY: process.env.TWENTYFIRST_API_KEY },
  shell: true,
});

let buffer = "";
let stderrBuf = "";
proc.stdout.on("data", (chunk) => {
  buffer += chunk.toString();
  let idx;
  while ((idx = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.result && msg.result.tools) {
        console.log(JSON.stringify(msg.result.tools.map(t => ({ name: t.name, description: t.description })), null, 2));
        proc.kill();
        process.exit(0);
      } else if (msg.id === 2) {
        console.log(JSON.stringify(msg, null, 2));
        proc.kill();
        process.exit(msg.error ? 1 : 0);
      }
    } catch {}
  }
});
proc.stderr.on("data", (chunk) => { stderrBuf += chunk.toString(); });

// Step 1: initialize
const init = { jsonrpc: "2.0", id: 0, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "talos-mcp-driver", version: "1.0.0" } } };
proc.stdin.write(JSON.stringify(init) + "\n");

// Step 2: initialized notification
const initialized = { jsonrpc: "2.0", method: "notifications/initialized" };
proc.stdin.write(JSON.stringify(initialized) + "\n");

// Step 3: list tools
const list = { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} };
proc.stdin.write(JSON.stringify(list) + "\n");

// If a tool name was given, also call it
if (toolName === "tools/list") {
  // already handled above
} else {
  setTimeout(() => {
    const call = { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: toolName, arguments: JSON.parse(argsJson) } };
    proc.stdin.write(JSON.stringify(call) + "\n");
  }, 500);
}

setTimeout(() => {
  console.error("Timeout. Stderr from MCP server:");
  console.error(stderrBuf);
  proc.kill();
  process.exit(2);
}, 30000);
