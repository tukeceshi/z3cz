ALTER TABLE "media_resources" ADD COLUMN IF NOT EXISTS "interface_id" text;
ALTER TABLE "media_resources" ADD COLUMN IF NOT EXISTS "source" text;
CREATE INDEX IF NOT EXISTS "media_resources_org_source_idx" ON "media_resources" ("organization_id", "source");
