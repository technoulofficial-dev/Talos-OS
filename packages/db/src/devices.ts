/**
 * Devices - manages the G0DM0D3 device registry in Supabase.
 * Mirrors the talos_devices table. Devices are discovered via LAN broadcast.
 */

import { z } from "zod";
import { getSupabaseClient, type SupabaseClient } from "./client.js";

export const DeviceStatusSchema = z.enum(["online", "offline", "decommissioned"]);
export type DeviceStatus = z.infer<typeof DeviceStatusSchema>;

export const DeviceSchema = z.object({
  id: z.string().uuid().optional(),
  hostname: z.string().min(1),
  localEndpointUrl: z.string().url(),
  hasLocalAi: z.boolean().default(true),
  status: DeviceStatusSchema.default("online"),
  capabilityScore: z.number().min(0).max(1).default(0.5),
  modelsAvailable: z.array(z.string()).default([]),
  vramEstimateGb: z.number().optional(),
  lastHeartbeat: z.string().optional(),
  discoveredAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type Device = z.infer<typeof DeviceSchema>;

export const RegisterDeviceInputSchema = DeviceSchema.omit({
  id: true,
  discoveredAt: true,
  updatedAt: true,
}).partial({
  hasLocalAi: true,
  status: true,
  capabilityScore: true,
  modelsAvailable: true,
  vramEstimateGb: true,
  lastHeartbeat: true,
});
export type RegisterDeviceInput = z.input<typeof RegisterDeviceInputSchema>;

export interface DevicesClient {
  from: (table: string) => {
    select: (cols?: string) => {
      eq: (col: string, val: unknown) => {
        single: () => Promise<{ data: unknown; error: { message: string } | null }>;
        order: (col: string, opts?: { ascending?: boolean }) => {
          limit: (n: number) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
        };
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

const DEVICE_COLS =
  "id, hostname, local_endpoint_url, has_local_ai, status, capability_score, models_available, vram_estimate_gb, last_heartbeat, discovered_at, updated_at";

function mapDeviceFromDb(row: Record<string, unknown>): Device {
  return {
    id: row["id"] as string,
    hostname: row["hostname"] as string,
    localEndpointUrl: row["local_endpoint_url"] as string,
    hasLocalAi: (row["has_local_ai"] as boolean) ?? true,
    status: (row["status"] as DeviceStatus) ?? "online",
    capabilityScore: (row["capability_score"] as number) ?? 0.5,
    modelsAvailable: (row["models_available"] as string[]) ?? [],
    vramEstimateGb: row["vram_estimate_gb"] as number | undefined,
    lastHeartbeat: row["last_heartbeat"] as string | undefined,
    discoveredAt: row["discovered_at"] as string | undefined,
    updatedAt: row["updated_at"] as string | undefined,
  };
}

function resolveClient(client?: SupabaseClient | DevicesClient): DevicesClient {
  return (client ?? getSupabaseClient()) as unknown as DevicesClient;
}

export async function registerDevice(
  input: RegisterDeviceInput,
  client?: SupabaseClient | DevicesClient
): Promise<Device> {
  const parsed = RegisterDeviceInputSchema.parse(input);
  const c = resolveClient(client);
  const { data, error } = await c
    .from("talos_devices")
    .insert({
      hostname: parsed.hostname,
      local_endpoint_url: parsed.localEndpointUrl,
      has_local_ai: parsed.hasLocalAi,
      status: parsed.status,
      capability_score: parsed.capabilityScore,
      models_available: parsed.modelsAvailable,
      vram_estimate_gb: parsed.vramEstimateGb,
      last_heartbeat: parsed.lastHeartbeat ?? new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw new Error(`Failed to register device: ${error.message}`);
  return mapDeviceFromDb(data as Record<string, unknown>);
}

export async function getDevice(
  hostname: string,
  client?: SupabaseClient | DevicesClient
): Promise<Device | null> {
  const c = resolveClient(client);
  const { data, error } = await c
    .from("talos_devices")
    .select(DEVICE_COLS)
    .eq("hostname", hostname)
    .single();
  if (error) return null;
  if (!data) return null;
  return mapDeviceFromDb(data as Record<string, unknown>);
}

export async function listDevices(
  options: { limit?: number; status?: DeviceStatus } = {},
  client?: SupabaseClient | DevicesClient
): Promise<Device[]> {
  const c = resolveClient(client);
  const limit = options.limit ?? 100;
  let query = c.from("talos_devices").select(DEVICE_COLS);
  if (options.status) {
    const { data, error } = await query
      .eq("status", options.status)
      .order("capability_score", { ascending: false })
      .limit(limit);
    if (error) throw new Error(`Failed to list devices: ${error.message}`);
    return (data ?? []).map((r) => mapDeviceFromDb(r as Record<string, unknown>));
  }
  const { data, error } = await query
    .order("capability_score", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Failed to list devices: ${error.message}`);
  return (data ?? []).map((r) => mapDeviceFromDb(r as Record<string, unknown>));
}

export async function updateDeviceHeartbeat(
  hostname: string,
  client?: SupabaseClient | DevicesClient
): Promise<Device> {
  const c = resolveClient(client);
  const { data, error } = await c
    .from("talos_devices")
    .update({ last_heartbeat: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("hostname", hostname)
    .select()
    .single();
  if (error) throw new Error(`Failed to update heartbeat: ${error.message}`);
  return mapDeviceFromDb(data as Record<string, unknown>);
}

export async function updateDeviceStatus(
  hostname: string,
  status: DeviceStatus,
  client?: SupabaseClient | DevicesClient
): Promise<Device> {
  const c = resolveClient(client);
  const { data, error } = await c
    .from("talos_devices")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("hostname", hostname)
    .select()
    .single();
  if (error) throw new Error(`Failed to update device status: ${error.message}`);
  return mapDeviceFromDb(data as Record<string, unknown>);
}

export async function removeDevice(
  hostname: string,
  client?: SupabaseClient | DevicesClient
): Promise<void> {
  const c = resolveClient(client);
  const { error } = await c
    .from("talos_devices")
    .delete()
    .eq("hostname", hostname);
  if (error) throw new Error(`Failed to remove device: ${error.message}`);
}
