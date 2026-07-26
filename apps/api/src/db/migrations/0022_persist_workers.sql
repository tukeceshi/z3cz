ALTER TABLE platform_settings
ADD COLUMN IF NOT EXISTS persist_worker_pool_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS persist_workers (
  id text PRIMARY KEY,
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  secret_hash text NOT NULL,
  max_concurrent_jobs integer NOT NULL DEFAULT 1,
  active_job_count integer NOT NULL DEFAULT 0,
  last_heartbeat_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS persist_workers_enabled_idx ON persist_workers (enabled);
