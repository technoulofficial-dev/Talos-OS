const path = require("path");
const { captureLearning, resolveDefaultPaths } = require(path.resolve(__dirname, "..", "packages", "core", "dist", "rituals", "session.js"));

const paths = resolveDefaultPaths();

(async () => {
  const t1 = await captureLearning(
    {
      subject: "WorkflowPersistence",
      predicate: "dual_mode_strategy",
      object: "json_files_default_db_optional",
      context: "Adding Supabase-backed persistence in @talos/db/workflows.ts. Core's persistence.ts gets a TALOS_WORKFLOW_DB_ENABLED env flag (default OFF = JSON files). When OFF, all existing tests pass unchanged. When ON, routes to @talos/db. This lets the engine ship to production with real DB while keeping the test suite simple."
    },
    paths
  );
  const t2 = await captureLearning(
    {
      subject: "CoreDbDep",
      predicate: "strategy",
      object: "dynamic_import_via_workspace",
      context: "@talos/core does NOT depend on @talos/db. To avoid adding a hard dep, persistence.ts will use dynamic import: `await import('@talos/db').then(m => m.saveWorkflowToDb(...))`. Workspace is monorepo, pnpm symlinks it, so dynamic import resolves at runtime. Lazy-loaded only when DB mode is enabled."
    },
    paths
  );
  const t3 = await captureLearning(
    {
      subject: "WorkflowRunLog",
      predicate: "schema_purpose",
      object: "per_node_timeline",
      context: "talos_run_logs table is for per-node execution timeline. Each row = one node-state-change event during a run. Blueprint §3.5/§20 calls for separate logs table so we can query 'why did this node fail yesterday at 3am' without scanning the full run JSONB."
    },
    paths
  );
  console.log(JSON.stringify({ t1, t2, t3 }, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });
