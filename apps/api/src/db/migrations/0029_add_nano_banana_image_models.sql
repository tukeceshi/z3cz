INSERT INTO "platform_ai_model_groups" ("id", "name", "description", "icon", "sort_order")
VALUES ('nano-banana', 'Nano Banana', 'Google Nano Banana 生图系列', 'sparkles', 70)
ON CONFLICT ("id") DO NOTHING;

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
    'gemini-3-1-flash-image',
    'Nano Banana 2',
    'image',
    true,
    'gemini-3.1-flash-image',
    '{"schemaVersion":1,"maxReferenceImages":4}'::jsonb,
    71,
    'nano-banana'
  ),
  (
    'gemini-3-1-flash-lite-image',
    'Nano Banana 2 Lite',
    'image',
    true,
    'gemini-3.1-flash-lite-image',
    '{"schemaVersion":1,"maxReferenceImages":4}'::jsonb,
    72,
    'nano-banana'
  ),
  (
    'gemini-3-pro-image',
    'Nano Banana Pro',
    'image',
    true,
    'gemini-3-pro-image',
    '{"schemaVersion":1,"maxReferenceImages":4}'::jsonb,
    73,
    'nano-banana'
  )
ON CONFLICT ("canonical_id") DO NOTHING;
