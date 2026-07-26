INSERT INTO "platform_ai_model_groups" ("id", "name", "description", "icon", "sort_order")
VALUES ('grok', 'Grok', 'xAI Grok 系列', 'sparkles', 80)
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
    'grok-4-5',
    'Grok 4.5',
    'text',
    true,
    'grok-4.5',
    '{"schemaVersion":1,"promptMaxChars":32000}'::jsonb,
    81,
    'grok'
  ),
  (
    'grok-4-3',
    'Grok 4.3',
    'text',
    true,
    'grok-4.3',
    '{"schemaVersion":1,"promptMaxChars":32000}'::jsonb,
    82,
    'grok'
  ),
  (
    'grok-imagine-image',
    'Grok Imagine',
    'image',
    true,
    'grok-imagine-image',
    '{"schemaVersion":1,"maxReferenceImages":4}'::jsonb,
    83,
    'grok'
  ),
  (
    'grok-imagine-image-quality',
    'Grok Imagine Quality',
    'image',
    true,
    'grok-imagine-image-quality',
    '{"schemaVersion":1,"maxReferenceImages":4}'::jsonb,
    84,
    'grok'
  ),
  (
    'grok-imagine-video',
    'Grok Imagine Video',
    'video',
    true,
    'grok-imagine-video',
    '{"schemaVersion":1,"promptMaxChars":1024}'::jsonb,
    85,
    'grok'
  ),
  (
    'grok-imagine-video-1-5',
    'Grok Imagine Video 1.5',
    'video',
    true,
    'grok-imagine-video-1.5',
    '{"schemaVersion":1,"promptMaxChars":1024}'::jsonb,
    86,
    'grok'
  )
ON CONFLICT ("canonical_id") DO NOTHING;
