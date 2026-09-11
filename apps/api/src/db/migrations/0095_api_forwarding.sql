ALTER TABLE "organization_ai_interfaces"
ADD COLUMN IF NOT EXISTS "api_forwarding_enabled" boolean NOT NULL DEFAULT false;
