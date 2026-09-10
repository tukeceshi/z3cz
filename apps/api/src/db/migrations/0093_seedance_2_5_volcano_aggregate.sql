INSERT INTO "platform_ai_model_channels" (
  "canonical_id",
  "channel",
  "preset_id",
  "upstream_model_id",
  "channel_enabled"
) VALUES (
  'doubao-seedance-2-5',
  'aggregate',
  'aggregate:volcano',
  'doubao-seedance-2-5-260628',
  true
)
ON CONFLICT ("canonical_id", "channel") DO NOTHING;
