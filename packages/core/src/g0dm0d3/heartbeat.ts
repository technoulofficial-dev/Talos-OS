import { getOnlineDevices, markOffline } from "./registry.js";
import { isAlive } from "./probe.js";

export interface HeartbeatConfig {
  intervalMs: number;
  timeoutMs: number;
  missedThreshold: number;
}

const DEFAULT_CONFIG: HeartbeatConfig = {
  intervalMs: 30_000,
  timeoutMs: 3_000,
  missedThreshold: 3,
};

const missedCount: Map<string, number> = new Map();
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

export function startHeartbeatMonitor(config?: Partial<HeartbeatConfig>): void {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  if (heartbeatTimer) clearInterval(heartbeatTimer);

  heartbeatTimer = setInterval(async () => {
    const devices = getOnlineDevices();
    for (const device of devices) {
      const alive = await isAlive(`http://${device.ip}:${device.port}`, cfg.timeoutMs);
      if (alive) {
        missedCount.set(device.id, 0);
        device.lastHeartbeat = new Date();
      } else {
        const missed = (missedCount.get(device.id) ?? 0) + 1;
        missedCount.set(device.id, missed);
        if (missed >= cfg.missedThreshold) {
          markOffline(device.id);
          missedCount.delete(device.id);
        }
      }
    }
  }, cfg.intervalMs);
}

export function stopHeartbeatMonitor(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  missedCount.clear();
}