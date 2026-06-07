/**
 * @talos/memory — Infinite Memory & Context System
 *
 * Implements the User Cortex and Nornir (Three Fates of Memory) from
 * Section 8 of the Talos OS Blueprint.
 */

export { Cortex, type CortexSnapshot } from "./cortex.js";
export {
  runUrdMaintenance,
  runVerdandiSummarization,
  runSkuldPreFetch,
  runNightlyConsolidation,
  recordNornirMarker,
  type NornirMarker,
  type ConsolidationResult,
} from "./nornir.js";