ALTER TABLE "media_resources" ADD COLUMN IF NOT EXISTS "upstream_asset_id" text;
ALTER TABLE "media_resources" ADD COLUMN IF NOT EXISTS "upstream_asset_status" text;
