-- Raise default video prompt limit to 1000 characters.
UPDATE `platform_ai_models`
SET `parameter_rules` = json_set(
  COALESCE(`parameter_rules`, '{}'),
  '$.promptMaxChars',
  1000
),
`updated_at` = unixepoch() * 1000
WHERE `modality` = 'video';
