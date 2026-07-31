-- Enable image/video references for Seed text multimodal understanding.
UPDATE "platform_ai_models"
SET "parameter_rules" = jsonb_set(
  jsonb_set(
    jsonb_set(
      COALESCE("parameter_rules", '{}'::jsonb),
      '{maxImageReferences}',
      '10'::jsonb,
      true
    ),
    '{maxVideoReferences}',
    '1'::jsonb,
    true
  ),
  '{referenceInputs}',
  '[{"type":"any","field":"keywords","maxCount":11}]'::jsonb,
  true
),
"updated_at" = now()
WHERE "canonical_id" = 'doubao-seed-evolving';
