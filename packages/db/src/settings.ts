/**
 * Settings - key-value runtime configuration in Supabase.
 * Mirrors the talos_settings table. Used for persistent config
 * that survives restarts (unlike env vars).
 */

import { z } from "zod";
import { getSupabaseClient, type SupabaseClient } from "./client.js";

export const SettingSchema = z.object({
  key: z.string().min(1),
  value: z.unknown(),
  updatedAt: z.string().optional(),
});
export type Setting = z.infer<typeof SettingSchema>;

export interface SettingsClient {
  from: (table: string) => {
    select: (cols?: string) => {
      eq: (col: string, val: unknown) => {
        single: () => Promise<{ data: unknown; error: { message: string } | null }>;
      };
      order: (col: string, opts?: { ascending?: boolean }) => {
        limit: (n: number) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
      };
    };
    insert: (rows: unknown) => {
      select: () => {
        single: () => Promise<{ data: unknown; error: { message: string } | null }>;
      };
    };
    update: (patch: unknown) => {
      eq: (col: string, val: unknown) => {
        select: () => {
          single: () => Promise<{ data: unknown; error: { message: string } | null }>;
        };
      };
    };
    delete: () => {
      eq: (col: string, val: unknown) => Promise<{ error: { message: string } | null }>;
    };
  };
}

const SETTING_COLS = "key, value, updated_at";

function mapSettingFromDb(row: Record<string, unknown>): Setting {
  return {
    key: row["key"] as string,
    value: row["value"],
    updatedAt: row["updated_at"] as string | undefined,
  };
}

function resolveClient(client?: SupabaseClient | SettingsClient): SettingsClient {
  return (client ?? getSupabaseClient()) as unknown as SettingsClient;
}

export async function getSetting(
  key: string,
  client?: SupabaseClient | SettingsClient
): Promise<Setting | null> {
  const c = resolveClient(client);
  const { data, error } = await c
    .from("talos_settings")
    .select(SETTING_COLS)
    .eq("key", key)
    .single();
  if (error) return null;
  if (!data) return null;
  return mapSettingFromDb(data as Record<string, unknown>);
}

export async function setSetting(
  key: string,
  value: unknown,
  client?: SupabaseClient | SettingsClient
): Promise<Setting> {
  const c = resolveClient(client);
  const { data, error } = await c
    .from("talos_settings")
    .insert({
      key,
      value,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw new Error(`Failed to set setting: ${error.message}`);
  return mapSettingFromDb(data as Record<string, unknown>);
}

export async function updateSetting(
  key: string,
  value: unknown,
  client?: SupabaseClient | SettingsClient
): Promise<Setting> {
  const c = resolveClient(client);
  const { data, error } = await c
    .from("talos_settings")
    .update({ value, updated_at: new Date().toISOString() })
    .eq("key", key)
    .select()
    .single();
  if (error) throw new Error(`Failed to update setting: ${error.message}`);
  return mapSettingFromDb(data as Record<string, unknown>);
}

export async function upsertSetting(
  key: string,
  value: unknown,
  client?: SupabaseClient | SettingsClient
): Promise<Setting> {
  const existing = await getSetting(key, client);
  if (existing) {
    return updateSetting(key, value, client);
  }
  return setSetting(key, value, client);
}

export async function deleteSetting(
  key: string,
  client?: SupabaseClient | SettingsClient
): Promise<void> {
  const c = resolveClient(client);
  const { error } = await c
    .from("talos_settings")
    .delete()
    .eq("key", key);
  if (error) throw new Error(`Failed to delete setting: ${error.message}`);
}

export async function listSettings(
  options: { limit?: number } = {},
  client?: SupabaseClient | SettingsClient
): Promise<Setting[]> {
  const c = resolveClient(client);
  const limit = options.limit ?? 100;
  const { data, error } = await c
    .from("talos_settings")
    .select(SETTING_COLS)
    .order("key", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`Failed to list settings: ${error.message}`);
  return (data ?? []).map((r) => mapSettingFromDb(r as Record<string, unknown>));
}

export async function getSettingAs<T>(
  key: string,
  defaultValue: T,
  client?: SupabaseClient | SettingsClient
): Promise<T> {
  const setting = await getSetting(key, client);
  if (!setting) return defaultValue;
  return setting.value as T;
}
