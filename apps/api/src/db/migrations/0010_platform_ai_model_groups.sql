CREATE TABLE IF NOT EXISTS "platform_ai_model_groups" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "icon" text NOT NULL DEFAULT 'sparkles',
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE "platform_ai_models"
  ADD COLUMN IF NOT EXISTS "group_id" text REFERENCES "platform_ai_model_groups"("id") ON DELETE SET NULL;

ALTER TABLE "platform_ai_models"
  ADD COLUMN IF NOT EXISTS "description" text NOT NULL DEFAULT '';

INSERT INTO "platform_ai_model_groups" ("id", "name", "description", "icon", "sort_order")
VALUES
  ('deepseek', 'DeepSeek', '擅长复杂推理、长上下文和高性价比文本生成', 'zap', 10),
  ('doubao', 'Doubao / Seed', '中文理解能力强，适合创意与多模态任务', 'sparkles', 20)
ON CONFLICT ("id") DO NOTHING;

UPDATE "platform_ai_models"
SET "group_id" = 'deepseek'
WHERE "canonical_id" IN ('deepseek-v4-flash', 'deepseek-v4-pro')
  AND ("group_id" IS NULL OR "group_id" = '');

UPDATE "platform_ai_models"
SET "group_id" = 'doubao'
WHERE "canonical_id" IN ('doubao-seed-evolving', 'doubao-seedream-5')
  AND ("group_id" IS NULL OR "group_id" = '');
