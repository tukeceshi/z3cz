-- Video models: default audio reference limits (Seedance-aligned).

UPDATE `platform_ai_models`
SET
  `parameter_rules` = json_set(
    json_set(
      json_set(
        COALESCE(`parameter_rules`, '{}'),
        '$.maxReferenceAudios',
        3
      ),
      '$.maxAudioReferenceBytes',
      15728640
    ),
    '$.maxAudioReferenceSeconds',
    15
  ),
  `updated_at` = unixepoch() * 1000
WHERE `modality` = 'video';
