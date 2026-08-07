CREATE TABLE IF NOT EXISTS "media_resources" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "mime_type" text NOT NULL,
  "storage_key" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "media_resources_organization_id_idx"
  ON "media_resources" ("organization_id");
