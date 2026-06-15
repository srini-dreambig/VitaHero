-- VitaHero App Configuration (secure secrets storage)
-- Only accessible via service_role key from edge functions.
-- DO NOT expose this table to anon/authenticated users.

CREATE TABLE IF NOT EXISTS app_config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- No RLS — edge functions access via service_role only
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- INSERT credentials (only run this migration with secure values)
-- The actual values will be set by the edge function admin endpoint
