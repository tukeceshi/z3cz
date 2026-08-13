ALTER TABLE "api_format_forwarding_rules" RENAME TO "format_transform_templates";

ALTER TABLE "format_transform_templates" DROP COLUMN IF EXISTS "slug";
ALTER TABLE "format_transform_templates" DROP COLUMN IF EXISTS "upstream_url";

ALTER TABLE "format_transform_templates"
  ADD COLUMN IF NOT EXISTS "scope" text NOT NULL DEFAULT 'platform';

DROP INDEX IF EXISTS "api_format_forwarding_rules_slug_idx";
DROP INDEX IF EXISTS "api_format_forwarding_rules_enabled_idx";

CREATE INDEX IF NOT EXISTS "format_transform_templates_enabled_idx"
  ON "format_transform_templates" ("enabled");

CREATE INDEX IF NOT EXISTS "format_transform_templates_scope_idx"
  ON "format_transform_templates" ("scope");
