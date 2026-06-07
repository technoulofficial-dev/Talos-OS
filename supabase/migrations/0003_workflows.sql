-- Talos OS v8.0 — Workflow persistence tables (blueprint §3.5, §20)
-- Stores workflow definitions, runs, and per-node execution logs.
-- System tables (not per-user); service_role can write, all can read.
-- Run: supabase db push

-- ============================================================
-- Workflow definitions
-- ============================================================
CREATE TABLE IF NOT EXISTS talos_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  version text DEFAULT '1.0.0',
  definition jsonb NOT NULL,
  variables jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflows_name ON talos_workflows(name);
CREATE INDEX IF NOT EXISTS idx_workflows_updated_at ON talos_workflows(updated_at DESC);

-- ============================================================
-- Workflow runs
-- ============================================================
CREATE TABLE IF NOT EXISTS talos_workflow_runs (
  run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES talos_workflows(id) ON DELETE CASCADE,
  workflow_name text NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('draft', 'pending', 'running', 'completed', 'failed', 'cancelled')),
  variables jsonb DEFAULT '{}'::jsonb,
  triggered_by text DEFAULT 'api',
  error text,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_runs_workflow ON talos_workflow_runs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_runs_state ON talos_workflow_runs(state);
CREATE INDEX IF NOT EXISTS idx_runs_started ON talos_workflow_runs(started_at DESC);

-- ============================================================
-- Per-node execution logs
-- ============================================================
CREATE TABLE IF NOT EXISTS talos_run_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES talos_workflow_runs(run_id) ON DELETE CASCADE,
  node_id text NOT NULL,
  state text NOT NULL CHECK (state IN ('pending', 'running', 'completed', 'failed', 'skipped')),
  attempts int DEFAULT 0,
  output jsonb,
  error text,
  duration_ms int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_run_logs_run ON talos_run_logs(run_id);
CREATE INDEX IF NOT EXISTS idx_run_logs_node ON talos_run_logs(run_id, node_id);
CREATE INDEX IF NOT EXISTS idx_run_logs_state ON talos_run_logs(state);

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE talos_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE talos_workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE talos_run_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "talos_workflows_read_all"
  ON talos_workflows FOR SELECT
  USING (true);

CREATE POLICY "talos_workflows_write_service"
  ON talos_workflows FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "talos_runs_read_all"
  ON talos_workflow_runs FOR SELECT
  USING (true);

CREATE POLICY "talos_runs_write_service"
  ON talos_workflow_runs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "talos_run_logs_read_all"
  ON talos_run_logs FOR SELECT
  USING (true);

CREATE POLICY "talos_run_logs_write_service"
  ON talos_run_logs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
