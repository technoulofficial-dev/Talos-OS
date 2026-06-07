/**
 * Supabase client for Talos OS database layer.
 * Provides typed access to all talos_* tables.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export interface SupabaseConfig {
  url: string;
  serviceKey: string;
}

/**
 * Initialize the Supabase client with service role key.
 * Use only on the server side. For client-side, use anon key.
 */
export function createSupabaseClient(config: SupabaseConfig): SupabaseClient {
  _client = createClient(config.url, config.serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: {
      schema: "public",
    },
  });
  return _client;
}

/**
 * Get the existing Supabase client, or throw if not initialized.
 */
export function getSupabaseClient(): SupabaseClient {
  if (!_client) {
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!url || !key) {
      throw new Error(
        "Supabase client not initialized. Call createSupabaseClient() first or set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars."
      );
    }
    _client = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return _client;
}

/**
 * Reset the client (useful for testing).
 */
export function resetSupabaseClient(): void {
  _client = null;
}

export type { SupabaseClient };