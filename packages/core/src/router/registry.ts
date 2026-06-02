import type { ProviderId } from "../types/provider.js";

export interface CloudProvider {
  id: ProviderId;
  baseUrl: string;
  apiKey: string;
  models: string[];
  priority: number;
  healthy: boolean;
  lastHealthCheck: Date;
}

const providers: Map<ProviderId, CloudProvider> = new Map();

export function registerProvider(provider: CloudProvider): void {
  providers.set(provider.id, provider);
}

export function getProvider(id: ProviderId): CloudProvider | undefined {
  return providers.get(id);
}

export function getHealthyProviders(): CloudProvider[] {
  return Array.from(providers.values())
    .filter((p) => p.healthy)
    .sort((a, b) => a.priority - b.priority);
}

export function markProviderHealthy(id: ProviderId): void {
  const p = providers.get(id);
  if (p) { p.healthy = true; p.lastHealthCheck = new Date(); }
}

export function markProviderUnhealthy(id: ProviderId): void {
  const p = providers.get(id);
  if (p) { p.healthy = false; p.lastHealthCheck = new Date(); }
}

export function clearProviders(): void {
  providers.clear();
}