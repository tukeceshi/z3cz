ALTER TABLE "format_transform_templates"
  ADD COLUMN IF NOT EXISTS "supports_task_cancel" boolean NOT NULL DEFAULT false;
