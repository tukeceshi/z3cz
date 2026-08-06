-- Video models: default audio reference limits (Seedance-aligned).

UPDATE "platform_ai_models"
SET
  "parameter_rules" = "parameter_rules"
    || '{"maxReferenceAudios":3,"maxAudioReferenceBytes":15728640,"maxAudioReferenceSeconds":15}'::jsonb,
  "updated_at" = now()
WHERE "modality" = 'video';
