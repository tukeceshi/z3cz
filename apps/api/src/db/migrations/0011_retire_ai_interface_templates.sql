-- Retire AI interface templates: drop FK/tables; keep optional legacy columns on org interfaces.
ALTER TABLE "organization_ai_interfaces" DROP CONSTRAINT IF EXISTS "organization_ai_interfaces_template_id_fkey";
ALTER TABLE "organization_ai_interfaces" ALTER COLUMN "template_id" DROP NOT NULL;
DROP TABLE IF EXISTS "ai_interface_template_revisions";
DROP TABLE IF EXISTS "ai_interface_templates";
