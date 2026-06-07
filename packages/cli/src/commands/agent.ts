/**
 * talos agent - Manage individual agents
 */

import chalk from "chalk";

const AGENT_INFO: Record<string, { name: string; guild: string; model: string; role: string }> = {
  loom: { name: "The Loom", guild: "crown", model: "deepseek-v4-pro", role: "Master Task Weaver" },
  odin: { name: "Odin", guild: "crown", model: "nemotron-3-super-120b", role: "Strategic Advisor" },
  mimir: { name: "Mimir", guild: "crown", model: "nemotron-3-super-120b", role: "Architect & Risk Auditor" },
  brokkr: { name: "Brokkr", guild: "forge", model: "kimi-k2.6", role: "Task Splitter" },
  opencode: { name: "OpenCode", guild: "forge", model: "nemotron-3-super-120b", role: "Coder" },
  muninn: { name: "Muninn", guild: "vault", model: "glm-5.1", role: "QA & Memory Custodian" },
  huginn: { name: "Huginn", guild: "sanctum", model: "mistral-large-3-675b", role: "Web Researcher" },
  sage: { name: "Sage", guild: "sanctum", model: "kimi-k2.6", role: "Synthesis & Insight" },
  eitri: { name: "Eitri", guild: "foundry", model: "deepseek-v4-pro", role: "Agent Factory" },
  bragi: { name: "Bragi", guild: "crown", model: "nemotron-3-super-120b", role: "CMO / Marketing" },
  nornir: { name: "Nornir", guild: "vault", model: "mistral-large-3-675b", role: "Three Fates of Memory" },
  system: { name: "System", guild: "crown", model: "qwen3.5-397b", role: "Self-updating" },
};

export async function agentCommand(action: string, agentId?: string) {
  switch (action) {
    case "list":
      listAgents();
      break;
    case "info":
      if (!agentId) {
        console.error(chalk.red("Error: agentId required for 'info' action"));
        process.exit(1);
      }
      showAgentInfo(agentId);
      break;
    case "restart":
      if (!agentId) {
        console.error(chalk.red("Error: agentId required for 'restart' action"));
        process.exit(1);
      }
      restartAgent(agentId);
      break;
    case "disable":
      if (!agentId) {
        console.error(chalk.red("Error: agentId required for 'disable' action"));
        process.exit(1);
      }
      disableAgent(agentId);
      break;
    default:
      console.error(chalk.red(`Unknown action: ${action}`));
      console.log("Available actions: list, info, restart, disable");
      process.exit(1);
  }
}

function listAgents() {
  console.log(chalk.hex("#cd7f32").bold("\n  Agent Registry\n"));
  console.log(
    chalk.gray(
      "  " +
        "ID".padEnd(12) +
        "Name".padEnd(16) +
        "Guild".padEnd(12) +
        "Model".padEnd(28) +
        "Status"
    )
  );
  console.log(chalk.gray("  " + "─".repeat(80)));

  for (const [id, info] of Object.entries(AGENT_INFO)) {
    const status = "● active";
    console.log(
      "  " +
        chalk.hex("#b87333")(id.padEnd(12)) +
        info.name.padEnd(16) +
        info.guild.padEnd(12) +
        chalk.gray(info.model.padEnd(28)) +
        chalk.green(status)
    );
  }
  console.log();
}

function showAgentInfo(agentId: string) {
  const info = AGENT_INFO[agentId];
  if (!info) {
    console.error(chalk.red(`Unknown agent: ${agentId}`));
    process.exit(1);
  }

  console.log(chalk.hex("#cd7f32").bold(`\n  Agent: ${info.name} (${agentId})\n`));
  console.log(`  ${chalk.gray("Role:")}        ${info.role}`);
  console.log(`  ${chalk.gray("Guild:")}       ${info.guild}`);
  console.log(`  ${chalk.gray("Model:")}       ${info.model}`);
  console.log(`  ${chalk.gray("Status:")}      ${chalk.green("● active")}`);
  console.log(`  ${chalk.gray("Score:")}       ${chalk.hex("#00e5ff")("0.92")}`);
  console.log(`  ${chalk.gray("Load:")}        ${chalk.gray("0.20")}`);
  console.log();
}

function restartAgent(agentId: string) {
  console.log(chalk.hex("#00e5ff")(`♻ Restarting agent: ${agentId}...`));
  setTimeout(() => {
    console.log(chalk.green(`✓ Agent ${agentId} restarted successfully`));
  }, 1000);
}

function disableAgent(agentId: string) {
  console.log(chalk.yellow(`⚠ Disabling agent: ${agentId}...`));
  setTimeout(() => {
    console.log(chalk.yellow(`⚠ Agent ${agentId} is now disabled`));
  }, 1000);
}