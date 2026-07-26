UPDATE "workflow_schemes"
SET
  "description" = '面向无限画布：仅手动触发与 AI 文本/图片/视频/音频节点',
  "include_node_types" = '["ai-text","ai-image","ai-video","ai-audio"]'
WHERE "id" = 'basic-canvas';
