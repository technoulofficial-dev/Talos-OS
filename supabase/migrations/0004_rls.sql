-- Talos OS v8.0 — Foundation Repair: RLS for all tables from 0001_init.sql
-- Service-role only: system tables, not per-user scoped.
-- Pattern: SELECT open (any authenticated), ALL restricted to service_role.
-- Run: supabase db push

-- ============================================================
-- Enable pgvector extension (needed by talos_nornir_markers, talos_memory_vectors)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- talos_guilds
-- ============================================================
ALTER TABLE talos_guilds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "talos_guilds_read_all"
  ON talos_guilds FOR SELECT
  USING (true);

CREATE POLICY "talos_guilds_write_service"
  ON talos_guilds FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- talos_devices
-- ============================================================
ALTER TABLE talos_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "talos_devices_read_all"
  ON talos_devices FOR SELECT
  USING (true);

CREATE POLICY "talos_devices_write_service"
  ON talos_devices FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- talos_agents
-- ============================================================
ALTER TABLE talos_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "talos_agents_read_all"
  ON talos_agents FOR SELECT
  USING (true);

CREATE POLICY "talos_agents_write_service"
  ON talos_agents FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- talos_tasks
-- ============================================================
ALTER TABLE talos_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "talos_tasks_read_all"
  ON talos_tasks FOR SELECT
  USING (true);

CREATE POLICY "talos_tasks_write_service"
  ON talos_tasks FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- talos_auctions
-- ============================================================
ALTER TABLE talos_auctions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "talos_auctions_read_all"
  ON talos_auctions FOR SELECT
  USING (true);

CREATE POLICY "talos_auctions_write_service"
  ON talos_auctions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- talos_cortex
-- ============================================================
ALTER TABLE talos_cortex ENABLE ROW LEVEL SECURITY;

CREATE POLICY "talos_cortex_read_all"
  ON talos_cortex FOR SELECT
  USING (true);

CREATE POLICY "talos_cortex_write_service"
  ON talos_cortex FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- talos_nornir_markers
-- ============================================================
ALTER TABLE talos_nornir_markers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "talos_nornir_markers_read_all"
  ON talos_nornir_markers FOR SELECT
  USING (true);

CREATE POLICY "talos_nornir_markers_write_service"
  ON talos_nornir_markers FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- talos_memory_vectors
-- ============================================================
ALTER TABLE talos_memory_vectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "talos_memory_vectors_read_all"
  ON talos_memory_vectors FOR SELECT
  USING (true);

CREATE POLICY "talos_memory_vectors_write_service"
  ON talos_memory_vectors FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- talos_spend_ledger
-- ============================================================
ALTER TABLE talos_spend_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "talos_spend_ledger_read_all"
  ON talos_spend_ledger FOR SELECT
  USING (true);

CREATE POLICY "talos_spend_ledger_write_service"
  ON talos_spend_ledger FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- talos_settings
-- ============================================================
ALTER TABLE talos_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "talos_settings_read_all"
  ON talos_settings FOR SELECT
  USING (true);

CREATE POLICY "talos_settings_write_service"
  ON talos_settings FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- talos_plugins
-- ============================================================
ALTER TABLE talos_plugins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "talos_plugins_read_all"
  ON talos_plugins FOR SELECT
  USING (true);

CREATE POLICY "talos_plugins_write_service"
  ON talos_plugins FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- talos_audit_trail
-- ============================================================
ALTER TABLE talos_audit_trail ENABLE ROW LEVEL SECURITY;

CREATE POLICY "talos_audit_trail_read_all"
  ON talos_audit_trail FOR SELECT
  USING (true);

CREATE POLICY "talos_audit_trail_write_service"
  ON talos_audit_trail FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
