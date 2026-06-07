const path = require("path");
const { sessionEnd, captureLearning, resolveDefaultPaths } = require(path.resolve(__dirname, "..", "packages", "core", "dist", "rituals", "session.js"));

const paths = resolveDefaultPaths();

(async () => {
  const learn1 = await captureLearning(
    {
      subject: "WorkflowEngine",
      predicate: "blueprint_alignment",
      object: "10_node_types",
      context: "Added sub_workflow and graphify to match blueprint §9.2. Kept parallel and loop as non-blueprint extensions per user decision 2026-06-05."
    },
    paths
  );
  const learn2 = await captureLearning(
    {
      subject: "WorkflowEngine",
      predicate: "persistence_strategy",
      object: "json_files",
      context: "Currently persists to .talos/workflows/ as JSON. Blueprint §3.5 and §20 call for talos_workflows/talos_workflow_runs/talos_run_logs Supabase tables. Migration deferred to next session — needs ~30 min including persistence.ts rewrite + tests."
    },
    paths
  );
  const learn3 = await captureLearning(
    {
      subject: "Blueprint",
      predicate: "coverage_estimate",
      object: "45_percent",
      context: "After this session: Phase 0/1A/1B/2-core done, Phase 1C partial, Phase 2 UI/DB-integration deferred, Phase 3+ untouched. 13 internal agents are 2-file shells, not implementations."
    },
    paths
  );
  const learn4 = await captureLearning(
    {
      subject: "TalosSkills",
      predicate: "schema_matches",
      object: "blueprint_section_12.2",
      context: "Created supabase/migrations/0002_skills.sql with table matching blueprint §12.2 verbatim (id, name, description, source, source_tool, category, prompt_template, trigger_phrases, success_rate, is_cached, created_at, updated_at) + RLS."
    },
    paths
  );
  const learn5 = await captureLearning(
    {
      subject: "NextSession",
      predicate: "queues",
      object: "workflow_db_migration,react_flow_canvas,harvester_phase_3",
      context: "Queued for next session: (1) workflow DB tables migration + persistence.ts rewrite; (2) React Flow canvas in @talos/ui for workflow authoring; (3) Harvester Phase 3 implementation that uses the new talos_skills table; (4) pre-existing plugin path-traversal test fix in __tests__/plugin.test.ts."
    },
    paths
  );

  const result = await sessionEnd(
    {
      summary: "Phase 2 Workflow Engine MVP shipped in 1 session: 4 workflow modules, 6 REST endpoints, 8 node types with DAG executor. Code review caught 4 high-confidence issues (RCE via new Function, validator crash, test-hook leak, callback leak) — all fixed. Built 3 opencode session ritual tools (session_start, session_end, capture_learning) with testable data layer. Discovered and analyzed 3 blueprint drifts: workflow node types missing sub_workflow+graphify, workflow persistence uses JSON not Supabase, Graphify is triple-store not AST pipeline. In a follow-up compacted pass: added 2 missing node types, added talos_skills table for Phase 3, captured alignment analysis. Total: 175+ tests pass, 5/5 packages build via turbo.",
      decisions: [
        "Add sub_workflow and graphify node types to match blueprint §9.2 (10 total); keep parallel/loop as non-blueprint extensions per user choice",
        "Minimal CRUD for talos_skills table (no Harvester integration this session)",
        "Compact the session now: the 1-hour budget is tight, drift fixes for workflow DB tables and React Flow UI are deferred to next session",
        "Self-feeding protocol is now actually wired: session_start loads context, session_end writes handoff"
      ],
      learnings: [
        { subject: "WorkflowEngine", predicate: "blueprint_alignment", object: "10_node_types", context: "Added sub_workflow and graphify to match blueprint §9.2. Kept parallel and loop as non-blueprint extensions per user decision 2026-06-05." },
        { subject: "WorkflowEngine", predicate: "persistence_strategy", object: "json_files", context: "Currently persists to .talos/workflows/ as JSON. Blueprint §3.5 and §20 call for talos_workflows/talos_workflow_runs/talos_run_logs Supabase tables. Migration deferred to next session — needs ~30 min including persistence.ts rewrite + tests." },
        { subject: "Blueprint", predicate: "coverage_estimate", object: "45_percent", context: "After this session: Phase 0/1A/1B/2-core done, Phase 1C partial, Phase 2 UI/DB-integration deferred, Phase 3+ untouched. 13 internal agents are 2-file shells, not implementations." },
        { subject: "TalosSkills", predicate: "schema_matches", object: "blueprint_section_12.2", context: "Created supabase/migrations/0002_skills.sql with table matching blueprint §12.2 verbatim (id, name, description, source, source_tool, category, prompt_template, trigger_phrases, success_rate, is_cached, created_at, updated_at) + RLS." },
        { subject: "NextSession", predicate: "queues", object: "workflow_db_migration,react_flow_canvas,harvester_phase_3", context: "Queued for next session: (1) workflow DB tables migration + persistence.ts rewrite; (2) React Flow canvas in @talos/ui for workflow authoring; (3) Harvester Phase 3 implementation that uses the new talos_skills table; (4) pre-existing plugin path-traversal test fix in __tests__/plugin.test.ts." }
      ],
      nextSteps: [
        "Workflow DB migration: create talos_workflows, talos_workflow_runs, talos_run_logs tables + rewrite packages/core/src/workflow/persistence.ts to use @talos/db",
        "React Flow canvas in @talos/ui: drag node palette, edge-based deps, save/load via /v1/workflow endpoints, real-time node colour from run state",
        "Harvester Phase 3: use the new talos_skills table for skill registration and promotion",
        "Investigate pre-existing plugin path-traversal test failure in __tests__/plugin.test.ts:228",
        "Graphify AST pipeline (blueprint §3.4/§10) — large effort, requires integrating graphifyy package"
      ],
      tags: ["phase2", "workflow", "blueprint-alignment", "compact", "self-feeding"]
    },
    paths
  );

  console.log(JSON.stringify(result, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
