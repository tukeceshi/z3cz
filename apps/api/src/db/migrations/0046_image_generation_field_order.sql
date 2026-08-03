-- Reorder image model generationFields to match IMAGE_GENERATION_FIELD_CATALOG.

UPDATE "platform_ai_models"
SET
  "parameter_rules" = jsonb_set(
    "parameter_rules",
    '{generationFields}',
    (
      SELECT COALESCE(jsonb_agg(field ORDER BY sort_key, orig_idx), '[]'::jsonb)
      FROM (
        SELECT
          field,
          CASE field->>'name'
            WHEN 'size' THEN 0
            WHEN 'ratio' THEN 1
            WHEN 'generate_count' THEN 2
            WHEN 'optimize_prompt_mode' THEN 3
            WHEN 'background' THEN 4
            WHEN 'quality' THEN 5
            WHEN 'watermark' THEN 6
            WHEN 'output_format' THEN 7
            WHEN 'web_search' THEN 8
            WHEN 'output_compression' THEN 9
            WHEN 'moderation' THEN 10
            ELSE 999
          END AS sort_key,
          ordinality AS orig_idx
        FROM jsonb_array_elements("parameter_rules"->'generationFields')
          WITH ORDINALITY AS t(field, ordinality)
      ) ordered_fields
    )
  ),
  "updated_at" = now()
WHERE
  "modality" = 'image'
  AND jsonb_typeof("parameter_rules"->'generationFields') = 'array'
  AND jsonb_array_length("parameter_rules"->'generationFields') > 0;
