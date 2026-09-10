ALTER TABLE "organizations"
ADD COLUMN IF NOT EXISTS "persist_worker_pool_enabled" boolean NOT NULL DEFAULT false;

ALTER TABLE "persist_workers"
ADD COLUMN IF NOT EXISTS "organization_id" text REFERENCES "organizations"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "persist_workers_organization_id_idx"
  ON "persist_workers" ("organization_id");
