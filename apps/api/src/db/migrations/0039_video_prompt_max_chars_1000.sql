-- Raise default video prompt limit to 1000 characters.
UPDATE "platform_ai_models"
SET "parameter_rules" = jsonb_set(
  COALESCE("parameter_rules", '{}'::jsonb),
  '{promptMaxChars}',
  '1000'::jsonb,
  true
),
"updated_at" = now()
WHERE "modality" = 'video';
