"use client";

import { LayoutDashboard, Users, ListTodo, Brain, FileCode, Workflow, MessageSquare } from "lucide-react";

interface SidebarProps {
  currentView: "dashboard" | "agents" | "tasks" | "memory" | "blueprint" | "workflows" | "chat";
  onViewChange: (view: "dashboard" | "agents" | "tasks" | "memory" | "blueprint" | "workflows" | "chat") => void;
}

const views = [
  { id: "dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
  { id: "chat" as const, label: "Odin Chat", icon: MessageSquare },
  { id: "agents" as const, label: "Agents", icon: Users },
  { id: "tasks" as const, label: "Tasks", icon: ListTodo },
  { id: "workflows" as const, label: "Workflows", icon: Workflow },
  { id: "memory" as const, label: "Memory", icon: Brain },
  { id: "blueprint" as const, label: "Blueprint", icon: FileCode },
];

export function Sidebar({ currentView, onViewChange }: SidebarProps) {
  return (
    <aside className="w-48 bg-linear-bg-elevated border-r border-linear-border-subtle p-4">
      <nav className="space-y-2">
        {views.map((view) => {
          const Icon = view.icon;
          const isActive = currentView === view.id;
          return (
            <button
              key={view.id}
              onClick={() => onViewChange(view.id)}
              className={`
                w-full flex items-center gap-3 px-3 py-2 rounded-md font-mono text-sm transition-all
                ${
                  isActive
                    ? "bg-linear-accent/15 text-linear-accent border-l-2 border-linear-accent"
                    : "text-linear-text-tertiary hover:text-linear-text hover:bg-linear-bg-overlay"
                }
              `}
            >
              <Icon className="w-4 h-4" />
              {view.label}
            </button>
          );
        })}
      </nav>

      <div className="mt-8 pt-4 border-t border-linear-border-subtle">
        <div className="font-mono text-xs text-linear-text-disabled space-y-1">
          <div>Talos OS v8.0</div>
          <div>Engine: Operational</div>
        </div>
      </div>
    </aside>
  );
}