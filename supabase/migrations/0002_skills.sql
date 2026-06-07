-- Talos OS v8.0 — Skills table (blueprint §12.2)
-- Runtime registry of skills the system uses. Shared across all users (system table).
-- Run: supabase db push

CREATE TABLE IF NOT EXISTS talos_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  source text,
  source_tool text,
  category text,
  prompt_template text,
  trigger_phrases jsonb DEFAULT '[]'::jsonb,
  success_rate float DEFAULT 0.0 CHECK (success_rate >= 0 AND success_rate <= 1),
  is_cached boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_skills_category ON talos_skills(category);
CREATE INDEX IF NOT EXISTS idx_skills_is_cached ON talos_skills(is_cached);
CREATE INDEX IF NOT EXISTS idx_skills_success_rate ON talos_skills(success_rate DESC);

ALTER TABLE talos_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "talos_skills_read_all"
  ON talos_skills FOR SELECT
  USING (true);

CREATE POLICY "talos_skills_write_service"
  ON talos_skills FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
