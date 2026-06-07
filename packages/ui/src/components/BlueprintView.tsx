"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw, GitBranch, AlertTriangle, ChevronRight, ChevronDown, CheckCircle2, CircleDashed, XCircle, Play } from "lucide-react";

const API_BASE = "http://localhost:8642";

type RiskLevel = "low" | "medium" | "high" | "critical";

interface DiffEntry {
  type: "added" | "modified" | "removed";
  path: string;
  semanticChange: string;
  affectedAgents: string[];
  riskLevel: RiskLevel;
}

interface ReconfigurationStep {
  order: number;
  action: string;
  target: string;
  estimatedDurationMs: number;
  riskLevel: RiskLevel;
  rollbackAction?: string;
}

interface ReconfigurationPlan {
  id: string;
  sourceVersion: string;
  targetVersion: string;
  diffSummary: string;
  steps: ReconfigurationStep[];
  requiresApproval: boolean;
  estimatedTotalTimeMs: number;
  rollbackStrategy: string;
  createdAt: string;
  status: "pending" | "approved" | "applying" | "applied" | "failed" | "rolled_back";
}

const RISK_STYLES: Record<RiskLevel, { bg: string; text: string; border: string; icon: typeof CircleDashed }> = {
  low: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/40", icon: CheckCircle2 },
  medium: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/40", icon: AlertTriangle },
  high: { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/40", icon: AlertTriangle },
  critical: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/40", icon: XCircle },
};

const STATUS_STYLES: Record<ReconfigurationPlan["status"], string> = {
  pending: "text-amber-400 bg-amber-500/10 border-amber-500/40",
  approved: "text-blue-400 bg-blue-500/10 border-blue-500/40",
  applying: "text-cyan-400 bg-cyan-500/10 border-cyan-500/40",
  applied: "text-emerald-400 bg-emerald-500/10 border-emerald-500/40",
  failed: "text-red-400 bg-red-500/10 border-red-500/40",
  rolled_back: "text-orange-400 bg-orange-500/10 border-orange-500/40",
};

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return rs > 0 ? `${m}m ${rs}s` : `${m}m`;
}

export function BlueprintView() {
  const [diffs, setDiffs] = useState<DiffEntry[] | null>(null);
  const [plan, setPlan] = useState<ReconfigurationPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState("HEAD~1");
  const [target, setTarget] = useState("HEAD");
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  const [applying, setApplying] = useState(false);

  const fetchDiffs = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPlan(null);
    try {
      const res = await fetch(`${API_BASE}/v1/blueprint/diff`, { method: "POST" });
      if (!res.ok) throw new Error(`diff: ${res.status}`);
      const json = (await res.json()) as { data: DiffEntry[] };
      setDiffs(json.data ?? []);
    } catch (err) {
      setError((err as Error).message);
      setDiffs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDiffs();
  }, [fetchDiffs]);

  const generatePlan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/v1/blueprint/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, target }),
      });
      if (!res.ok) throw new Error(`plan: ${res.status}`);
      const json = (await res.json()) as { data: ReconfigurationPlan };
      setPlan(json.data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [source, target]);

  const toggleStep = (order: number) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(order)) next.delete(order);
      else next.add(order);
      return next;
    });
  };

  const riskBreakdown = (diffs ?? []).reduce<Record<RiskLevel, number>>(
    (acc, d) => {
      acc[d.riskLevel] = (acc[d.riskLevel] ?? 0) + 1;
      return acc;
    },
    { low: 0, medium: 0, high: 0, critical: 0 },
  );

  const hasDiffs = diffs && diffs.length > 0;
  const hasCritical = riskBreakdown.critical > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-linear-accent">Living Blueprint</h1>
          <p className="text-linear-text-secondary font-mono text-sm mt-1">
            Blueprint reconfiguration · Watch for changes · Generate reconfiguration plan
          </p>
        </div>
        <button onClick={fetchDiffs} className="btn-secondary flex items-center gap-2" data-testid="blueprint-refresh-button">
          <RefreshCw className="w-4 h-4" />
          Refresh Diff
        </button>
      </div>

      {error && (
        <div className="panel p-4 text-linear-status-danger font-mono text-sm">
          Error: {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="panel p-4 space-y-3">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-linear-accent" />
            <h2 className="font-display text-xl text-linear-accent">Blueprint Diff</h2>
          </div>
          <p className="text-linear-text-tertiary font-mono text-xs">
            Semantic diff of BLUEPRINT.md between commits. Source: <code>{source}</code> · Target: <code>{target}</code>
          </p>

          {loading && !diffs ? (
            <div className="text-linear-text-tertiary font-mono text-sm py-4 text-center">Loading diff…</div>
          ) : !hasDiffs ? (
            <div className="text-linear-text-tertiary font-mono text-sm py-4 text-center">
              {diffs && diffs.length === 0
                ? "No blueprint changes detected — system is in sync."
                : "Run a diff to see changes."}
            </div>
          ) : (
            <div className="space-y-2">
              {diffs!.map((d) => {
                const styles = RISK_STYLES[d.riskLevel];
                const Icon = styles.icon;
                return (
                  <div
                    key={d.path}
                    className={`p-3 rounded-md border ${styles.border} ${styles.bg}`}
                  >
                    <div className="flex items-start gap-2">
                      <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${styles.text}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-mono text-xs uppercase tracking-wider ${styles.text}`}>
                            {d.type}
                          </span>
                          <code className="font-mono text-sm text-linear-text truncate">{d.path}</code>
                        </div>
                        {d.semanticChange && (
                          <div className="font-mono text-xs text-linear-text-secondary mt-1.5 line-clamp-3">
                            {d.semanticChange}
                          </div>
                        )}
                        {d.affectedAgents.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {d.affectedAgents.map((a) => (
                              <span
                                key={a}
                                className="px-1.5 py-0.5 rounded-sm bg-linear-bg-overlay text-linear-text-secondary font-mono text-xs"
                              >
                                {a}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="panel p-4 space-y-3">
          <h2 className="font-display text-xl text-linear-accent">Risk Summary</h2>
          {diffs && diffs.length > 0 ? (
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-2">
                {(["critical", "high", "medium", "low"] as RiskLevel[]).map((r) => {
                  const styles = RISK_STYLES[r];
                  return (
                    <div
                      key={r}
                      className={`p-2 rounded-md border ${styles.border} ${styles.bg}`}
                    >
                      <div className={`text-xs font-mono uppercase tracking-wider ${styles.text}`}>
                        {r}
                      </div>
                      <div className="text-2xl font-display text-linear-text mt-1">
                        {riskBreakdown[r] ?? 0}
                      </div>
                    </div>
                  );
                })}
              </div>
              {hasCritical && (
                <div className="flex items-start gap-2 p-3 rounded-md bg-red-500/10 border border-red-500/40">
                  <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm font-mono text-red-400">
                    Critical risk detected. Reconfiguration requires explicit approval before applying.
                  </div>
                </div>
              )}
              <div className="pt-2 space-y-2">
                <label className="block font-mono text-xs text-linear-text-tertiary uppercase tracking-wider">
                  Commit Range
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    placeholder="HEAD~1"
                    className="flex-1 bg-linear-bg-overlay border border-linear-border-subtle rounded-md px-3 py-2 font-mono text-sm text-linear-text focus:outline-none focus:border-linear-accent"
                  />
                  <span className="text-linear-text-tertiary">→</span>
                  <input
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    placeholder="HEAD"
                    className="flex-1 bg-linear-bg-overlay border border-linear-border-subtle rounded-md px-3 py-2 font-mono text-sm text-linear-text focus:outline-none focus:border-linear-accent"
                  />
                </div>
                <button
                  onClick={generatePlan}
                  disabled={loading}
                  className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="blueprint-generate-plan"
                >
                  <Play className="w-4 h-4" />
                  {loading ? "Generating…" : "Generate Reconfiguration Plan"}
                </button>
              </div>
            </div>
          ) : (
            <div className="text-linear-text-tertiary font-mono text-sm py-4 text-center">
              No changes to assess.
            </div>
          )}
        </div>
      </div>

      {plan && (
        <div className="panel p-4 space-y-4">
          <div className="flex items-start justify-between flex-wrap gap-2">
            <div>
              <h2 className="font-display text-xl text-linear-accent">Reconfiguration Plan</h2>
              <p className="font-mono text-xs text-linear-text-tertiary mt-1">
                ID: <code>{plan.id}</code> · Created: {new Date(plan.createdAt).toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded-md border text-xs font-mono uppercase tracking-wider ${STATUS_STYLES[plan.status]}`}>
                {plan.status}
              </span>
              {plan.requiresApproval && (
                <span className="px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/40 text-amber-400 text-xs font-mono uppercase tracking-wider">
                  Approval Required
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div>
              <div className="text-xs text-linear-text-tertiary font-mono uppercase tracking-wider">Source</div>
              <div className="font-mono text-linear-text">{plan.sourceVersion}</div>
            </div>
            <div>
              <div className="text-xs text-linear-text-tertiary font-mono uppercase tracking-wider">Target</div>
              <div className="font-mono text-linear-text">{plan.targetVersion}</div>
            </div>
            <div>
              <div className="text-xs text-linear-text-tertiary font-mono uppercase tracking-wider">Est. Time</div>
              <div className="font-mono text-linear-text">{fmtDuration(plan.estimatedTotalTimeMs)}</div>
            </div>
          </div>

          <div>
            <div className="text-xs text-linear-text-tertiary font-mono uppercase tracking-wider mb-1">
              Rollback Strategy
            </div>
            <div className="font-mono text-sm text-linear-text-secondary p-2 rounded-md bg-linear-bg-overlay">
              {plan.rollbackStrategy}
            </div>
          </div>

          <div>
            <div className="text-xs text-linear-text-tertiary font-mono uppercase tracking-wider mb-2">
              Steps ({plan.steps.length})
            </div>
            <div className="space-y-1.5">
              {plan.steps.map((s) => {
                const styles = RISK_STYLES[s.riskLevel];
                const Icon = styles.icon;
                const expanded = expandedSteps.has(s.order);
                return (
                  <div
                    key={s.order}
                    className={`rounded-md border ${styles.border} ${styles.bg}`}
                  >
                    <button
                      onClick={() => toggleStep(s.order)}
                      className="w-full flex items-center gap-3 p-2.5 text-left"
                    >
                      {expanded ? (
                        <ChevronDown className="w-3 h-3 text-linear-text-tertiary" />
                      ) : (
                        <ChevronRight className="w-3 h-3 text-linear-text-tertiary" />
                      )}
                      <div className="w-6 text-xs font-mono text-linear-text-tertiary">
                        #{s.order}
                      </div>
                      <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${styles.text}`} />
                      <div className="flex-1 font-mono text-sm text-linear-text">
                        <span className={styles.text}>{s.action}</span>{" "}
                        <span className="text-linear-text-tertiary">→</span>{" "}
                        {s.target}
                      </div>
                      <div className="text-xs font-mono text-linear-text-tertiary">
                        {fmtDuration(s.estimatedDurationMs)}
                      </div>
                    </button>
                    {expanded && (
                      <div className="px-3 pb-2.5 pl-12 space-y-1">
                        <div className="font-mono text-xs text-linear-text-tertiary">
                          Risk: <span className={styles.text}>{s.riskLevel}</span>
                        </div>
                        {s.rollbackAction && (
                          <div className="font-mono text-xs text-linear-text-tertiary">
                            Rollback: <code className="text-linear-text-secondary">{s.rollbackAction}</code>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {plan.requiresApproval && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setApplying(true);
                  setTimeout(() => {
                    setPlan({ ...plan, status: "approved" });
                    setApplying(false);
                  }, 500);
                }}
                disabled={applying || plan.status !== "pending"}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {applying ? "Approving…" : "Approve Plan"}
              </button>
              <button
                onClick={() => setPlan(null)}
                className="btn-secondary"
                disabled={applying}
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
