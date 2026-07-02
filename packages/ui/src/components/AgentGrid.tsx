"use client";

import { useEffect, useState, useCallback } from "react";
import { AgentCard, type AgentStatus, type Guild } from "./AgentCard";
import { fetchJson } from "@/lib/api";

interface AgentData {
  agentId: string;
  name: string;
  guild: Guild;
  status: AgentStatus;
  capabilityScore: number;
  currentLoad: number;
  role?: string;
  model?: string;
}

const AGENT_GUILD: Record<string, Guild> = {
  loom: "crown", odin: "crown", mimir: "crown", bragi: "crown", system: "crown",
  brokkr: "forge", opencode: "forge",
  muninn: "vault", nornir: "vault",
  huginn: "sanctum", sage: "sanctum",
  eitri: "foundry",
};

const FALLBACK_AGENTS: AgentData[] = [
  { agentId: "loom", name: "The Loom", guild: "crown", status: "idle", capabilityScore: 0.98, currentLoad: 0.1, role: "Reconfiguration Engine" },
  { agentId: "odin", name: "Odin", guild: "crown", status: "executing", capabilityScore: 0.95, currentLoad: 0.4, role: "Chief Coordinator", model: "openrouter/owl-alpha:free" },
  { agentId: "mimir", name: "Mimir", guild: "crown", status: "idle", capabilityScore: 0.92, currentLoad: 0.2, role: "Knowledge Manager" },
  { agentId: "brokkr", name: "Brokkr", guild: "forge", status: "idle", capabilityScore: 0.88, currentLoad: 0.0, role: "Builder Agent" },
  { agentId: "opencode", name: "OpenCode", guild: "forge", status: "executing", capabilityScore: 0.9, currentLoad: 0.6, role: "Dev Environment" },
  { agentId: "muninn", name: "Muninn", guild: "vault", status: "idle", capabilityScore: 0.85, currentLoad: 0.1, role: "Episodic Memory" },
  { agentId: "huginn", name: "Huginn", guild: "sanctum", status: "idle", capabilityScore: 0.88, currentLoad: 0.2, role: "Semantic Memory" },
  { agentId: "sage", name: "Sage", guild: "sanctum", status: "bidding", capabilityScore: 0.85, currentLoad: 0.3, role: "Research Agent" },
  { agentId: "eitri", name: "Eitri", guild: "foundry", status: "idle", capabilityScore: 0.9, currentLoad: 0.0, role: "Fabrication Pipeline" },
  { agentId: "bragi", name: "Bragi", guild: "crown", status: "idle", capabilityScore: 0.82, currentLoad: 0.1, role: "Documentation" },
  { agentId: "nornir", name: "Nornir", guild: "vault", status: "idle", capabilityScore: 0.88, currentLoad: 0.2, role: "Thread of Fate" },
  { agentId: "system", name: "System", guild: "crown", status: "executing", capabilityScore: 0.95, currentLoad: 0.15, role: "System Agent" },
];

interface ApiAgent {
  agentId: string;
  name: string;
  status: AgentStatus;
  capabilityScore: number;
  currentLoad: number;
  role: string;
  primaryModel?: string;
}

function mapAgent(a: ApiAgent): AgentData {
  return {
    agentId: a.agentId,
    name: a.name,
    guild: AGENT_GUILD[a.agentId] ?? "crown",
    status: a.status,
    capabilityScore: a.capabilityScore,
    currentLoad: a.currentLoad,
    role: a.role,
    model: a.primaryModel,
  };
}

interface AgentGridProps {
  detailed?: boolean;
}

export function AgentGrid({ detailed = false }: AgentGridProps) {
  const [agents, setAgents] = useState<AgentData[]>(FALLBACK_AGENTS);

  const fetchAgents = useCallback(async () => {
    try {
      const data = await fetchJson<ApiAgent[]>("/v1/agents");
      setAgents(data.map(mapAgent));
    } catch {
      // Use fallback
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    const interval = setInterval(() => {
      setAgents((prev) =>
        prev.map((a) => ({
          ...a,
          currentLoad: Math.max(0, Math.min(1, a.currentLoad + (Math.random() - 0.5) * 0.1)),
        }))
      );
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`grid ${detailed ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-2 md:grid-cols-3"} gap-3`}>
      {agents.map((agent) => (
        <AgentCard
          key={agent.agentId}
          agentId={agent.agentId}
          name={agent.name}
          guild={agent.guild}
          status={agent.status}
          capabilityScore={agent.capabilityScore}
          currentLoad={agent.currentLoad}
          role={agent.role}
          model={agent.model}
          detailed={detailed}
        />
      ))}
    </div>
  );
}
