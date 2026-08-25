ALTER TABLE "agent_conversations"
  ADD COLUMN IF NOT EXISTS "content_fingerprint" text NOT NULL DEFAULT '';
