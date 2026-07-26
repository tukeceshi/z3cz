ALTER TABLE "generation_jobs"
  ADD COLUMN IF NOT EXISTS "ready_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "result_json" jsonb,
  ADD COLUMN IF NOT EXISTS "client_request_id" text;

CREATE UNIQUE INDEX IF NOT EXISTS "generation_jobs_org_client_request_idx"
  ON "generation_jobs" ("organization_id", "client_request_id")
  WHERE "client_request_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "generation_jobs_org_ready_at_idx"
  ON "generation_jobs" ("organization_id", "ready_at")
  WHERE "ready_at" IS NOT NULL;
