UPDATE "platform_settings"
SET "site_name" = 'z3cz.com'
WHERE "site_name" = 'Dafthunk';

ALTER TABLE "platform_settings"
ALTER COLUMN "site_name" SET DEFAULT 'z3cz.com';
