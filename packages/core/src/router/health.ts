import type { ProviderId, ProviderHealth } from "../types/provider.js";
import { getHealthyProviders, markProviderHealthy, markProviderUnhealthy } from "./registry.js";

/**
 * SYS-ROUTER R2: HealthChecker
 * Periodically checks cloud provider health.
 */

const healthCache: Map<ProviderId, ProviderHealth> = new Map();

export async function checkProviderHealth(
  providerId: ProviderId,
  endpoint: string,
  timeoutMs: number = 5000
): Promise<ProviderHealth> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(endpoint, { method: "HEAD", signal: controller.signal });
    clearTimeout(timer);

    const health: ProviderHealth = {
      providerId,
      healthy: response.ok,
      latencyMs: Date.now() - start,
      lastChecked: new Date(),
      errorCount: 0,
    };
    healthCache.set(providerId, health);
    if (response.ok) markProviderHealthy(providerId);
    else markProviderUnhealthy(providerId);
    return health;
  } catch (e) {
    const existing = healthCache.get(providerId);
    const health: ProviderHealth = {
      providerId,
      healthy: false,
      latencyMs: Date.now() - start,
      lastChecked: new Date(),
      errorCount: (existing?.errorCount ?? 0) + 1,
      errorMessage: e instanceof Error ? e.message : "unknown",
    };
    healthCache.set(providerId, health);
    markProviderUnhealthy(providerId);
    return health;
  }
}

export function getHealth(providerId: ProviderId): ProviderHealth | undefined {
  return healthCache.get(providerId);
}

export function getAllHealth(): ProviderHealth[] {
  return Array.from(healthCache.values());
}