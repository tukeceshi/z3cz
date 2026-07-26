INSERT INTO "platform_ai_model_groups" ("id", "name", "description", "icon", "sort_order")
VALUES ('veo', 'Veo', 'Google Veo 视频生成系列', 'video', 75)
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
    'veo-3-1-generate',
    'Veo 3.1',
    'video',
    true,
    'veo-3.1-generate-preview',
    '{"schemaVersion":1,"promptMaxChars":1024}'::jsonb,
    76,
    'veo'
  ),
  (
    'veo-3-1-fast-generate',
    'Veo 3.1 Fast',
    'video',
    true,
    'veo-3.1-fast-generate-preview',
    '{"schemaVersion":1,"promptMaxChars":1024}'::jsonb,
    77,
    'veo'
  ),
  (
    'veo-3-1-lite-generate',
    'Veo 3.1 Lite',
    'video',
    true,
    'veo-3.1-lite-generate-preview',
    '{"schemaVersion":1,"promptMaxChars":1024}'::jsonb,
    78,
    'veo'
  )
ON CONFLICT ("canonical_id") DO NOTHING;
