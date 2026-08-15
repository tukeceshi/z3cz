ALTER TABLE "media_resources" ADD COLUMN IF NOT EXISTS "generating" boolean NOT NULL DEFAULT false;
