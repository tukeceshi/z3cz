ALTER TABLE "media_resources" ADD COLUMN IF NOT EXISTS "upstream_url" text;
ALTER TABLE "media_resources" ADD COLUMN IF NOT EXISTS "expires_at" timestamp with time zone;
