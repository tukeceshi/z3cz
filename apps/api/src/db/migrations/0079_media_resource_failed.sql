ALTER TABLE "media_resources" ADD COLUMN IF NOT EXISTS "failed" boolean NOT NULL DEFAULT false;
