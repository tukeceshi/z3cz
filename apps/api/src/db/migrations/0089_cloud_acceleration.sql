ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "platform_cloud_acceleration_enabled" boolean NOT NULL DEFAULT false;

ALTER TABLE "media_resources" ADD COLUMN IF NOT EXISTS "cloud_acceleration_status" text;

CREATE TABLE IF NOT EXISTS "ai_interface_cloud_acceleration" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "ai_interface_id" text NOT NULL REFERENCES "organization_ai_interfaces"("id") ON DELETE CASCADE,
  "enabled_at" timestamp with time zone NOT NULL DEFAULT now(),
  "disabled_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "ai_interface_cloud_acceleration_org_idx"
  ON "ai_interface_cloud_acceleration" ("organization_id");

CREATE UNIQUE INDEX IF NOT EXISTS "ai_interface_cloud_acceleration_active_unique"
  ON "ai_interface_cloud_acceleration" ("organization_id", "ai_interface_id")
  WHERE "disabled_at" IS NULL;
