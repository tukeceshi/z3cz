INSERT INTO "platform_ai_model_groups" ("id", "name", "description", "icon", "sort_order")
VALUES ('openai', 'OpenAI', 'OpenAI GPT 系列', 'sparkles', 50)
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
    'gpt-5-6-sol',
    'GPT-5.6 Sol',
    'text',
    true,
    'gpt-5.6-sol',
    '{"schemaVersion":1,"referenceInputs":[{"type":"string","field":"keywords","maxCount":1}],"keywordsMaxChars":32000,"promptMaxChars":32000,"outputMaxTokens":4096,"outputMaxTokensLimit":8192,"outputMaxChars":32000,"contextWindowTokens":1048576}'::jsonb,
    51,
    'openai'
  ),
  (
    'gpt-5-6-terra',
    'GPT-5.6 Terra',
    'text',
    true,
    'gpt-5.6-terra',
    '{"schemaVersion":1,"referenceInputs":[{"type":"string","field":"keywords","maxCount":1}],"keywordsMaxChars":32000,"promptMaxChars":32000,"outputMaxTokens":4096,"outputMaxTokensLimit":8192,"outputMaxChars":32000,"contextWindowTokens":1048576}'::jsonb,
    52,
    'openai'
  ),
  (
    'gpt-5-6-luna',
    'GPT-5.6 Luna',
    'text',
    true,
    'gpt-5.6-luna',
    '{"schemaVersion":1,"referenceInputs":[{"type":"string","field":"keywords","maxCount":1}],"keywordsMaxChars":32000,"promptMaxChars":32000,"outputMaxTokens":4096,"outputMaxTokensLimit":8192,"outputMaxChars":32000,"contextWindowTokens":1048576}'::jsonb,
    53,
    'openai'
  )
ON CONFLICT ("canonical_id") DO NOTHING;
