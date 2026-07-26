CREATE TABLE IF NOT EXISTS "workflow_folders" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "cover_object_id" text,
  "cover_mime_type" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "workflow_folders_organization_id_idx" ON "workflow_folders" ("organization_id");
CREATE INDEX IF NOT EXISTS "workflow_folders_updated_at_idx" ON "workflow_folders" ("updated_at");

ALTER TABLE "workflows" ADD COLUMN IF NOT EXISTS "folder_id" text REFERENCES "workflow_folders"("id") ON DELETE SET NULL;
ALTER TABLE "workflows" ADD COLUMN IF NOT EXISTS "cover_object_id" text;
ALTER TABLE "workflows" ADD COLUMN IF NOT EXISTS "cover_mime_type" text;

CREATE INDEX IF NOT EXISTS "workflows_folder_id_idx" ON "workflows" ("folder_id");
