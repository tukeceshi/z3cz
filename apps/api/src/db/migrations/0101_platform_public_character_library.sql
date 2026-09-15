CREATE TABLE IF NOT EXISTS "platform_public_character_library" (
  "asset_id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL DEFAULT '',
  "image_url" text NOT NULL,
  "gender" text,
  "age" integer,
  "country" text,
  "group_sid" text,
  "synced_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "platform_public_character_library_synced_idx"
  ON "platform_public_character_library" ("synced_at");
CREATE INDEX IF NOT EXISTS "platform_public_character_library_name_idx"
  ON "platform_public_character_library" ("name");
