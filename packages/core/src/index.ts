/**
 * @talos/core — Talos OS Core Engine
 *
 * Exports all core modules: router, budget, G0DM0D3, AI engine,
 * cortex context, blueprint, phoenix, sandbox, API server, and config.
 */

export * from "./types/index.js";
export * as budget from "./budget/index.js";
export * as g0dm0d3 from "./g0dm0d3/index.js";
export * as router from "./router/index.js";
export * as cortex from "./cortex/index.js";
export * as aiEngine from "./ai-engine/index.js";
export * as blueprint from "./blueprint/index.js";
export * as phoenix from "./phoenix/index.js";
export * as sandbox from "./sandbox/index.js";
export * as api from "./api/server.js";
export * as council from "./council/index.js";
export * as plugin from "./plugin/index.js";
export * as graphify from "./graphify/index.js";
export * as workflow from "./workflow/index.js";
export * as rituals from "./rituals/index.js";
export { loadTalosConfig, type TalosConfig } from "./config/loader.js";