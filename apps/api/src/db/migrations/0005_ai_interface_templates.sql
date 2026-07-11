-- AI interface templates: D1 index only; source/runtime artifacts live in object storage.

CREATE TABLE IF NOT EXISTS "ai_interface_templates" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "provider" text NOT NULL,
  "execution_mode" text NOT NULL DEFAULT 'sync',
  "enabled" boolean NOT NULL DEFAULT true,
  "is_system" boolean NOT NULL DEFAULT false,
  "is_default" boolean NOT NULL DEFAULT false,
  "sort_order" integer NOT NULL DEFAULT 0,
  "spec_version" integer NOT NULL DEFAULT 1,
  "artifact_checksum" text NOT NULL,
  "artifact_key" text NOT NULL,
  "source_key" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_by" text REFERENCES "users"("id")
);

CREATE INDEX IF NOT EXISTS "ai_interface_templates_provider_idx"
  ON "ai_interface_templates" ("provider");
CREATE INDEX IF NOT EXISTS "ai_interface_templates_enabled_idx"
  ON "ai_interface_templates" ("enabled");
CREATE INDEX IF NOT EXISTS "ai_interface_templates_is_default_idx"
  ON "ai_interface_templates" ("is_default");

CREATE TABLE IF NOT EXISTS "ai_interface_template_revisions" (
  "id" text PRIMARY KEY NOT NULL,
  "template_id" text NOT NULL REFERENCES "ai_interface_templates"("id") ON DELETE CASCADE,
  "version" integer NOT NULL,
  "artifact_checksum" text NOT NULL,
  "artifact_key" text NOT NULL,
  "source_key" text NOT NULL,
  "change_note" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "created_by" text REFERENCES "users"("id")
);

CREATE INDEX IF NOT EXISTS "ai_interface_template_revisions_template_id_idx"
  ON "ai_interface_template_revisions" ("template_id");

CREATE TABLE IF NOT EXISTS "organization_ai_interfaces" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "template_id" text NOT NULL REFERENCES "ai_interface_templates"("id"),
  "template_version" integer,
  "name" text NOT NULL,
  "provider" text NOT NULL,
  "base_url" text,
  "selected_model" text,
  "api_key_encrypted" text NOT NULL,
  "metadata" text,
  "enabled" boolean NOT NULL DEFAULT true,
  "is_default" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "organization_ai_interfaces_org_name_idx"
  ON "organization_ai_interfaces" ("organization_id", "name");
CREATE INDEX IF NOT EXISTS "organization_ai_interfaces_org_provider_idx"
  ON "organization_ai_interfaces" ("organization_id", "provider");
CREATE INDEX IF NOT EXISTS "organization_ai_interfaces_template_id_idx"
  ON "organization_ai_interfaces" ("template_id");
