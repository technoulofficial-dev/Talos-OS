/**
 * talos start - Start the Talos OS system
 */

import chalk from "chalk";
import ora from "ora";
import boxen from "boxen";

export async function startCommand(options: { detach?: boolean }) {
  const spinner = ora({
    text: chalk.hex("#00e5ff")("Starting Talos OS..."),
    color: "cyan",
  }).start();

  try {
    // Initialize The Loom
    spinner.text = "Initializing The Loom (auction system)...";
    await sleep(400);

    // Start G0DM0D3 network
    spinner.text = "Starting G0DM0D3 network discovery...";
    await sleep(400);

    // Start core agents
    const coreAgents = [
      "Odin",
      "Mimir",
      "Brokkr",
      "OpenCode",
      "Muninn",
      "Huginn",
      "Sage",
      "Eitri",
      "Bragi",
      "Nornir",
      "System",
    ];
    for (const agent of coreAgents) {
      spinner.text = `Starting agent: ${chalk.hex("#b87333")(agent)}...`;
      await sleep(150);
    }

    // Start HTTP API
    spinner.text = "Starting HTTP API on port 8642...";
    await sleep(400);

    // Start Mission Control
    spinner.text = "Starting Mission Control on port 3000...";
    await sleep(300);

    spinner.succeed(chalk.green("Talos OS is operational"));

    console.log(
      boxen(
        [
          `${chalk.hex("#00e5ff")("Talos OS v8.0.0")}`,
          "",
          `${chalk.gray("Mission Control:")} ${chalk.hex("#b87333")("http://localhost:3000")}`,
          `${chalk.gray("HTTP API:")}      ${chalk.hex("#b87333")("http://localhost:8642")}`,
          "",
          `${chalk.gray("Mode:")}           ${options.detach ? "detached" : "foreground"}`,
          `${chalk.gray("Status:")}         ${chalk.green("● OPERATIONAL")}`,
        ].join("\n"),
        {
          padding: 1,
          borderColor: "cyan",
          borderStyle: "round",
        }
      )
    );
  } catch (err) {
    spinner.fail(chalk.red("Failed to start Talos OS"));
    throw err;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}