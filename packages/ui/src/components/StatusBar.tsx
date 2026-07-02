"use client";

import { useEffect, useState } from "react";
import { Cpu, Database, Zap } from "lucide-react";
import { fetchJson } from "@/lib/api";

interface ProviderHealth {
  id: string;
  healthy: boolean;
  latencyMs?: number;
  unlimited: boolean;
}

export function StatusBar() {
  const [providers, setProviders] = useState<ProviderHealth[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchJson<ProviderHealth[]>("/health/providers")
      .then(setProviders)
      .catch(() => setError(true));
  }, []);

  const healthy = providers.filter((p) => p.healthy).length;
  const total = providers.length;
  const unlimited = providers.filter((p) => p.unlimited).length;

  return (
    <footer className="border-t border-linear-border-subtle bg-linear-bg-elevated px-6 py-2 flex items-center justify-between font-mono text-xs">
      <div className="flex items-center gap-6 text-linear-text-tertiary">
        {error ? (
          <span className="text-linear-status-danger">Providers: unreachable</span>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Cpu className="w-3 h-3" />
              <span>Providers: {healthy}/{total} healthy</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-3 h-3 text-linear-accent" />
              <span>{unlimited} unlimited</span>
            </div>
          </>
        )}
        <div className="flex items-center gap-2">
          <Database className="w-3 h-3" />
          <span>API: {error ? "Offline" : "Online"}</span>
        </div>
      </div>
      <div className="text-linear-text-disabled">
        PORT 8642
      </div>
    </footer>
  );
}