const path = require("path");
const { captureLearning, resolveDefaultPaths } = require(path.resolve(__dirname, "..", "packages", "core", "dist", "rituals", "session.js"));

const paths = resolveDefaultPaths();

(async () => {
  const t1 = await captureLearning(
    {
      subject: "SkillsModule",
      predicate: "design_pattern",
      object: "optional_client_injection",
      context: "@talos/db/src/skills.ts accepts an optional client param on every function, defaulting to getSupabaseClient(). Tests inject a mock SkillsClient. Pattern can be back-ported to agents.ts, tasks.ts, memory.ts to make them testable without a real Supabase connection."
    },
    paths
  );
  const t2 = await captureLearning(
    {
      subject: "WorkflowEngine",
      predicate: "config_schema_is_strict",
      object: "WorkflowNodeConfigSchema",
      context: "Adding a new node type requires adding a config field to WorkflowNodeConfigSchema in types.ts — .strict() means unknown fields are rejected. Don't rely on args passthrough for new node types. The 'args' field is plugin-only."
    },
    paths
  );
  const t3 = await captureLearning(
    {
      subject: "Phase2",
      predicate: "blueprint_alignment",
      object: "node_types_100_percent",
      context: "After adding sub_workflow and graphify: 10 node types total. 8 from blueprint §9.2, 2 extensions (parallel, loop) explicitly documented as non-blueprint. engine.ts NODE_EXECUTORS map and resetNodeExecutor originals both updated."
    },
    paths
  );
  console.log(JSON.stringify({ t1, t2, t3 }, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });
