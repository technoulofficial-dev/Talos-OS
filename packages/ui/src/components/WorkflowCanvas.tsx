"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Edge,
  type Node,
  type NodeChange,
  type EdgeChange,
  type Connection,
  Position,
  MarkerType,
} from "reactflow";

const NODE_TYPES = [
  { type: "agent", label: "Agent", color: "#b87333", defaultConfig: { agentId: "odin", prompt: "" } },
  { type: "council", label: "Council", color: "#cd7f32", defaultConfig: { proposal: { title: "Decide", description: "", priority: "normal" } } },
  { type: "plugin", label: "Plugin", color: "#a78bfa", defaultConfig: { tool: "", args: {} } },
  { type: "http", label: "HTTP", color: "#00e5ff", defaultConfig: { url: "https://example.com", method: "GET" } },
  { type: "code", label: "Code", color: "#10b981", defaultConfig: { code: "return variables;" } },
  { type: "condition", label: "Condition", color: "#facc15", defaultConfig: { expression: "true" } },
  { type: "parallel", label: "Parallel", color: "#f472b6", defaultConfig: { branches: 2 } },
  { type: "loop", label: "Loop", color: "#fb923c", defaultConfig: { iterSource: "", maxIterations: 10 } },
  { type: "sub_workflow", label: "Sub-Workflow", color: "#38bdf8", defaultConfig: { subWorkflowId: "", passThrough: {} } },
  { type: "graphify", label: "Graphify", color: "#4ade80", defaultConfig: { graphifyAction: "query", entity: "", predicate: "", limit: 10 } },
] as const;

type WorkflowNodeType = (typeof NODE_TYPES)[number]["type"];

interface PaletteEntry {
  type: WorkflowNodeType;
  label: string;
  color: string;
}

interface NodeData {
  label: string;
  type: WorkflowNodeType;
  config: Record<string, unknown>;
}

const palette: PaletteEntry[] = NODE_TYPES.map((n) => ({
  type: n.type as WorkflowNodeType,
  label: n.label,
  color: n.color,
}));

let nextId = 1;
function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${nextId++}`;
}

const STATE_COLORS: Record<string, string> = {
  pending: "#666",
  running: "#facc15",
  completed: "#10b981",
  failed: "#ef4444",
  skipped: "#3b82f6",
};

function nodeStyle(type: WorkflowNodeType, state?: string): React.CSSProperties {
  const paletteEntry = palette.find((p) => p.type === type);
  const borderColor = state ? STATE_COLORS[state] ?? paletteEntry?.color : paletteEntry?.color;
  return {
    background: "#1a1a1a",
    border: `2px solid ${borderColor ?? "#666"}`,
    borderRadius: "2px",
    padding: "8px 12px",
    fontSize: "11px",
    fontFamily: "monospace",
    color: "#e8e8e8",
    width: 180,
  };
}

function makeNode(type: WorkflowNodeType, position: { x: number; y: number }): Node<NodeData> {
  const entry = palette.find((p) => p.type === type);
  const cfgEntry = NODE_TYPES.find((n) => n.type === type);
  return {
    id: genId(type),
    type: "default",
    position,
    data: {
      label: entry?.label ?? type,
      type,
      config: { ...(cfgEntry?.defaultConfig ?? {}) },
    },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    style: nodeStyle(type),
  };
}

function toWorkflowNodes(nodes: Node<NodeData>[]): Array<{
  id: string;
  type: WorkflowNodeType;
  name: string;
  config: Record<string, unknown>;
  dependsOn: string[];
}> {
  const depMap = new Map<string, string[]>();
  for (const edge of edgesRef.value) {
    const list = depMap.get(edge.target) ?? [];
    list.push(edge.source);
    depMap.set(edge.target, list);
  }
  return nodes.map((n) => ({
    id: n.id,
    type: n.data.type,
    name: n.data.label,
    config: n.data.config,
    dependsOn: depMap.get(n.id) ?? [],
  }));
}

const edgesRef: { value: Edge[] } = { value: [] };

interface WorkflowCanvasProps {
  initialNodes?: Node<NodeData>[];
  initialName?: string;
  onSave: (name: string, nodes: Node<NodeData>[], edges: Edge[]) => Promise<string | void>;
  onRun?: (workflowId: string) => Promise<void>;
  readOnly?: boolean;
  runStates?: Record<string, string>;
}

export function WorkflowCanvas({
  initialNodes = [],
  initialName = "Untitled Workflow",
  onSave,
  onRun,
  readOnly = false,
  runStates = {},
}: WorkflowCanvasProps) {
  const [nodes, setNodes] = useState<Node<NodeData>[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [name, setName] = useState(initialName);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [workflowId, setWorkflowId] = useState<string | null>(null);

  edgesRef.value = edges;

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );
  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            animated: false,
            style: { stroke: "#b87333", strokeWidth: 1 },
            markerEnd: { type: MarkerType.ArrowClosed, color: "#b87333" },
          },
          eds
        )
      );
    },
    []
  );

  const addNode = (type: WorkflowNodeType) => {
    if (readOnly) return;
    const offset = nodes.length * 30;
    setNodes((nds) => [...nds, makeNode(type, { x: 100 + offset, y: 100 + offset })]);
  };

  const removeSelected = () => {
    if (readOnly || !selectedId) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedId));
    setEdges((eds) => eds.filter((e) => e.source !== selectedId && e.target !== selectedId));
    setSelectedId(null);
  };

  const updateNodeConfig = (patch: Record<string, unknown>) => {
    if (readOnly || !selectedId) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedId
          ? { ...n, data: { ...n.data, config: { ...n.data.config, ...patch } } }
          : n
      )
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const id = await onSave(name, nodes, edges);
      if (id) setWorkflowId(id);
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleRun = async () => {
    if (!onRun) return;
    setRunning(true);
    setSaveError(null);
    try {
      if (!workflowId) {
        const id = await onSave(name, nodes, edges);
        if (id) setWorkflowId(id);
        else throw new Error("Save failed — cannot run unsaved workflow");
      }
      await onRun(workflowId!);
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const decoratedNodes = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        style: nodeStyle(n.data.type, runStates[n.id]),
      })),
    [nodes, runStates]
  );

  const selectedNode = nodes.find((n) => n.id === selectedId) ?? null;

  return (
    <div className="flex h-full gap-2">
      {!readOnly && (
        <aside className="w-44 panel p-3 overflow-y-auto">
          <h3 className="font-mono text-xs text-bronze-300 uppercase tracking-wider mb-3">
            Node Palette
          </h3>
          <div className="space-y-1">
            {palette.map((p) => (
              <button
                key={p.type}
                onClick={() => addNode(p.type)}
                className="w-full text-left px-2 py-1.5 font-mono text-xs text-gray-300 hover:bg-bronze-400/10 border-l-2 border-transparent hover:border-bronze-400 transition-all"
                data-testid={`palette-${p.type}`}
              >
                <span
                  className="inline-block w-2 h-2 rounded-full mr-2"
                  style={{ background: p.color }}
                />
                {p.label}
              </button>
            ))}
          </div>

          <div className="mt-6 pt-3 border-t border-bronze-400/20">
            <h3 className="font-mono text-xs text-bronze-300 uppercase tracking-wider mb-2">
              Workflow
            </h3>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gunmetal-500 border border-bronze-400/30 px-2 py-1 text-xs font-mono text-gray-200 focus:outline-none focus:border-cyan-500"
              placeholder="Workflow name"
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleSave}
                disabled={saving || nodes.length === 0}
                className="flex-1 btn-secondary disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              {onRun && (
                <button
                  onClick={handleRun}
                  disabled={running || nodes.length === 0}
                  className="flex-1 btn-primary disabled:opacity-50"
                >
                  {running ? "Running…" : "Run"}
                </button>
              )}
            </div>
            {workflowId && (
              <p className="text-[10px] text-linear-text-disabled mt-1 font-mono">
                ID: {workflowId.slice(0, 8)}
              </p>
            )}
            {saveError && (
              <p className="text-xs text-linear-status-danger mt-2 font-mono break-words">
                {saveError}
              </p>
            )}
          </div>

          <div className="mt-6 pt-3 border-t border-bronze-400/20">
            <button
              onClick={removeSelected}
              disabled={!selectedId}
              className="w-full btn-bronze disabled:opacity-30"
            >
              Delete Selected
            </button>
          </div>
        </aside>
      )}

      <div className="flex-1 panel" style={{ minHeight: 500, background: "#0a0a0a" }}>
        <ReactFlow
          nodes={decoratedNodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={(_, n) => setSelectedId(n.id)}
          onPaneClick={() => setSelectedId(null)}
          fitView
          proOptions={{ hideAttribution: true }}
          nodesDraggable={!readOnly}
          nodesConnectable={!readOnly}
          elementsSelectable={!readOnly}
        >
          <Background color="#333" gap={16} />
          <Controls />
          <MiniMap
            nodeColor={(n) => {
              const node = nodes.find((x) => x.id === n.id);
              const entry = node ? palette.find((p) => p.type === node.data.type) : null;
              return entry?.color ?? "#666";
            }}
            maskColor="rgba(0,0,0,0.6)"
            style={{ background: "#1a1a1a" }}
          />
        </ReactFlow>
      </div>

      {!readOnly && (
        <aside className="w-72 panel p-3 overflow-y-auto">
          <h3 className="font-mono text-xs text-bronze-300 uppercase tracking-wider mb-3">
            Config
          </h3>
          {!selectedNode && (
            <p className="font-mono text-xs text-gray-500">Click a node to edit its config.</p>
          )}
          {selectedNode && (
            <NodeConfigForm
              node={selectedNode}
              onChange={(patch) => updateNodeConfig(patch)}
            />
          )}
        </aside>
      )}
    </div>
  );
}

interface NodeConfigFormProps {
  node: Node<NodeData>;
  onChange: (patch: Record<string, unknown>) => void;
}

function NodeConfigForm({ node, onChange }: NodeConfigFormProps) {
  const cfg = node.data.config;
  return (
    <div className="space-y-3 font-mono text-xs">
      <div>
        <div className="text-bronze-300 mb-1">Type</div>
        <div className="text-gray-300">{node.data.type}</div>
      </div>
      <div>
        <label className="text-bronze-300 block mb-1">Label</label>
        <input
          value={node.data.label}
          onChange={(e) => {
            const val = e.target.value;
            const n = { ...node, data: { ...node.data, label: val } };
            void n;
            // Direct data patch is via onChange wrapper
          }}
          className="w-full bg-gunmetal-500 border border-bronze-400/30 px-2 py-1 text-gray-200"
          disabled
        />
        <p className="text-gray-600 mt-1 text-[10px]">
          Label fixed for now; use the canvas to drag.
        </p>
      </div>
      <div>
        <label className="text-bronze-300 block mb-1">Config (JSON)</label>
        <textarea
          value={JSON.stringify(cfg, null, 2)}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              onChange({ ...parsed });
            } catch {
              // ignore parse errors while typing
            }
          }}
          rows={12}
          className="w-full bg-gunmetal-500 border border-bronze-400/30 px-2 py-1 text-gray-200 font-mono text-[11px]"
        />
        <p className="text-gray-600 mt-1 text-[10px]">
          Edit JSON. Applied on valid parse.
        </p>
      </div>
    </div>
  );
}

export function buildSavePayload(name: string, nodes: Node<NodeData>[], edges: Edge[]) {
  const depMap = new Map<string, string[]>();
  for (const edge of edges) {
    const list = depMap.get(edge.target) ?? [];
    list.push(edge.source);
    depMap.set(edge.target, list);
  }
  return {
    name,
    description: "",
    variables: {},
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.data.type,
      name: n.data.label,
      config: n.data.config,
      dependsOn: depMap.get(n.id) ?? [],
    })),
  };
}
