import chalk from "chalk";
import { installPlugin as coreInstall, uninstallPlugin, listPlugins, getPlugin } from "@talos/core/plugin";
import type { PluginManifest } from "@talos/core/plugin";

export async function pluginCommand(action: string, name?: string) {
  switch (action) {
    case "list":
      await listAction();
      break;
    case "install":
      if (!name) {
        console.error(chalk.red("Error: plugin name required for 'install'"));
        process.exit(1);
      }
      await installAction(name);
      break;
    case "remove":
      if (!name) {
        console.error(chalk.red("Error: plugin name required for 'remove'"));
        process.exit(1);
      }
      await removeAction(name);
      break;
    case "update":
      if (!name) {
        console.error(chalk.red("Error: plugin name required for 'update'"));
        process.exit(1);
      }
      await updateAction(name);
      break;
    default:
      console.error(chalk.red(`Unknown action: ${action}`));
      console.log("Available actions: list, install, remove, update");
      process.exit(1);
  }
}

async function listAction() {
  const plugins = listPlugins();
  if (plugins.length === 0) {
    console.log(chalk.gray("\n  No plugins installed.\n"));
    return;
  }
  console.log(chalk.hex("#cd7f32").bold("\n  Installed Plugins\n"));
  console.log(chalk.gray("  " + "Name".padEnd(24) + "Version".padEnd(12) + "Status".padEnd(10) + "Errors"));
  console.log(chalk.gray("  " + "─".repeat(64)));
  for (const p of plugins) {
    const statusColor = p.status === "active" ? chalk.green : p.status === "failed" ? chalk.red : chalk.gray;
    console.log(
      "  " +
        chalk.hex("#b87333")(p.name.padEnd(24)) +
        p.version.padEnd(12) +
        statusColor(p.status.padEnd(10)) +
        (p.errorCount > 0 ? chalk.red(String(p.errorCount)) : chalk.gray("0"))
    );
  }
  console.log();
}

async function installAction(name: string) {
  console.log(chalk.hex("#00e5ff")(`⚒ Installing plugin: ${name}...`));
  const manifest: PluginManifest = {
    name,
    version: "1.0.0",
    description: `Plugin installed via CLI: ${name}`,
    capabilities: [],
  };
  const record = await coreInstall(manifest);
  console.log(chalk.green(`✓ Plugin ${record.name} v${record.version} installed and ${record.status}`));
}

async function removeAction(name: string) {
  const plugin = getPlugin(name);
  if (!plugin) {
    console.error(chalk.red(`Error: Plugin "${name}" not found`));
    process.exit(1);
  }
  console.log(chalk.yellow(`⚠ Removing plugin: ${name}...`));
  const removed = await uninstallPlugin(name);
  if (removed) {
    console.log(chalk.green(`✓ Plugin ${name} removed`));
  }
}

async function updateAction(name: string) {
  const plugin = getPlugin(name);
  if (!plugin) {
    console.error(chalk.red(`Error: Plugin "${name}" not found`));
    process.exit(1);
  }
  console.log(chalk.hex("#00e5ff")(`♻ Updating plugin: ${name}...`));
  const manifest: PluginManifest = {
    ...plugin.manifest,
    version: bumpVersion(plugin.version),
  };
  const record = await coreInstall(manifest);
  console.log(chalk.green(`✓ Plugin ${record.name} updated to v${record.version}`));
}

function bumpVersion(current: string): string {
  const parts = current.split(".").map(Number);
  parts[parts.length - 1] = (parts[parts.length - 1] ?? 0) + 1;
  return parts.join(".");
}
