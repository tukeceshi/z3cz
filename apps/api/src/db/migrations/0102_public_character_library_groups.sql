ALTER TABLE "platform_public_character_library"
  ADD COLUMN IF NOT EXISTS "sort_index" integer NOT NULL DEFAULT 0;

UPDATE "platform_public_character_library"
SET "group_sid" = "asset_id"
WHERE "group_sid" IS NULL OR btrim("group_sid") = '';

ALTER TABLE "platform_public_character_library"
  ALTER COLUMN "group_sid" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "platform_public_character_library_group_idx"
  ON "platform_public_character_library" ("group_sid", "sort_index");
