"use client";

import { Activity, Shield } from "lucide-react";

interface HeaderProps {
  status: "operational" | "degraded" | "critical";
}

export function Header({ status }: HeaderProps) {
  const statusColor = {
    operational: "text-linear-status-success",
    degraded: "text-linear-status-warning",
    critical: "text-linear-status-danger",
  }[status];

  const statusText = {
    operational: "OPERATIONAL",
    degraded: "DEGRADED",
    critical: "CRITICAL",
  }[status];

  return (
    <header className="border-b border-linear-border-subtle bg-linear-bg-elevated px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-linear-accent" />
          <h1 className="font-display text-2xl text-linear-text tracking-wider">
            TALOS
          </h1>
        </div>
        <div className="text-xs font-mono text-linear-text-tertiary border-l border-linear-border-subtle pl-4">
          THE BRONZE AUTOMATON
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Activity className={`w-4 h-4 ${statusColor}`} />
          <span className={`font-mono text-sm uppercase tracking-wider ${statusColor}`}>
            {statusText}
          </span>
        </div>
        <div className="font-mono text-xs text-linear-text-disabled">
          v8.0.0
        </div>
      </div>
    </header>
  );
}