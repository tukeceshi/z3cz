INSERT INTO "platform_ai_model_groups" ("id", "name", "description", "icon", "sort_order")
VALUES
  ('glm', 'GLM', '智谱 GLM 系列', 'sparkles', 30),
  ('kimi', 'Kimi', 'Moonshot Kimi 系列', 'sparkles', 40)
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
    'glm-5-2',
    'GLM-5.2',
    'text',
    true,
    'glm-5.2',
    '{"schemaVersion":1,"referenceInputs":[{"type":"string","field":"keywords","maxCount":1}],"keywordsMaxChars":32000,"promptMaxChars":32000,"outputMaxTokens":4096,"outputMaxTokensLimit":8192,"outputMaxChars":32000,"contextWindowTokens":1048576}'::jsonb,
    40,
    'glm'
  ),
  (
    'kimi-k2',
    'Kimi-K2',
    'text',
    true,
    'kimi-k2',
    '{"schemaVersion":1,"referenceInputs":[{"type":"string","field":"keywords","maxCount":1}],"keywordsMaxChars":32000,"promptMaxChars":32000,"outputMaxTokens":4096,"outputMaxTokensLimit":8192,"outputMaxChars":32000,"contextWindowTokens":1048576}'::jsonb,
    50,
    'kimi'
  )
ON CONFLICT ("canonical_id") DO NOTHING;
