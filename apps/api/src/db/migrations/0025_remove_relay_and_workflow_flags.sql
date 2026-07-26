DROP INDEX IF EXISTS "workflows_billing_mode_idx";
DROP INDEX IF EXISTS "workflows_enabled_idx";
ALTER TABLE "workflows" DROP COLUMN IF EXISTS "billing_mode";
ALTER TABLE "workflows" DROP COLUMN IF EXISTS "enabled";
DROP TABLE IF EXISTS "platform_relay_accounts";
