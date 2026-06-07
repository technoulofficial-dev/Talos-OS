"use client";

import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  subtitle?: string;
  className?: string;
}

const TREND_CONFIG = {
  up: { icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  down: { icon: TrendingDown, color: "text-red-400", bg: "bg-red-500/10" },
  neutral: { icon: Minus, color: "text-linear-text-tertiary", bg: "bg-linear-bg-overlay" },
};

export function MetricCard({
  label,
  value,
  icon: Icon,
  trend,
  trendValue,
  subtitle,
  className = "",
}: MetricCardProps) {
  const trendConfig = trend ? TREND_CONFIG[trend] : null;
  const TrendIcon = trendConfig?.icon;

  return (
    <div className={`panel p-4 ${className}`} data-testid="metric-card">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="font-mono text-xs text-linear-text-tertiary uppercase tracking-wider mb-1">
            {label}
          </div>
          <div className="font-display text-2xl text-linear-text">{value}</div>
          {subtitle && (
            <div className="font-mono text-xs text-linear-text-tertiary mt-1">{subtitle}</div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {trendConfig && TrendIcon && (
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md ${trendConfig.bg}`}>
              <TrendIcon className={`w-3 h-3 ${trendConfig.color}`} />
              {trendValue && (
                <span className={`font-mono text-xs ${trendConfig.color}`}>{trendValue}</span>
              )}
            </div>
          )}
          {Icon && (
            <div className="p-2 rounded-md bg-linear-bg-overlay">
              <Icon className="w-4 h-4 text-linear-accent" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
