ALTER TABLE "platform_settings"
  ADD COLUMN IF NOT EXISTS "feature_config" text;

UPDATE "platform_settings"
SET "feature_config" = '{"nav":{"ai-interfaces":{"enabled":true},"schemas":{"enabled":false},"databases":{"enabled":false},"datasets":{"enabled":false},"integrations":{"enabled":false},"secrets":{"enabled":false},"emails":{"enabled":false},"queues":{"enabled":false},"bots":{"enabled":false}},"defaultWorkflowSchemeId":"basic-canvas"}'
WHERE "feature_config" IS NULL;

INSERT INTO "workflow_schemes" (
  "id",
  "name",
  "description",
  "icon",
  "allowed_triggers",
  "allowed_runtimes",
  "include_tags",
  "include_node_types",
  "exclude_node_types",
  "always_include_node_types",
  "is_default",
  "is_system",
  "sort_order",
  "enabled"
) VALUES (
  'basic-canvas',
  '基础画布',
  '面向无限画布：仅手动触发与 AI 文本/图片/视频节点',
  'layout',
  '["manual"]',
  '["worker","workflow"]',
  NULL,
  '["ai-text","ai-image","ai-video"]',
  NULL,
  '["ai-interface"]',
  false,
  true,
  -10,
  true
) ON CONFLICT ("id") DO NOTHING;

UPDATE "workflow_schemes"
SET "is_default" = false
WHERE "id" = 'omnipotent';

UPDATE "workflow_schemes"
SET "is_default" = true
WHERE "id" = 'basic-canvas';

ALTER TABLE "workflows"
  ALTER COLUMN "scheme_id" SET DEFAULT 'basic-canvas';
