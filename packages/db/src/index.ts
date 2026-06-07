/**
 * @talos/db — Database layer for Talos OS
 * Supabase integration with typed access to all talos_* tables.
 */

export {
  createSupabaseClient,
  getSupabaseClient,
  resetSupabaseClient,
  type SupabaseClient,
  type SupabaseConfig,
} from "./client.js";

export * from "./agents.js";
export * from "./tasks.js";
export * from "./auctions.js";
export * from "./memory.js";
export * from "./plugins.js";
export * from "./store.js";
export * from "./skills.js";
export * from "./workflows.js";