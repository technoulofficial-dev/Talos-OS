/**
 * SYS-G0DM0D3 G4: DeviceRegistry
 * Dual-mode device registry:
 * - In-memory Map (default, TALOS_DEVICE_DB_ENABLED unset or "false")
 * - Supabase via @talos/db (when TALOS_DEVICE_DB_ENABLED=true)
 *
 * The dual-mode strategy keeps existing tests passing unchanged
 * while letting production deploy with real database persistence.
 */

import { scoreCapability, type DeviceCapabilityInput } from "./score.js";
import { probeOllama, type ProbeResult } from "./probe.js";

export interface DeviceEntry {
  id: string;
  ip: string;
  port: number;
  hostname: string;
  capabilityScore: number;
  models: string[];
  totalVramGb: number;
  latencyMs: number;
  uptimeRatio: number;
  status: "online" | "offline" | "decommissioned";
  lastHeartbeat: Date;
  discoveredAt: Date;
}

// ---------------------------------------------------------------------------
// Dual-mode helpers
// ---------------------------------------------------------------------------

function dbEnabled(): boolean {
  return process.env["TALOS_DEVICE_DB_ENABLED"] === "true";
}

let dbModulePromise: Promise<typeof import("@talos/db")> | null = null;
async function loadDb() {
  if (!dbModulePromise) {
    dbModulePromise = import("@talos/db");
  }
  return dbModulePromise;
}

// ---------------------------------------------------------------------------
// In-memory store (default mode)
// ---------------------------------------------------------------------------

const devices: Map<string, DeviceEntry> = new Map();

// ---------------------------------------------------------------------------
// Public API — dual-mode
// ---------------------------------------------------------------------------

/** Register or update a discovered device */
export async function registerDevice(probe: ProbeResult): Promise<DeviceEntry> {
  const id = `g0dm0d3-${probe.ip}:${probe.port}`;
  const existing = devices.get(id);

  const capInput: DeviceCapabilityInput = {
    modelCount: probe.models.length,
    totalVramGb: probe.totalVramGb,
    latencyMs: probe.latencyMs,
    uptimeRatio: existing?.uptimeRatio ?? 1,
  };
  const cap = scoreCapability(capInput);

  const entry: DeviceEntry = {
    id,
    ip: probe.ip,
    port: probe.port,
    hostname: probe.ip,
    capabilityScore: cap.score,
    models: probe.models.map((m) => m.name),
    totalVramGb: probe.totalVramGb,
    latencyMs: probe.latencyMs,
    uptimeRatio: capInput.uptimeRatio,
    status: "online",
    lastHeartbeat: probe.probeTime,
    discoveredAt: existing?.discoveredAt ?? new Date(),
  };

  if (dbEnabled()) {
    try {
      const db = await loadDb();
      await db.registerDevice({
        hostname: entry.hostname,
        localEndpointUrl: `http://${entry.ip}:${entry.port}`,
        hasLocalAi: true,
        status: entry.status,
        capabilityScore: entry.capabilityScore,
        modelsAvailable: entry.models,
        vramEstimateGb: entry.totalVramGb,
        lastHeartbeat: entry.lastHeartbeat.toISOString(),
      });
    } catch {
      // DB write failed; continue with in-memory
    }
  }

  devices.set(id, entry);
  return entry;
}

/** Get all online devices sorted by capability (descending) */
export function getOnlineDevices(): DeviceEntry[] {
  return Array.from(devices.values())
    .filter((d) => d.status === "online")
    .sort((a, b) => b.capabilityScore - a.capabilityScore);
}

/** Get a specific device by ID */
export function getDevice(id: string): DeviceEntry | undefined {
  return devices.get(id);
}

/** Mark a device as offline */
export async function markOffline(id: string): Promise<void> {
  const device = devices.get(id);
  if (device) {
    device.status = "offline";
    if (dbEnabled()) {
      try {
        const db = await loadDb();
        await db.updateDeviceStatus(device.hostname, "offline");
      } catch {
        // DB write failed; continue with in-memory
      }
    }
  }
}

/** Remove a device (decommission) */
export async function removeDevice(id: string): Promise<boolean> {
  const device = devices.get(id);
  if (device && dbEnabled()) {
    try {
      const db = await loadDb();
      await db.removeDevice(device.hostname);
    } catch {
      // DB write failed; continue with in-memory
    }
  }
  return devices.delete(id);
}

/** Get device count */
export function getDeviceCount(): number {
  return devices.size;
}

/** Clear all devices (for testing) */
export function clearDevices(): void {
  devices.clear();
}
