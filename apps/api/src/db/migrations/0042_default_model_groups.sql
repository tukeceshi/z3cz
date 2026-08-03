-- Canonical default platform AI model groups (from curated admin state)
-- + brand icons + Seedance assignment.

-- Stable Seedance group (replace UUID-created admin group if present)
INSERT INTO "platform_ai_model_groups" (
  "id", "name", "description", "icon", "modality", "sort_order"
) VALUES
  ('seedance', 'Seedance', '地表最强视频模型', 'doubao', 'video', 30)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "icon" = EXCLUDED."icon",
  "modality" = EXCLUDED."modality",
  "sort_order" = EXCLUDED."sort_order",
  "updated_at" = now();

-- Upsert curated groups (names / descriptions / logos / modality / order)
INSERT INTO "platform_ai_model_groups" (
  "id", "name", "description", "icon", "modality", "sort_order"
) VALUES
  ('deepseek', 'DeepSeek', '擅长复杂推理、长上下文和高性价比文本生成', 'deepseek', 'text', 10),
  ('doubao-text', 'Seed', '中文理解能力强，适合创意与多模态任务', 'doubao', 'text', 20),
  ('glm', 'GLM', '智谱 GLM 系列', 'glm', 'text', 30),
  ('kimi', 'Kimi', 'Moonshot Kimi 系列', 'kimi', 'text', 40),
  ('openai', 'GPT', 'OpenAI GPT 系列', 'openai', 'text', 50),
  ('gemini', 'Gemini', 'Google Gemini 系列', 'gemini', 'text', 60),
  ('grok-text', 'Grok', 'xAI Grok 系列', 'grok', 'text', 80),
  ('claude', 'Claude', 'Anthropic Claude 系列', 'claude', 'text', 90),
  ('doubao', 'Seedream', 'Seed / Seedream / Seedance 豆包三姐妹', 'doubao', 'image', 20),
  ('openai-image', 'GPT Image', 'OpenAI GPT 系列', 'openai', 'image', 50),
  ('nano-banana', 'Nano Banana', 'Google Nano Banana 生图系列', 'gemini', 'image', 70),
  ('grok', 'Grok Imagine', 'xAI Grok 系列', 'grok', 'image', 80),
  ('veo', 'Veo', 'Google Veo 视频生成系列', 'gemini', 'video', 75),
  ('grok-video', 'Grok Imagine Video', 'xAI Grok 系列', 'grok', 'video', 80),
  ('minimax', 'MiniMax', 'MiniMax 语音合成系列', 'minimax', 'audio', 95)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "icon" = EXCLUDED."icon",
  "modality" = EXCLUDED."modality",
  "sort_order" = EXCLUDED."sort_order",
  "updated_at" = now();

-- Model → group assignments
UPDATE "platform_ai_models" SET "group_id" = 'deepseek', "updated_at" = now()
WHERE "canonical_id" IN ('deepseek-v4-pro', 'deepseek-v4-flash');

UPDATE "platform_ai_models" SET "group_id" = 'doubao-text', "updated_at" = now()
WHERE "canonical_id" IN ('doubao-seed-evolving');

UPDATE "platform_ai_models" SET "group_id" = 'glm', "updated_at" = now()
WHERE "canonical_id" IN ('glm-5-2');

UPDATE "platform_ai_models" SET "group_id" = 'kimi', "updated_at" = now()
WHERE "canonical_id" IN ('kimi-k3', 'kimi-k2.6', 'kimi-k2.5');

UPDATE "platform_ai_models" SET "group_id" = 'openai', "updated_at" = now()
WHERE "canonical_id" IN ('gpt-5-6-sol', 'gpt-5-6-terra', 'gpt-5-6-luna');

UPDATE "platform_ai_models" SET "group_id" = 'gemini', "updated_at" = now()
WHERE "canonical_id" IN ('gemini-3-5-flash', 'gemini-3-6-flash', 'gemini-3-5-flash-lite');

UPDATE "platform_ai_models" SET "group_id" = 'grok-text', "updated_at" = now()
WHERE "canonical_id" IN ('grok-4-5', 'grok-4-3');

UPDATE "platform_ai_models" SET "group_id" = 'claude', "updated_at" = now()
WHERE "canonical_id" IN ('claude-sonnet-5', 'claude-opus-5', 'claude-haiku-4-5');

UPDATE "platform_ai_models" SET "group_id" = 'doubao', "updated_at" = now()
WHERE "canonical_id" IN ('doubao-seedream-5');

UPDATE "platform_ai_models" SET "group_id" = 'openai-image', "updated_at" = now()
WHERE "canonical_id" IN ('gpt-image-2');

UPDATE "platform_ai_models" SET "group_id" = 'nano-banana', "updated_at" = now()
WHERE "canonical_id" IN (
  'gemini-3-1-flash-image',
  'gemini-3-1-flash-lite-image',
  'gemini-3-pro-image'
);

UPDATE "platform_ai_models" SET "group_id" = 'grok', "updated_at" = now()
WHERE "canonical_id" IN ('grok-imagine-image', 'grok-imagine-image-quality');

UPDATE "platform_ai_models" SET "group_id" = 'seedance', "updated_at" = now()
WHERE "canonical_id" IN (
  'doubao-seedance-2',
  'doubao-seedance-2-fast',
  'doubao-seedance-2-mini'
)
OR "group_id" = 'd7b05303-d91d-4dae-a4a7-a9dde8c60479';

UPDATE "platform_ai_models" SET "group_id" = 'veo', "updated_at" = now()
WHERE "canonical_id" IN (
  'veo-3-1-generate',
  'veo-3-1-fast-generate',
  'veo-3-1-lite-generate'
);

UPDATE "platform_ai_models" SET "group_id" = 'grok-video', "updated_at" = now()
WHERE "canonical_id" IN ('grok-imagine-video', 'grok-imagine-video-1-5');

UPDATE "platform_ai_models" SET "group_id" = 'minimax', "updated_at" = now()
WHERE "canonical_id" IN ('minimax-speech-2-8-hd', 'minimax-speech-2-8-turbo');

-- Drop UUID Seedance group after reassignment
DELETE FROM "platform_ai_model_groups"
WHERE "id" = 'd7b05303-d91d-4dae-a4a7-a9dde8c60479';
