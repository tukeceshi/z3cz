UPDATE "platform_settings"
SET "feature_config" = jsonb_set(
  "feature_config"::jsonb,
  '{nav}',
  ("feature_config"::jsonb->'nav') - 'templates' - 'playground'
)::text
WHERE "feature_config" IS NOT NULL
  AND (
    ("feature_config"::jsonb->'nav') ? 'templates'
    OR ("feature_config"::jsonb->'nav') ? 'playground'
  );
