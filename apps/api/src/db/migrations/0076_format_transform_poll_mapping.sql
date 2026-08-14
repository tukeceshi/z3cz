ALTER TABLE "format_transform_templates"
  ADD COLUMN IF NOT EXISTS "poll_mapping" jsonb NOT NULL DEFAULT '{
    "statusKey": "status",
    "successValues": ["succeeded", "success"],
    "failedValues": ["failed", "expired"],
    "outputKey": "content.video_url"
  }'::jsonb;
