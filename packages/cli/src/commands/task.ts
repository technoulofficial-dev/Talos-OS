/**
 * talos task - Manage the task queue
 */

import chalk from "chalk";

interface TaskCommandOptions {
  description?: string;
  skills?: string;
}

export async function taskCommand(
  action: string,
  taskId?: string,
  options: TaskCommandOptions = {}
) {
  switch (action) {
    case "list":
      listTasks();
      break;
    case "create":
      createTask(options);
      break;
    case "cancel":
      if (!taskId) {
        console.error(chalk.red("Error: taskId required for 'cancel' action"));
        process.exit(1);
      }
      cancelTask(taskId);
      break;
    case "retry":
      if (!taskId) {
        console.error(chalk.red("Error: taskId required for 'retry' action"));
        process.exit(1);
      }
      retryTask(taskId);
      break;
    default:
      console.error(chalk.red(`Unknown action: ${action}`));
      console.log("Available actions: list, create, cancel, retry");
      process.exit(1);
  }
}

function listTasks() {
  const tasks = [
    { id: "tsk-001", status: "done", agent: "odin", desc: "Analyze requirements" },
    { id: "tsk-002", status: "done", agent: "mimir", desc: "Design architecture" },
    { id: "tsk-003", status: "done", agent: "brokkr", desc: "Split into subtasks" },
    { id: "tsk-004", status: "processing", agent: "opencode", desc: "Implement backend" },
    { id: "tsk-005", status: "processing", agent: "opencode", desc: "Implement frontend" },
    { id: "tsk-006", status: "queued", agent: "opencode", desc: "Write tests" },
    { id: "tsk-007", status: "queued", agent: "muninn", desc: "Code review" },
  ];

  console.log(chalk.hex("#cd7f32").bold("\n  Task Queue\n"));
  for (const t of tasks) {
    const statusColor =
      t.status === "done"
        ? chalk.green
        : t.status === "processing"
        ? chalk.yellow
        : chalk.gray;
    console.log(
      `  ${statusColor("●")} ${chalk.gray(t.id)} ${chalk.hex("#b87333")(t.agent.padEnd(10))} ${t.desc}`
    );
  }
  console.log();
}

function createTask(options: TaskCommandOptions) {
  if (!options.description) {
    console.error(chalk.red("Error: --description required for 'create' action"));
    process.exit(1);
  }
  const taskId = `tsk-${Date.now().toString(36)}`;
  const skills = options.skills?.split(",").map((s) => s.trim()) ?? [];
  console.log(chalk.green(`✓ Task created: ${taskId}`));
  console.log(chalk.gray(`  Description: ${options.description}`));
  console.log(chalk.gray(`  Skills: ${skills.join(", ") || "(none)"}`));
  console.log(chalk.gray(`  Status: queued`));
}

function cancelTask(taskId: string) {
  console.log(chalk.yellow(`⚠ Cancelling task: ${taskId}`));
  setTimeout(() => {
    console.log(chalk.green(`✓ Task ${taskId} cancelled`));
  }, 500);
}

function retryTask(taskId: string) {
  console.log(chalk.hex("#00e5ff")(`♻ Retrying task: ${taskId}`));
  setTimeout(() => {
    console.log(chalk.green(`✓ Task ${taskId} re-queued`));
  }, 500);
}