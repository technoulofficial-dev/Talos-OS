-- Talos OS v8.0 — Initial Database Migration
-- All tables prefixed talos_* with RLS on user_id

CREATE TABLE IF NOT EXISTS talos_guilds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  shared_tools jsonb DEFAULT '[]',
  prompt_template text,
  permissions jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS talos_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hostname text NOT NULL,
  local_endpoint_url text NOT NULL,
  has_local_ai boolean DEFAULT true,
  status text DEFAULT 'online',
  capability_score float DEFAULT 0.5,
  models_available jsonb DEFAULT '[]',
  vram_estimate_gb float,
  last_heartbeat timestamptz DEFAULT now(),
  discovered_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS talos_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id text NOT NULL UNIQUE,
  name text NOT NULL,
  guild_id uuid REFERENCES talos_guilds(id),
  role text NOT NULL,
  primary_model text NOT NULL,
  cloud_model text NOT NULL,
  local_model text,
  max_context_tokens int NOT NULL,
  capabilities jsonb DEFAULT '[]',
  tools jsonb DEFAULT '[]',
  pinned boolean DEFAULT false,
  docker_image text,
  version text DEFAULT '1.0.0',
  capability_score float DEFAULT 0.5,
  current_load float DEFAULT 0.0,
  status text DEFAULT 'idle',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS talos_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  origin_agent text NOT NULL DEFAULT 'system',
  status text DEFAULT 'pending',
  priority text DEFAULT 'normal',
  required_skills jsonb DEFAULT '[]',
  max_tokens int DEFAULT 100000,
  max_cost_usd float DEFAULT 10,
  assigned_agent text,
  auction_id uuid,
  plan_graph jsonb,
  output text,
  error text,
  error_code text,
  tokens_used int DEFAULT 0,
  cost_usd float DEFAULT 0,
  duration_ms int DEFAULT 0,
  retry_count int DEFAULT 0,
  max_retries int DEFAULT 3,
  idempotency_key text,
  prefer_local boolean DEFAULT true,
  depends_on jsonb DEFAULT '[]',
  context jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deadline timestamptz,
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS talos_auctions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES talos_tasks(id),
  announcement jsonb NOT NULL,
  bids jsonb NOT NULL DEFAULT '[]',
  winner_agent_id text,
  status text DEFAULT 'announced',
  settled_at timestamptz,
  performance_score float,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS talos_cortex (
  user_id uuid PRIMARY KEY,
  identity_core jsonb NOT NULL DEFAULT '{}',
  thread_of_fate jsonb NOT NULL DEFAULT '{"verbatim":[],"midRange":[],"distant":[]}',
  thread_digest text DEFAULT '',
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS talos_nornir_markers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  timestamp timestamptz NOT NULL,
  event_type text,
  summary text,
  entities jsonb DEFAULT '[]',
  importance_score float DEFAULT 0.5,
  embedding vector(1536),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS talos_spend_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id text NOT NULL,
  provider_id text NOT NULL,
  task_id uuid,
  tokens_in int DEFAULT 0,
  tokens_out int DEFAULT 0,
  total_tokens int DEFAULT 0,
  cost_usd float DEFAULT 0,
  period_id text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS talos_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS talos_plugins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  version text NOT NULL,
  docker_image text NOT NULL,
  config_schema jsonb,
  health_endpoint text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS talos_audit_trail (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  agent_id text,
  task_id uuid,
  detail jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON talos_tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_agent ON talos_tasks(assigned_agent);
CREATE INDEX IF NOT EXISTS idx_devices_status ON talos_devices(status);
CREATE INDEX IF NOT EXISTS idx_spend_period ON talos_spend_ledger(period_id);
CREATE INDEX IF NOT EXISTS idx_spend_agent ON talos_spend_ledger(agent_id);
CREATE INDEX IF NOT EXISTS idx_nornir_user ON talos_nornir_markers(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_agent ON talos_audit_trail(agent_id);