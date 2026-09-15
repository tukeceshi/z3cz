CREATE TABLE IF NOT EXISTS "character_library_characters" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "workflow_id" text,
  "name" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "character_library_characters_org_idx"
  ON "character_library_characters" ("organization_id");
CREATE INDEX IF NOT EXISTS "character_library_characters_org_workflow_idx"
  ON "character_library_characters" ("organization_id", "workflow_id");

CREATE TABLE IF NOT EXISTS "character_library_character_items" (
  "character_id" text NOT NULL REFERENCES "character_library_characters"("id") ON DELETE CASCADE,
  "resource_id" text NOT NULL REFERENCES "media_resources"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("character_id", "resource_id")
);

CREATE INDEX IF NOT EXISTS "character_library_character_items_resource_idx"
  ON "character_library_character_items" ("resource_id");
