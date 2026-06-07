const path = require("path");
const { captureLearning, resolveDefaultPaths } = require(path.resolve(__dirname, "..", "packages", "core", "dist", "rituals", "session.js"));

const paths = resolveDefaultPaths();

(async () => {
  const t1 = await captureLearning(
    {
      subject: "MVE",
      predicate: "definition",
      object: "5_stranger_test_items",
      context: "MVE is verified by the 'stranger test': install via install-windows.ps1, see Mission Control at localhost:3000, (1) build 3-node workflow in drag-drop canvas, (2) save and run it, (3) watch node states light up, (4) chat with Odin and get memory-aware answer, (5) restart and have workflow+conversation persist. All 5 working = MVE done."
    },
    paths
  );
  const t2 = await captureLearning(
    {
      subject: "MVEScope",
      predicate: "cuts",
      object: "13_agents_to_1_phase_3_skipped_pretty_ui_skipped",
      context: "MVE scope decisions: (1) Only Odin agent fleshed out; 12 others stay 2-file shells. (2) Phase 3 (Harvester, Phoenix-Bot, auto-skilling) deferred. (3) Plugin marketplace skipped. (4) G0DM0D3 device network skipped — router already falls back to OpenRouter free. (5) Multi-tenant auth replaced with local user_id. (6) Pretty UI design skipped — system fonts, no design system. (7) Real Supabase deploy is opt-in via TALOS_WORKFLOW_DB_ENABLED; JSON works for MVE."
    },
    paths
  );
  const t3 = await captureLearning(
    {
      subject: "MVETimeline",
      predicate: "session_plan",
      object: "12_sessions_30_50_hours",
      context: "Block A (3 sessions, 6-8 hrs): React Flow canvas, run-from-canvas, polish+5 more node types. Block B (3 sessions, 6-8 hrs): Cortex wiring, real Odin, chat UI. Block C (3 sessions, 6-8 hrs): persistent user_id, Docker verification, fix pre-existing test + E2E. Block D (3-6 sessions, optional): memory UI, graph view, docs. 9-hour budget targets Blocks A+B fully, partial C."
    },
    paths
  );
  console.log(JSON.stringify({ t1, t2, t3 }, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });
