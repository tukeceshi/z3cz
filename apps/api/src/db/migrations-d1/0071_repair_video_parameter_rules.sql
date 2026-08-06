-- Repair video models whose parameter_rules were saved as image-shaped (missing maxReferenceVideos).

UPDATE `platform_ai_models`
SET
  `parameter_rules` = json_set(
    json_set(
      json_set(
        json_set(
          json_set(
            json_set(
              COALESCE(`parameter_rules`, '{}'),
              '$.maxReferenceVideos',
              1
            ),
            '$.maxVideoReferenceBytes',
            52428800
          ),
          '$.maxVideoReferenceSeconds',
          60
        ),
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
WHERE
  `modality` = 'video'
  AND json_type(`parameter_rules`, '$.maxReferenceVideos') IS NULL;
