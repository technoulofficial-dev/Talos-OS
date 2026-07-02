"use client";

import { Brain, Shield, Database, Workflow, Cpu, Eye, BookOpen, MessageSquare, Terminal, Settings, Search } from "lucide-react";

export type AgentStatus = "idle" | "bidding" | "executing" | "offline";
export type Guild = "crown" | "forge" | "sanctum" | "vault" | "foundry";

interface AgentCardProps {
  agentId: string;
  name: string;
  guild: Guild;
  status: AgentStatus;
  capabilityScore: number;
  currentLoad: number;
  role?: string;
  model?: string;
  lastActive?: string;
  detailed?: boolean;
  onClick?: () => void;
}

const GUILD_META: Record<Guild, { label: string; color: string; bg: string; icon: typeof Brain }> = {
  crown: { label: "Crown", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/30", icon: Shield },
  forge: { label: "Forge", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/30", icon: Cpu },
  sanctum: { label: "Sanctum", color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/30", icon: Eye },
  vault: { label: "Vault", color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/30", icon: Database },
  foundry: { label: "Foundry", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30", icon: Workflow },
};

const STATUS_META: Record<AgentStatus, { label: string; dot: string; text: string }> = {
  idle: { label: "Idle", dot: "bg-gray-500", text: "text-linear-text-tertiary" },
  bidding: { label: "Bidding", dot: "bg-amber-400 animate-pulse", text: "text-amber-400" },
  executing: { label: "Executing", dot: "bg-cyan-500 animate-pulse", text: "text-cyan-400" },
  offline: { label: "Offline", dot: "bg-red-500", text: "text-red-400" },
};

const AGENT_ICONS: Record<string, typeof Brain> = {
  odin: Shield,
  brokkr: Cpu,
  mimir: BookOpen,
  muninn: Eye,
  huginn: Search,
  bragi: MessageSquare,
  eitri: Workflow,
  sage: Brain,
  loom: Settings,
  nornir: Database,
  opencode: Terminal,
  system: Cpu,
};

function loadBarColor(load: number): string {
  if (load > 0.8) return "bg-red-500";
  if (load > 0.5) return "bg-amber-500";
  return "bg-linear-accent";
}

export function AgentCard({
  agentId,
  name,
  guild,
  status,
  capabilityScore,
  currentLoad,
  role,
  model,
  lastActive,
  detailed = false,
  onClick,
}: AgentCardProps) {
  const guildMeta = GUILD_META[guild];
  const statusMeta = STATUS_META[status];
  const GuildIcon = guildMeta.icon;
  const AgentIcon = AGENT_ICONS[agentId] ?? Brain;

  return (
    <button
      onClick={onClick}
      className={`
        panel p-4 text-left transition-all border-l-2 ${guildMeta.bg}
        hover:border-l-linear-accent hover:shadow-[0_0_12px_rgba(94,106,210,0.15)]
        ${onClick ? "cursor-pointer" : "cursor-default"}
      `}
      data-testid={`agent-card-${agentId}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className={`p-1.5 rounded-md ${guildMeta.bg}`}>
            <AgentIcon className={`w-4 h-4 ${guildMeta.color}`} />
          </div>
          <div>
            <div className="font-display text-sm text-linear-text">{name}</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <GuildIcon className={`w-3 h-3 ${guildMeta.color}`} />
              <span className={`font-mono text-xs ${guildMeta.color}`}>{guildMeta.label}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${statusMeta.dot}`} />
          <span className={`font-mono text-xs ${statusMeta.text}`}>{statusMeta.label}</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="font-mono text-xs text-linear-text-tertiary uppercase tracking-wider">Load</span>
          <span className="font-mono text-xs text-linear-text-secondary">{(currentLoad * 100).toFixed(0)}%</span>
        </div>
        <div className="h-1.5 bg-linear-bg-overlay rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 rounded-full ${loadBarColor(currentLoad)}`}
            style={{ width: `${currentLoad * 100}%` }}
          />
        </div>

        <div className="flex justify-between items-center">
          <span className="font-mono text-xs text-linear-text-tertiary uppercase tracking-wider">Score</span>
          <span className="font-mono text-xs text-linear-accent">{(capabilityScore * 100).toFixed(0)}%</span>
        </div>

        {detailed && (
          <>
            {role && (
              <div className="flex justify-between items-center">
                <span className="font-mono text-xs text-linear-text-tertiary uppercase tracking-wider">Role</span>
                <span className="font-mono text-xs text-linear-text-secondary">{role}</span>
              </div>
            )}
            {model && (
              <div className="flex justify-between items-center">
                <span className="font-mono text-xs text-linear-text-tertiary uppercase tracking-wider">Model</span>
                <span className="font-mono text-xs text-linear-text-secondary truncate max-w-[120px]">{model}</span>
              </div>
            )}
            {lastActive && (
              <div className="flex justify-between items-center">
                <span className="font-mono text-xs text-linear-text-tertiary uppercase tracking-wider">Last Active</span>
                <span className="font-mono text-xs text-linear-text-tertiary">{lastActive}</span>
              </div>
            )}
          </>
        )}
      </div>
    </button>
  );
}
