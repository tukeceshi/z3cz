-- Restore Kimi platform model group and Moonshot official API model rows.

INSERT INTO "platform_ai_model_groups" ("id", "name", "description", "icon", "sort_order")
VALUES ('kimi', 'Kimi', 'Moonshot Kimi 系列', 'sparkles', 40)
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
    'kimi-k3',
    'Kimi K3',
    'text',
    true,
    'kimi-k3',
    '{"schemaVersion":1,"referenceInputs":[{"type":"string","field":"keywords","maxCount":1}],"keywordsMaxChars":32000,"promptMaxChars":32000,"outputMaxTokens":4096,"outputMaxTokensLimit":8192,"outputMaxChars":32000,"contextWindowTokens":1048576}'::jsonb,
    41,
    'kimi'
  ),
  (
    'kimi-k2.6',
    'Kimi K2.6',
    'text',
    true,
    'kimi-k2.6',
    '{"schemaVersion":1,"referenceInputs":[{"type":"string","field":"keywords","maxCount":1}],"keywordsMaxChars":32000,"promptMaxChars":32000,"outputMaxTokens":4096,"outputMaxTokensLimit":8192,"outputMaxChars":32000,"contextWindowTokens":1048576}'::jsonb,
    42,
    'kimi'
  ),
  (
    'kimi-k2.5',
    'Kimi K2.5',
    'text',
    true,
    'kimi-k2.5',
    '{"schemaVersion":1,"referenceInputs":[{"type":"string","field":"keywords","maxCount":1}],"keywordsMaxChars":32000,"promptMaxChars":32000,"outputMaxTokens":4096,"outputMaxTokensLimit":8192,"outputMaxChars":32000,"contextWindowTokens":1048576}'::jsonb,
    43,
    'kimi'
  )
ON CONFLICT ("canonical_id") DO NOTHING;

