-- Fix Volcano online inference ModelIds for GLM-5.2 and Kimi-K2.
-- Resolved via ListFoundationModels / ListFoundationModelVersions against live Ark API.

UPDATE "platform_ai_models"
SET
  "provider_model_id" = 'glm-5-2-260617',
  "updated_at" = NOW()
WHERE "canonical_id" = 'glm-5-2';

UPDATE "platform_ai_models"
SET
  "provider_model_id" = 'kimi-k2-thinking-251104',
  "updated_at" = NOW()
WHERE "canonical_id" = 'kimi-k2';
