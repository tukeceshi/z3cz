-- Enable image/video references for Seed text multimodal understanding.
UPDATE `platform_ai_models`
SET `parameter_rules` = json_set(
  json_set(
    json_set(
      COALESCE(`parameter_rules`, '{}'),
      '$.maxImageReferences',
      10
    ),
    '$.maxVideoReferences',
    1
  ),
  '$.referenceInputs',
  json('[{"type":"any","field":"keywords","maxCount":11}]')
),
`updated_at` = datetime('now')
WHERE `canonical_id` = 'doubao-seed-evolving';
