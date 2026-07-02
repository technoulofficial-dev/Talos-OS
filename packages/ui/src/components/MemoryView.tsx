"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { RefreshCw, Search, Plus, Trash2, Network, BarChart3 } from "lucide-react";
import { fetchJson } from "@/lib/api";

interface Triple {
  id: string;
  subject: string;
  predicate: string;
  object: string;
  context?: string;
  createdAt: string;
  weight: number;
}

interface GraphStats {
  totalTriples: number;
  uniqueSubjects: number;
  uniquePredicates: number;
  uniqueObjects: number;
  totalWeight: number;
  byPredicate: Record<string, number>;
}

const PREDICATE_COLORS: Record<string, string> = {
  depends_on: "text-blue-400",
  is_master_blueprint: "text-purple-400",
  is_single_source_of_truth: "text-purple-400",
  is_implemented_by: "text-emerald-400",
  requires: "text-amber-400",
  is_blocked_by: "text-red-400",
  reduces_context_exhaustion: "text-cyan-400",
  follows_template: "text-pink-400",
  uses: "text-indigo-400",
  integrates_with: "text-cyan-400",
  passing: "text-emerald-400",
  fixed: "text-emerald-400",
};

function predicateColor(p: string): string {
  return PREDICATE_COLORS[p] ?? "text-linear-text-tertiary";
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MemoryView() {
  const [triples, setTriples] = useState<Triple[]>([]);
  const [stats, setStats] = useState<GraphStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newPredicate, setNewPredicate] = useState("depends_on");
  const [newObject, setNewObject] = useState("");
  const [newContext, setNewContext] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [predicateFilter, setPredicateFilter] = useState<string>("");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [triples, stats] = await Promise.all([
        fetchJson<Triple[]>("/v1/graphify/triples?limit=500"),
        fetchJson<GraphStats>("/v1/graphify/stats"),
      ]);
      setTriples(triples ?? []);
      setStats(stats ?? null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return triples.filter((t) => {
      if (predicateFilter && t.predicate !== predicateFilter) return false;
      if (!q) return true;
      return (
        t.subject.toLowerCase().includes(q) ||
        t.predicate.toLowerCase().includes(q) ||
        t.object.toLowerCase().includes(q) ||
        (t.context?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [triples, search, predicateFilter]);

  const predicates = useMemo(() => {
    const set = new Set<string>();
    for (const t of triples) set.add(t.predicate);
    return Array.from(set).sort();
  }, [triples]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await fetchJson(`/v1/graphify/triple/${id}`, { method: "DELETE" });
      setTriples((prev) => prev.filter((t) => t.id !== id));
      if (stats) {
        setStats({ ...stats, totalTriples: stats.totalTriples - 1 });
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }, [stats]);

  const handleAdd = useCallback(async () => {
    if (!newSubject.trim() || !newPredicate.trim() || !newObject.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const triple = await fetchJson<Triple>("/v1/graphify/triple", {
        method: "POST",
        body: JSON.stringify({
          subject: newSubject.trim(),
          predicate: newPredicate.trim(),
          object: newObject.trim(),
          context: newContext.trim() || undefined,
        }),
      });
      setTriples((prev) => [triple, ...prev]);
      setNewSubject("");
      setNewObject("");
      setNewContext("");
      setShowAdd(false);
      fetchJson<GraphStats>("/v1/graphify/stats").then(setStats).catch(() => {});
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }, [newSubject, newPredicate, newObject, newContext]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-linear-accent">Memory</h1>
          <p className="text-linear-text-secondary font-mono text-sm mt-1">
            Cortex identity core + Nornir knowledge graph (graphify)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAdd((s) => !s)}
            className="btn-primary flex items-center gap-2"
            data-testid="memory-add-button"
          >
            <Plus className="w-4 h-4" />
            {showAdd ? "Cancel" : "Add Triple"}
          </button>
          <button onClick={fetchAll} className="btn-secondary flex items-center gap-2" data-testid="memory-refresh-button">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Total" value={stats.totalTriples} icon={Network} />
          <StatCard label="Subjects" value={stats.uniqueSubjects} />
          <StatCard label="Predicates" value={stats.uniquePredicates} />
          <StatCard label="Objects" value={stats.uniqueObjects} />
          <StatCard label="Total Weight" value={stats.totalWeight} icon={BarChart3} />
        </div>
      )}

      {showAdd && (
        <div className="panel p-4 space-y-3">
          <h2 className="font-display text-lg text-linear-accent">New Knowledge Triple</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              placeholder="Subject (e.g. OdinAgent)"
              className="bg-linear-bg-overlay border border-linear-border-subtle rounded-md px-3 py-2 font-mono text-sm text-linear-text focus:outline-none focus:border-linear-accent"
            />
            <input
              value={newPredicate}
              onChange={(e) => setNewPredicate(e.target.value)}
              placeholder="Predicate (e.g. depends_on)"
              list="memory-predicate-suggestions"
              className="bg-linear-bg-overlay border border-linear-border-subtle rounded-md px-3 py-2 font-mono text-sm text-linear-text focus:outline-none focus:border-linear-accent"
            />
            <datalist id="memory-predicate-suggestions">
              {predicates.map((p) => <option key={p} value={p} />)}
            </datalist>
            <input
              value={newObject}
              onChange={(e) => setNewObject(e.target.value)}
              placeholder="Object (e.g. AiEngine)"
              className="bg-linear-bg-overlay border border-linear-border-subtle rounded-md px-3 py-2 font-mono text-sm text-linear-text focus:outline-none focus:border-linear-accent"
            />
          </div>
          <input
            value={newContext}
            onChange={(e) => setNewContext(e.target.value)}
            placeholder="Context (optional, e.g. ADR-035)"
            className="w-full bg-linear-bg-overlay border border-linear-border-subtle rounded-md px-3 py-2 font-mono text-sm text-linear-text focus:outline-none focus:border-linear-accent"
          />
          <button
            onClick={handleAdd}
            disabled={submitting || !newSubject.trim() || !newPredicate.trim() || !newObject.trim()}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Saving…" : "Save Triple"}
          </button>
        </div>
      )}

      <div className="panel p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <div className="flex-1 flex items-center gap-2 bg-linear-bg-overlay border border-linear-border-subtle rounded-md px-3 py-2">
            <Search className="w-4 h-4 text-linear-text-tertiary" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search subject, predicate, object, context…"
              className="flex-1 bg-transparent font-mono text-sm text-linear-text focus:outline-none"
            />
          </div>
          {predicates.length > 0 && (
            <select
              value={predicateFilter}
              onChange={(e) => setPredicateFilter(e.target.value)}
              className="bg-linear-bg-overlay border border-linear-border-subtle rounded-md px-3 py-2 font-mono text-sm text-linear-text focus:outline-none focus:border-linear-accent"
            >
              <option value="">All predicates</option>
              {predicates.map((p) => (
                <option key={p} value={p}>
                  {p} ({stats?.byPredicate?.[p] ?? "?"})
                </option>
              ))}
            </select>
          )}
        </div>

        {error && (
          <div className="text-linear-status-danger font-mono text-sm">Error: {error}</div>
        )}

        {loading ? (
          <div className="text-linear-text-tertiary font-mono text-sm py-8 text-center">Loading triples…</div>
        ) : filtered.length === 0 ? (
          <div className="text-linear-text-tertiary font-mono text-sm py-8 text-center">
            {triples.length === 0
              ? "No triples yet. Add the first one above."
              : "No triples match the current filters."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-linear-border-subtle text-linear-text-tertiary font-mono text-xs uppercase tracking-wider">
                  <th className="py-2 pr-3">Subject</th>
                  <th className="py-2 pr-3">Predicate</th>
                  <th className="py-2 pr-3">Object</th>
                  <th className="py-2 pr-3">Context</th>
                  <th className="py-2 pr-3">Created</th>
                  <th className="py-2 pr-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-linear-border-subtle/50 hover:bg-linear-bg-overlay/40"
                  >
                    <td className="py-2 pr-3 font-mono text-linear-text">{t.subject}</td>
                    <td className={`py-2 pr-3 font-mono ${predicateColor(t.predicate)}`}>{t.predicate}</td>
                    <td className="py-2 pr-3 font-mono text-linear-text">{t.object}</td>
                    <td className="py-2 pr-3 font-mono text-linear-text-tertiary text-xs">
                      {t.context ?? "—"}
                    </td>
                    <td className="py-2 pr-3 font-mono text-linear-text-tertiary text-xs whitespace-nowrap">
                      {fmtDate(t.createdAt)}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="text-linear-text-tertiary hover:text-linear-status-danger transition-colors"
                        title="Delete triple"
                        aria-label={`Delete triple ${t.subject} ${t.predicate} ${t.object}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {stats && Object.keys(stats.byPredicate).length > 0 && (
        <div className="panel p-4">
          <h2 className="font-display text-lg text-linear-accent mb-3">Predicate Distribution</h2>
          <div className="space-y-1.5">
            {Object.entries(stats.byPredicate)
              .sort((a, b) => b[1] - a[1])
              .map(([pred, count]) => {
                const max = Math.max(...Object.values(stats.byPredicate));
                const pct = (count / max) * 100;
                return (
                  <div key={pred} className="flex items-center gap-3 text-xs font-mono">
                    <div className={`w-40 truncate ${predicateColor(pred)}`}>{pred}</div>
                    <div className="flex-1 h-4 bg-linear-bg-overlay rounded-sm overflow-hidden">
                      <div
                        className="h-full bg-linear-accent/60"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="w-10 text-right text-linear-text-tertiary">{count}</div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="panel p-3">
      <div className="flex items-center gap-2 text-linear-text-tertiary text-xs font-mono uppercase tracking-wider">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </div>
      <div className="text-2xl font-display text-linear-accent mt-1">{value}</div>
    </div>
  );
}
