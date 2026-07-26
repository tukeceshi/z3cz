-- Remove Kimi-K2 from platform models and model group.

DELETE FROM "organization_model_interface_priorities"
WHERE "canonical_id" = 'kimi-k2';

DELETE FROM "platform_ai_models"
WHERE "canonical_id" = 'kimi-k2';

DELETE FROM "platform_ai_model_groups"
WHERE "id" = 'kimi'
  AND NOT EXISTS (
    SELECT 1
    FROM "platform_ai_models"
    WHERE "group_id" = 'kimi'
  );
