CREATE TABLE IF NOT EXISTS api_format_forwarding_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  provider TEXT NOT NULL,
  upstream_base_url TEXT NOT NULL,
  upstream_submit_path TEXT NOT NULL DEFAULT '/v1/video/generations',
  upstream_params JSONB NOT NULL DEFAULT '[]'::jsonb,
  param_mappings JSONB NOT NULL DEFAULT '[]'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS api_format_forwarding_rules_slug_idx
  ON api_format_forwarding_rules (slug);

CREATE INDEX IF NOT EXISTS api_format_forwarding_rules_enabled_idx
  ON api_format_forwarding_rules (enabled);
