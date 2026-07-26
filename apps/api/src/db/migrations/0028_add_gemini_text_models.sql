INSERT INTO "platform_ai_model_groups" ("id", "name", "description", "icon", "sort_order")
VALUES ('gemini', 'Gemini', 'Google Gemini 系列', 'sparkles', 60)
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
    'gemini-3-5-flash',
    'Gemini 3.5 Flash',
    'text',
    true,
    'gemini-3.5-flash',
    '{"schemaVersion":1,"referenceInputs":[{"type":"string","field":"keywords","maxCount":1}],"keywordsMaxChars":32000,"promptMaxChars":32000,"outputMaxTokens":4096,"outputMaxTokensLimit":8192,"outputMaxChars":32000,"contextWindowTokens":1048576}'::jsonb,
    61,
    'gemini'
  ),
  (
    'gemini-3-6-flash',
    'Gemini 3.6 Flash',
    'text',
    true,
    'gemini-3.6-flash',
    '{"schemaVersion":1,"referenceInputs":[{"type":"string","field":"keywords","maxCount":1}],"keywordsMaxChars":32000,"promptMaxChars":32000,"outputMaxTokens":4096,"outputMaxTokensLimit":8192,"outputMaxChars":32000,"contextWindowTokens":1048576}'::jsonb,
    62,
    'gemini'
  ),
  (
    'gemini-3-5-flash-lite',
    'Gemini 3.5 Flash-Lite',
    'text',
    true,
    'gemini-3.5-flash-lite',
    '{"schemaVersion":1,"referenceInputs":[{"type":"string","field":"keywords","maxCount":1}],"keywordsMaxChars":32000,"promptMaxChars":32000,"outputMaxTokens":4096,"outputMaxTokensLimit":8192,"outputMaxChars":32000,"contextWindowTokens":1048576}'::jsonb,
    63,
    'gemini'
  )
ON CONFLICT ("canonical_id") DO NOTHING;
