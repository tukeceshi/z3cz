CREATE TABLE IF NOT EXISTS "platform_relay_accounts" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "provider" text NOT NULL DEFAULT 'newapi',
  "base_url" text NOT NULL,
  "api_key_encrypted" text NOT NULL,
  "enabled" boolean NOT NULL DEFAULT true,
  "is_default" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_by" text REFERENCES "users"("id")
);

CREATE INDEX IF NOT EXISTS "platform_relay_accounts_provider_idx" ON "platform_relay_accounts" ("provider");
CREATE INDEX IF NOT EXISTS "platform_relay_accounts_enabled_idx" ON "platform_relay_accounts" ("enabled");
CREATE INDEX IF NOT EXISTS "platform_relay_accounts_is_default_idx" ON "platform_relay_accounts" ("is_default");

ALTER TABLE "workflows" ADD COLUMN IF NOT EXISTS "billing_mode" text NOT NULL DEFAULT 'platform';

CREATE INDEX IF NOT EXISTS "workflows_billing_mode_idx" ON "workflows" ("billing_mode");
