ALTER TABLE "api_format_forwarding_rules"
  ADD COLUMN IF NOT EXISTS "locked_resolution" text;
