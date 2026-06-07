"use client";

import { useEffect, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  Position,
} from "reactflow";

interface TaskNode {
  id: string;
  label: string;
  agent: string;
  status: "queued" | "processing" | "done" | "failed";
  cost: number;
}

const STATUS_COLORS: Record<string, string> = {
  queued: "#3b82f6",
  processing: "#facc15",
  done: "#10b981",
  failed: "#ef4444",
};

const DEMO_TASKS: TaskNode[] = [
  { id: "t1", label: "Analyze requirements", agent: "Odin", status: "done", cost: 0.12 },
  { id: "t2", label: "Design architecture", agent: "Mimir", status: "done", cost: 0.18 },
  { id: "t3", label: "Split into subtasks", agent: "Brokkr", status: "done", cost: 0.05 },
  { id: "t4", label: "Implement backend", agent: "OpenCode", status: "processing", cost: 0.34 },
  { id: "t5", label: "Implement frontend", agent: "OpenCode", status: "processing", cost: 0.28 },
  { id: "t6", label: "Write tests", agent: "OpenCode", status: "queued", cost: 0.0 },
  { id: "t7", label: "Review code", agent: "Muninn", status: "queued", cost: 0.0 },
  { id: "t8", label: "Deploy", agent: "System", status: "queued", cost: 0.0 },
];

interface TaskFlowChartProps {
  detailed?: boolean;
}

export function TaskFlowChart({ detailed = false }: TaskFlowChartProps) {
  const [tasks, setTasks] = useState<TaskNode[]>(DEMO_TASKS);

  useEffect(() => {
    const interval = setInterval(() => {
      setTasks((prev) => {
        const processing = prev.find((t) => t.status === "processing");
        if (processing && Math.random() > 0.6) {
          return prev.map((t) =>
            t.id === processing.id ? { ...t, status: "done" as const, cost: t.cost + 0.01 } : t
          );
        }
        const queued = prev.find((t) => t.status === "queued");
        if (queued && Math.random() > 0.7) {
          return prev.map((t) =>
            t.id === queued.id ? { ...t, status: "processing" as const, cost: t.cost + 0.01 } : t
          );
        }
        return prev;
      });
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const nodes: Node[] = tasks.map((task, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    return {
      id: task.id,
      position: { x: col * 220, y: row * 120 },
      data: { label: `${task.label}\n[${task.agent}]` },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      style: {
        background: "#1a1a1a",
        border: `2px solid ${STATUS_COLORS[task.status]}`,
        borderRadius: "2px",
        padding: "8px 12px",
        fontSize: "11px",
        fontFamily: "monospace",
        color: "#e8e8e8",
        width: 180,
        whiteSpace: "pre-wrap",
      },
    };
  });

  const edges: Edge[] = tasks
    .slice(1)
    .map((task, i) => ({
      id: `e${i}`,
      source: tasks[i].id,
      target: task.id,
      animated: task.status === "processing",
      style: { stroke: "#b87333", strokeWidth: 1 },
    }));

  return (
    <div style={{ height: detailed ? 600 : 300, background: "#0a0a0a" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        proOptions={{ hideAttribution: true }}
        style={{ background: "#0a0a0a" }}
      >
        <Background color="#333" gap={16} />
        {detailed && <Controls />}
        {detailed && (
          <MiniMap
            nodeColor={(n) => {
              const task = tasks.find((t) => t.id === n.id);
              return task ? STATUS_COLORS[task.status] : "#666";
            }}
            maskColor="rgba(0,0,0,0.6)"
            style={{ background: "#1a1a1a" }}
          />
        )}
      </ReactFlow>
    </div>
  );
}