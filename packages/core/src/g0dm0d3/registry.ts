/**
 * SYS-G0DM0D3 G4: DeviceRegistry
 * In-memory registry of discovered G0DM0D3 devices.
 * Phase 2+: backed by talos_devices table.
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

const devices: Map<string, DeviceEntry> = new Map();

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
export function markOffline(id: string): void {
  const device = devices.get(id);
  if (device) {
    device.status = "offline";
  }
}

/** Remove a device (decommission) */
export function removeDevice(id: string): boolean {
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