INSERT INTO "platform_ai_model_groups" ("id", "name", "description", "icon", "sort_order")
VALUES ('claude', 'Claude', 'Anthropic Claude 系列', 'sparkles', 90)
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
    'claude-sonnet-5',
    'Claude Sonnet 5',
    'text',
    true,
    'claude-sonnet-5',
    '{"schemaVersion":1,"promptMaxChars":32000}'::jsonb,
    91,
    'claude'
  ),
  (
    'claude-opus-5',
    'Claude Opus 5',
    'text',
    true,
    'claude-opus-5',
    '{"schemaVersion":1,"promptMaxChars":32000}'::jsonb,
    92,
    'claude'
  ),
  (
    'claude-haiku-4-5',
    'Claude Haiku 4.5',
    'text',
    true,
    'claude-haiku-4-5',
    '{"schemaVersion":1,"promptMaxChars":32000}'::jsonb,
    93,
    'claude'
  )
ON CONFLICT ("canonical_id") DO NOTHING;
