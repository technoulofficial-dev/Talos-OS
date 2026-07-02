"use client";

import { useCallback, useRef, useState } from "react";
import { AgentGrid } from "@/components/AgentGrid";
import { TaskFlowChart } from "@/components/TaskFlowChart";
import { WorkflowCanvas, buildSavePayload } from "@/components/WorkflowCanvas";
import { StatusBar } from "@/components/StatusBar";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { MemoryView } from "@/components/MemoryView";
import { BlueprintView } from "@/components/BlueprintView";
import { ChatView } from "@/components/ChatView";
import { SystemMetrics } from "@/components/SystemMetrics";
import { fetchJson } from "@/lib/api";
import type { Node, Edge } from "reactflow";

type View = "dashboard" | "agents" | "tasks" | "memory" | "blueprint" | "workflows" | "chat";

async function saveWorkflow(name: string, nodes: Node[], edges: Edge[]): Promise<string> {
  const payload = buildSavePayload(name, nodes, edges);
  return fetchJson<{ id: string }>("/v1/workflow", {
    method: "POST",
    body: JSON.stringify(payload),
  }).then((d) => d.id);
}

async function runWorkflow(workflowId: string): Promise<string> {
  return fetchJson<{ runId: string }>(`/v1/workflow/${workflowId}/run`, {
    method: "POST",
    body: JSON.stringify({ triggeredBy: "ui" }),
  }).then((d) => d.runId);
}

async function pollRunStatus(runId: string, onState: (states: Record<string, string>) => void, signal: AbortSignal) {
  while (!signal.aborted) {
    try {
      const run = await fetchJson<{ state: string; nodeStates?: Record<string, string> }>(
        `/v1/workflow/run/${runId}`, { signal }
      );
      if (run.nodeStates) onState(run.nodeStates);
      if (run.state === "completed" || run.state === "failed") break;
    } catch {
      if (signal.aborted) break;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}

export default function Dashboard() {
  const [currentView, setCurrentView] = useState<View>("dashboard");
  const [systemStatus] = useState<"operational" | "degraded" | "critical">("operational");
  const [runStates, setRunStates] = useState<Record<string, string>>({});
  const abortRef = useRef<AbortController | null>(null);

  const handleSave = useCallback(async (name: string, nodes: Node[], edges: Edge[]) => {
    return saveWorkflow(name, nodes, edges);
  }, []);

  const handleRun = useCallback(async (workflowId: string) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setRunStates({});
    const runId = await runWorkflow(workflowId);
    pollRunStatus(runId, setRunStates, abortRef.current.signal);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Header status={systemStatus} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar currentView={currentView} onViewChange={setCurrentView} />

        <main className="flex-1 p-6 overflow-y-auto">
          {currentView === "dashboard" && (
            <div className="space-y-6">
              <h1 className="font-display text-3xl text-linear-accent">
                Mission Control
              </h1>
              <p className="text-linear-text-secondary font-mono text-sm">
                Orchestrating the Bronze Automaton
              </p>

              <SystemMetrics />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="panel p-4">
                  <h2 className="font-display text-xl text-linear-accent mb-4">
                    Agent Registry
                  </h2>
                  <AgentGrid />
                </div>

                <div className="panel p-4">
                  <h2 className="font-display text-xl text-linear-accent mb-4">
                    Task Flow
                  </h2>
                  <TaskFlowChart />
                </div>
              </div>
            </div>
          )}

          {currentView === "agents" && (
            <div>
              <h1 className="font-display text-3xl text-linear-accent mb-6">
                Agent Management
              </h1>
              <div className="panel p-4">
                <AgentGrid detailed />
              </div>
            </div>
          )}

          {currentView === "tasks" && (
            <div>
              <h1 className="font-display text-3xl text-linear-accent mb-6">
                Task Queue
              </h1>
              <div className="panel p-4">
                <TaskFlowChart detailed />
              </div>
            </div>
          )}

          {currentView === "workflows" && (
            <div className="flex flex-col" style={{ height: "calc(100vh - 120px)" }}>
              <h1 className="font-display text-3xl text-linear-accent mb-4">
                Workflow Canvas
              </h1>
              <div className="flex-1 panel overflow-hidden">
                <WorkflowCanvas onSave={handleSave} onRun={handleRun} runStates={runStates} />
              </div>
            </div>
          )}

          {currentView === "memory" && <MemoryView />}

          {currentView === "blueprint" && <BlueprintView />}

          {currentView === "chat" && <ChatView />}
        </main>
      </div>

      <StatusBar />
    </div>
  );
}