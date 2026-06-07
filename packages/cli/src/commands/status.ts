/**
 * talos status - Show system health and status
 */

import chalk from "chalk";
import boxen from "boxen";

const DEMO_AGENTS = [
  { id: "loom", status: "idle", score: 0.98, load: 0.1 },
  { id: "odin", status: "executing", score: 0.95, load: 0.42 },
  { id: "mimir", status: "idle", score: 0.92, load: 0.2 },
  { id: "opencode", status: "executing", score: 0.9, load: 0.65 },
  { id: "muninn", status: "idle", score: 0.88, load: 0.1 },
  { id: "system", status: "executing", score: 0.95, load: 0.15 },
];

export async function statusCommand() {
  const statusColor = (s: string) =>
    s === "idle" || s === "healthy"
      ? chalk.green
      : s === "executing" || s === "degraded"
      ? chalk.yellow
      : chalk.red;

  const agentLines = DEMO_AGENTS.map((a) =>
    `  ${statusColor(a.status)("●")} ${chalk.hex("#b87333")(a.id.padEnd(10))} ${chalk.gray(
      a.status.padEnd(10)
    )} score=${chalk.hex("#00e5ff")((a.score * 100).toFixed(0) + "%")} load=${chalk.gray(
      (a.load * 100).toFixed(0) + "%"
    )}`
  );

  const output = [
    `${chalk.hex("#00e5ff").bold("Talos OS System Status")}`,
    "",
    `${chalk.gray("Uptime:")}      ${chalk.white("12h 34m 56s")}`,
    `${chalk.gray("CPU:")}         ${chalk.white("23%")}`,
    `${chalk.gray("Memory:")}      ${chalk.white("4.2GB / 16GB")}`,
    `${chalk.gray("Tokens:")}      ${chalk.white("12,847 / 1,000,000")}`,
    `${chalk.gray("Tasks queued:")} ${chalk.white("7")}`,
    `${chalk.gray("Tasks active:")} ${chalk.white("3")}`,
    "",
    `${chalk.hex("#cd7f32").bold("Active Agents:")}`,
    ...agentLines,
  ].join("\n");

  console.log(
    boxen(output, {
      padding: 1,
      borderColor: "cyan",
      borderStyle: "round",
    })
  );
}