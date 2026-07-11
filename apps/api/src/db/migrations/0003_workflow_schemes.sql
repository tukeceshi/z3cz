CREATE TABLE IF NOT EXISTS "workflow_schemes" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "icon" text,
  "allowed_triggers" text NOT NULL,
  "allowed_runtimes" text NOT NULL,
  "include_tags" text,
  "include_node_types" text,
  "exclude_node_types" text,
  "always_include_node_types" text,
  "is_default" boolean NOT NULL DEFAULT false,
  "is_system" boolean NOT NULL DEFAULT false,
  "sort_order" integer NOT NULL DEFAULT 0,
  "enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_by" text REFERENCES "users"("id")
);

CREATE INDEX IF NOT EXISTS "workflow_schemes_enabled_idx" ON "workflow_schemes" ("enabled");
CREATE INDEX IF NOT EXISTS "workflow_schemes_sort_order_idx" ON "workflow_schemes" ("sort_order");
CREATE INDEX IF NOT EXISTS "workflow_schemes_is_default_idx" ON "workflow_schemes" ("is_default");

INSERT INTO "workflow_schemes" (
  "id",
  "name",
  "description",
  "icon",
  "allowed_triggers",
  "allowed_runtimes",
  "include_tags",
  "include_node_types",
  "exclude_node_types",
  "always_include_node_types",
  "is_default",
  "is_system",
  "sort_order",
  "enabled"
) VALUES (
  'omnipotent',
  '全能方案',
  '包含全部触发方式、执行模式与节点',
  'layers',
  '["manual","http_webhook","http_request","form_webhook","form_request","email_message","queue_message","scheduled","discord_event","telegram_event","whatsapp_event","slack_event"]',
  '["worker","workflow"]',
  NULL,
  NULL,
  NULL,
  NULL,
  true,
  true,
  0,
  true
) ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "workflows" ADD COLUMN IF NOT EXISTS "scheme_id" text;

UPDATE "workflows"
SET "scheme_id" = 'omnipotent'
WHERE "scheme_id" IS NULL;

ALTER TABLE "workflows"
  ALTER COLUMN "scheme_id" SET DEFAULT 'omnipotent';

ALTER TABLE "workflows"
  ALTER COLUMN "scheme_id" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'workflows_scheme_id_workflow_schemes_id_fk'
  ) THEN
    ALTER TABLE "workflows"
      ADD CONSTRAINT "workflows_scheme_id_workflow_schemes_id_fk"
      FOREIGN KEY ("scheme_id") REFERENCES "workflow_schemes"("id");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "workflows_scheme_id_idx" ON "workflows" ("scheme_id");
