ALTER TABLE "organization_cloud_storage_health"
  ADD COLUMN IF NOT EXISTS "consecutive_failure_count" integer NOT NULL DEFAULT 0;
