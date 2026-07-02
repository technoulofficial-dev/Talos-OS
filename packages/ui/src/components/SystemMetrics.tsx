"use client";

import { useEffect, useState } from "react";
import { Shield, Zap, AlertTriangle, Cpu, Globe, Ban, Activity } from "lucide-react";
import { MetricCard } from "./MetricCard";
import { fetchJson } from "@/lib/api";

interface CapacityData {
  forceLocal: boolean;
  killSwitch: boolean;
  providerUsage: Record<string, { dailyTokens: number; dailyCostUsd: number; dailyRequests: number }>;
  circuits: Record<string, { failures: number; open: boolean }>;
}

interface ProviderHealth {
  id: string;
  healthy: boolean;
  latencyMs?: number;
  unlimited: boolean;
}

export function SystemMetrics() {
  const [capacity, setCapacity] = useState<CapacityData | null>(null);
  const [health, setHealth] = useState<ProviderHealth[]>([]);

  useEffect(() => {
    fetchJson<CapacityData>("/v1/capacity").then(setCapacity).catch(() => {});
    fetchJson<ProviderHealth[]>("/health/providers").then(setHealth).catch(() => {});
  }, []);

  const healthy = health.filter((p) => p.healthy).length;
  const total = health.length;
  const openCircuits = capacity
    ? Object.values(capacity.circuits).filter((c) => c.open).length
    : 0;
  const totalTokens = capacity
    ? Object.values(capacity.providerUsage).reduce((s, u) => s + u.dailyTokens, 0)
    : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <MetricCard
        label="System Status"
        value={capacity?.killSwitch ? "KILLED" : capacity?.forceLocal ? "Local Only" : "Online"}
        icon={Shield}
        trend={capacity?.killSwitch ? "down" : "neutral"}
        trendValue={capacity?.killSwitch ? "Emergency" : undefined}
      />
      <MetricCard
        label="Provider Health"
       value={total > 0 ? `${healthy}/${total}` : "—"}
        icon={Globe}
        trend={healthy === total ? "up" : healthy < total && healthy > 0 ? "neutral" : "down"}
        trendValue={total > 0 ? `${((healthy / total) * 100).toFixed(0)}%` : undefined}
      />
      <MetricCard
        label="Open Circuits"
        value={openCircuits}
        icon={Ban}
        trend={openCircuits > 0 ? "down" : "up"}
        trendValue={openCircuits > 0 ? `${openCircuits} blocked` : "All clear"}
      />
      <MetricCard
        label="Daily Tokens"
        value={totalTokens.toLocaleString()}
        icon={Activity}
        subtitle="Across all providers"
      />
    </div>
  );
}
