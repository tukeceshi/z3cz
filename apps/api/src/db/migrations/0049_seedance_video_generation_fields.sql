-- Seedance video models: full generationFields per upstream capability.

UPDATE "platform_ai_models"
SET
  "parameter_rules" = '{
    "schemaVersion": 1,
    "maxReferenceImages": 2,
    "maxImageReferenceBytes": 10485760,
    "maxReferenceVideos": 1,
    "maxVideoReferenceBytes": 52428800,
    "maxVideoReferenceSeconds": 60,
    "promptMaxChars": 1000,
    "generationFields": [
      {"name":"ratio","apiName":"ratio","type":"string","description":"Output aspect ratio","default":"16:9","enumValues":["adaptive","16:9","9:16","4:3","1:1","3:4","21:9"]},
      {"name":"duration","apiName":"duration","type":"number","description":"Video duration in seconds","default":5,"enumValues":["4","5","6","7","8","9","10","11","12","13","14","15"]},
      {"name":"resolution","apiName":"resolution","type":"string","description":"Output resolution","default":"720p","enumValues":["480p","720p","1080p","4k"]},
      {"name":"generate_audio","apiName":"generate_audio","type":"boolean","description":"Generate synchronized audio","default":true},
      {"name":"watermark","apiName":"watermark","type":"boolean","description":"Add AI-generated watermark","default":false},
      {"name":"seed","apiName":"seed","type":"number","description":"Random seed (-1 for random)","default":-1,"hidden":true}
    ]
  }'::jsonb,
  "updated_at" = now()
WHERE "canonical_id" = 'doubao-seedance-2';

UPDATE "platform_ai_models"
SET
  "parameter_rules" = '{
    "schemaVersion": 1,
    "maxReferenceImages": 2,
    "maxImageReferenceBytes": 10485760,
    "maxReferenceVideos": 1,
    "maxVideoReferenceBytes": 52428800,
    "maxVideoReferenceSeconds": 60,
    "promptMaxChars": 1000,
    "generationFields": [
      {"name":"ratio","apiName":"ratio","type":"string","description":"Output aspect ratio","default":"16:9","enumValues":["adaptive","16:9","9:16","4:3","1:1","3:4","21:9"]},
      {"name":"duration","apiName":"duration","type":"number","description":"Video duration in seconds","default":5,"enumValues":["4","5","6","7","8","9","10","11","12","13","14","15"]},
      {"name":"resolution","apiName":"resolution","type":"string","description":"Output resolution","default":"720p","enumValues":["480p","720p"]},
      {"name":"generate_audio","apiName":"generate_audio","type":"boolean","description":"Generate synchronized audio","default":true},
      {"name":"watermark","apiName":"watermark","type":"boolean","description":"Add AI-generated watermark","default":false},
      {"name":"seed","apiName":"seed","type":"number","description":"Random seed (-1 for random)","default":-1,"hidden":true}
    ]
  }'::jsonb,
  "updated_at" = now()
WHERE "canonical_id" IN ('doubao-seedance-2-fast', 'doubao-seedance-2-mini');
