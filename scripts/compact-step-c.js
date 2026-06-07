const path = require("path");
const { captureLearning, resolveDefaultPaths } = require(path.resolve(__dirname, "..", "packages", "core", "dist", "rituals", "session.js"));

const paths = resolveDefaultPaths();

(async () => {
  const t1 = await captureLearning(
    {
      subject: "WorkflowPersistence",
      predicate: "dual_mode_implementation",
      object: "env_flag_TALOS_WORKFLOW_DB_ENABLED",
      context: "core/src/workflow/persistence.ts now branches on TALOS_WORKFLOW_DB_ENABLED env var. Default OFF (JSON files, tested via __setStoreDir). When ON, all 7 persistence functions delegate to @talos/db via dynamic import. List/index/cache helpers become no-ops in DB mode; getStoreDir() returns 'supabase://talos_workflows' as a diagnostic sentinel."
    },
    paths
  );
  const t2 = await captureLearning(
    {
      subject: "WorkflowSchema",
      predicate: "table_layout",
      object: "talos_workflows_runs_logs",
      context: "3-table layout per blueprint §3.5/§20: talos_workflows (definition + jsonb blob), talos_workflow_runs (run-level state, FK to workflows with CASCADE), talos_run_logs (per-node timeline, FK to runs with CASCADE). All 3 RLS-enabled with read-all + service-role-only-write. Indexed on workflow_id, state, started_at for common query patterns."
    },
    paths
  );
  const t3 = await captureLearning(
    {
      subject: "RitualTests",
      predicate: "date_determinism_fix",
      object: "vi.useFakeTimers_pinned_to_2026-06-05",
      context: "rituals.test.ts was brittle: it called sessionEnd() with no date param and expected the filename to be '2026-06-05-session.md'. When the system clock crossed midnight UTC (e.g. running on 2026-06-06), the test broke. Fix: vi.useFakeTimers() in beforeEach with vi.setSystemTime(2026-06-05T15:00:00Z) and vi.useRealTimers() in afterEach. Pattern to apply to any other date-brittle test."
    },
    paths
  );
  console.log(JSON.stringify({ t1, t2, t3 }, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });
