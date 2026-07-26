CREATE TABLE IF NOT EXISTS "organization_cloud_storage_health" (
  "organization_id" text PRIMARY KEY NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "interface_id" text NOT NULL,
  "status" text NOT NULL,
  "reason" text,
  "message" text,
  "bucket" text NOT NULL,
  "region" text NOT NULL,
  "checked_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "organization_cloud_storage_health_status_checked_idx"
  ON "organization_cloud_storage_health" ("status", "checked_at" DESC);

CREATE TABLE IF NOT EXISTS "generation_jobs" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "workflow_id" text,
  "node_id" text,
  "modality" text NOT NULL,
  "status" text NOT NULL,
  "upstream_task_id" text,
  "model_canonical_id" text NOT NULL,
  "interface_id" text NOT NULL,
  "failure_reason" text,
  "health_reason" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "completed_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "generation_jobs_org_status_idx"
  ON "generation_jobs" ("organization_id", "status");

CREATE INDEX IF NOT EXISTS "generation_jobs_org_upstream_task_idx"
  ON "generation_jobs" ("organization_id", "upstream_task_id");
