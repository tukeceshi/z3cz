ALTER TABLE "ai_model_invocations"
  ADD COLUMN IF NOT EXISTS "generation_job_id" text;

CREATE INDEX IF NOT EXISTS "ai_model_invocations_generation_job_idx"
  ON "ai_model_invocations" ("generation_job_id")
  WHERE "generation_job_id" IS NOT NULL;
