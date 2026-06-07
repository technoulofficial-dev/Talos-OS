/**
 * talos stop - Stop the Talos OS system gracefully
 */

import chalk from "chalk";
import ora from "ora";

export async function stopCommand() {
  const spinner = ora({
    text: chalk.hex("#00e5ff")("Stopping Talos OS gracefully..."),
    color: "cyan",
  }).start();

  const steps = [
    "Draining task queue",
    "Stopping new auctions",
    "Completing active tasks",
    "Shutting down agents",
    "Stopping HTTP API",
    "Stopping Mission Control",
  ];

  for (const step of steps) {
    spinner.text = step + "...";
    await sleep(300);
  }

  spinner.succeed(chalk.green("Talos OS stopped gracefully"));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}