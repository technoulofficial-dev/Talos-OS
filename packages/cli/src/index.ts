/**
 * Talos CLI - The Bronze Automaton
 * Main entry point for the Talos OS command-line interface.
 */

import { Command } from "commander";
import chalk from "chalk";
import boxen from "boxen";
import { startCommand } from "./commands/start.js";
import { stopCommand } from "./commands/stop.js";
import { statusCommand } from "./commands/status.js";
import { agentCommand } from "./commands/agent.js";
import { taskCommand } from "./commands/task.js";
import { memoryCommand } from "./commands/memory.js";
import { blueprintCommand } from "./commands/blueprint.js";
import { pluginCommand } from "./commands/plugin.js";

const TALOS_BANNER = `
${chalk.hex("#b87333")("╔══════════════════════════════════════════════════════════════╗")}
${chalk.hex("#b87333")("║")}  ${chalk.hex("#cd7f32").bold("⚒  T A L O S  O S  ⚒")}                                    ${chalk.hex("#b87333")("║")}
${chalk.hex("#b87333")("║")}  ${chalk.hex("#00e5ff")("The Bronze Automaton · Metis Corp")}                    ${chalk.hex("#b87333")("║")}
${chalk.hex("#b87333")("║")}  ${chalk.gray("Adjustable · Self-Improving · Bearer of the Digital World")}  ${chalk.hex("#b87333")("║")}
${chalk.hex("#b87333")("╚══════════════════════════════════════════════════════════════╝")}
`;

const program = new Command();

program
  .name("talos")
  .description("Talos OS - The autonomous, self-improving AI operating system")
  .version("8.0.0")
  .hook("preAction", () => {
    console.log(TALOS_BANNER);
  });

program
  .command("start")
  .description("Start the Talos OS system")
  .option("-d, --detach", "Run in detached mode")
  .action(startCommand);

program
  .command("stop")
  .description("Stop the Talos OS system gracefully")
  .action(stopCommand);

program
  .command("status")
  .description("Show system health and status")
  .action(statusCommand);

program
  .command("agent")
  .description("Manage individual agents")
  .argument("<action>", "Action to perform: list, info, restart, disable")
  .argument("[agentId]", "Agent ID (e.g., odin, mimir, loom)")
  .action(agentCommand);

program
  .command("task")
  .description("Manage the task queue")
  .argument("<action>", "Action to perform: list, create, cancel, retry")
  .argument("[taskId]", "Task ID (for specific actions)")
  .option("-d, --description <desc>", "Task description (for create)")
  .option("-s, --skills <skills>", "Required skills (comma-separated)")
  .action(taskCommand);

program
  .command("memory")
  .description("Inspect memory systems (Cortex, Nornir)")
  .argument("<action>", "Action to perform: view, consolidate, search")
  .argument("[query]", "Search query (for search action)")
  .action(memoryCommand);

program
  .command("blueprint")
  .description("Manage the Living Blueprint")
  .argument("<action>", "Action to perform: status, diff, apply, rollback")
  .action(blueprintCommand);

program
  .command("plugin")
  .description("Manage plugins")
  .argument("<action>", "Action to perform: list, install, remove, update")
  .argument("[name]", "Plugin name")
  .action(pluginCommand);

program.parseAsync(process.argv).catch((err) => {
  console.error(
    boxen(chalk.red.bold("Error\n") + chalk.red(err.message), {
      padding: 1,
      borderColor: "red",
      borderStyle: "double",
    })
  );
  process.exit(1);
});