-- Repair video models whose parameter_rules were saved as image-shaped (missing maxReferenceVideos).

UPDATE "platform_ai_models"
SET
  "parameter_rules" = "parameter_rules"
    || '{"maxReferenceVideos":1,"maxVideoReferenceBytes":52428800,"maxVideoReferenceSeconds":60,"maxReferenceAudios":3,"maxAudioReferenceBytes":15728640,"maxAudioReferenceSeconds":15}'::jsonb,
  "updated_at" = now()
WHERE
  "modality" = 'video'
  AND NOT ("parameter_rules" ? 'maxReferenceVideos');
