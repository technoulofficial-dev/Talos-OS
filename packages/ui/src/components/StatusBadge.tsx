"use client";

export type StatusLevel = "operational" | "degraded" | "critical" | "offline" | "pending" | "success" | "warning" | "danger" | "info";

interface StatusBadgeProps {
  status: StatusLevel;
  label?: string;
  size?: "sm" | "md";
  showDot?: boolean;
}

const STATUS_CONFIG: Record<StatusLevel, { dot: string; text: string; bg: string; border: string; defaultLabel: string }> = {
  operational: { dot: "bg-emerald-500", text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", defaultLabel: "Operational" },
  success: { dot: "bg-emerald-500", text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", defaultLabel: "Success" },
  degraded: { dot: "bg-amber-400 animate-pulse", text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", defaultLabel: "Degraded" },
  warning: { dot: "bg-amber-400 animate-pulse", text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", defaultLabel: "Warning" },
  critical: { dot: "bg-red-500 animate-pulse", text: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30", defaultLabel: "Critical" },
  danger: { dot: "bg-red-500 animate-pulse", text: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30", defaultLabel: "Danger" },
  offline: { dot: "bg-gray-500", text: "text-linear-text-tertiary", bg: "bg-gray-500/10", border: "border-gray-500/30", defaultLabel: "Offline" },
  pending: { dot: "bg-blue-400 animate-pulse", text: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30", defaultLabel: "Pending" },
  info: { dot: "bg-blue-400", text: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30", defaultLabel: "Info" },
};

const SIZE_CLASSES = {
  sm: "px-2 py-0.5 text-xs gap-1.5",
  md: "px-3 py-1 text-xs gap-2",
};

export function StatusBadge({ status, label, size = "sm", showDot = true }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const displayLabel = label ?? config.defaultLabel;

  return (
    <span
      className={`inline-flex items-center rounded-md border font-mono ${config.bg} ${config.border} ${config.text} ${SIZE_CLASSES[size]}`}
      data-testid={`status-badge-${status}`}
    >
      {showDot && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${config.dot}`} />}
      {displayLabel}
    </span>
  );
}
