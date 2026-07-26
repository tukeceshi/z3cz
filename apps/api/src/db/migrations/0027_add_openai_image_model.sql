INSERT INTO "platform_ai_models" (
  "canonical_id",
  "display_name",
  "modality",
  "platform_enabled",
  "provider_model_id",
  "parameter_rules",
  "sort_order",
  "group_id"
) VALUES
  (
    'gpt-image-2',
    'GPT Image 2',
    'image',
    true,
    'gpt-image-2',
    '{"schemaVersion":1,"maxReferenceImages":4}'::jsonb,
    54,
    'openai'
  )
ON CONFLICT ("canonical_id") DO NOTHING;
