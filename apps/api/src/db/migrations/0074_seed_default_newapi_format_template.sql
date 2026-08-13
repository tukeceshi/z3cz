INSERT INTO "format_transform_templates" (
  "id",
  "name",
  "provider",
  "scope",
  "upstream_params",
  "param_mappings",
  "locked_resolution",
  "supports_task_cancel",
  "enabled"
)
VALUES (
  '0eb0c921-1cdc-496c-8ef0-331a4bae2f7e',
  'newapi',
  'seedance',
  'platform',
  $upstream_params$[
    {"id": "0b8a6298-206c-4f33-adb1-735fa6fef9d4", "name": "model", "valueType": "string"},
    {"id": "d46e32a2-adea-44d7-8f46-5827d82b3250", "name": "prompt", "valueType": "string"},
    {"id": "965b785d-a56c-4509-9b2d-703c7d9ccbba", "name": "image", "valueType": "string[]"},
    {"id": "12d19a72-fdea-42b7-a89e-91474883a135", "name": "seconds", "valueType": "string"},
    {"id": "0f0d12e8-1dc2-476a-9628-13c8e3442521", "name": "size", "valueType": "string"}
  ]$upstream_params$::jsonb,
  $param_mappings$[
    {"transform": "ratio_resolution_to_size", "upstreamParamId": "0f0d12e8-1dc2-476a-9628-13c8e3442521"},
    {"sourcePath": "$.duration", "upstreamParamId": "12d19a72-fdea-42b7-a89e-91474883a135"},
    {"sourcePath": "$.content[?(@.role=='reference_image')].image_url.url", "collectMode": "all", "upstreamParamId": "965b785d-a56c-4509-9b2d-703c7d9ccbba"},
    {"sourcePath": "$.content[?(@.type=='text')].text", "upstreamParamId": "d46e32a2-adea-44d7-8f46-5827d82b3250"},
    {"sourcePath": "$.model", "upstreamParamId": "0b8a6298-206c-4f33-adb1-735fa6fef9d4"}
  ]$param_mappings$::jsonb,
  NULL,
  false,
  true
)
ON CONFLICT ("id") DO NOTHING;
