CREATE TABLE IF NOT EXISTS "ai_interface_create_idempotency" (
  "key" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "interface_id" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "ai_interface_create_idempotency_org_idx"
  ON "ai_interface_create_idempotency" ("organization_id");

ALTER TABLE "organization_ai_interfaces"
  ADD COLUMN IF NOT EXISTS "volcano_setup_status" text;

CREATE UNIQUE INDEX IF NOT EXISTS "organization_ai_interfaces_one_volcano_idx"
  ON "organization_ai_interfaces" ("organization_id")
  WHERE "provider" = 'doubao_volcano';
