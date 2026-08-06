-- Seedance series: full default parameter_rules (references + all generation fields).

UPDATE "platform_ai_models"
SET
  "parameter_rules" = '{
    "schemaVersion": 1,
    "maxReferenceImages": 2,
    "maxImageReferenceBytes": 10485760,
    "maxReferenceVideos": 1,
    "maxVideoReferenceBytes": 52428800,
    "maxVideoReferenceSeconds": 60,
    "maxReferenceAudios": 3,
    "maxAudioReferenceBytes": 15728640,
    "maxAudioReferenceSeconds": 15,
    "promptMaxChars": 1000,
    "generationFields": [
      {"name":"ratio","apiName":"ratio","type":"string","description":"Output aspect ratio","default":"16:9","enumValues":["adaptive","16:9","9:16","4:3","1:1","3:4","21:9"]},
      {"name":"duration","apiName":"duration","type":"number","description":"Video duration in seconds","default":5,"enumValues":["4","5","6","7","8","9","10","11","12","13","14","15"]},
      {"name":"resolution","apiName":"resolution","type":"string","description":"Output resolution","default":"720p","enumValues":["480p","720p","1080p","4k"]},
      {"name":"generate_audio","apiName":"generate_audio","type":"boolean","description":"Generate synchronized audio","default":true},
      {"name":"watermark","apiName":"watermark","type":"boolean","description":"Add AI-generated watermark","default":false},
      {"name":"reference_mode","apiName":"","type":"string","description":"Reference assignment mode","default":"reference_image","enumValues":["reference_image","first_last_frame"],"clientOnly":true},
      {"name":"web_search","apiName":"web_search","type":"boolean","description":"Web search","default":false},
      {"name":"virtual_avatar_library","apiName":"","type":"boolean","description":"Virtual avatar library","default":false,"clientOnly":true},
      {"name":"return_last_frame","apiName":"return_last_frame","type":"boolean","description":"Return last frame URL on completion","default":false},
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
    "maxReferenceAudios": 3,
    "maxAudioReferenceBytes": 15728640,
    "maxAudioReferenceSeconds": 15,
    "promptMaxChars": 1000,
    "generationFields": [
      {"name":"ratio","apiName":"ratio","type":"string","description":"Output aspect ratio","default":"16:9","enumValues":["adaptive","16:9","9:16","4:3","1:1","3:4","21:9"]},
      {"name":"duration","apiName":"duration","type":"number","description":"Video duration in seconds","default":5,"enumValues":["4","5","6","7","8","9","10","11","12","13","14","15"]},
      {"name":"resolution","apiName":"resolution","type":"string","description":"Output resolution","default":"720p","enumValues":["480p","720p"]},
      {"name":"generate_audio","apiName":"generate_audio","type":"boolean","description":"Generate synchronized audio","default":true},
      {"name":"watermark","apiName":"watermark","type":"boolean","description":"Add AI-generated watermark","default":false},
      {"name":"reference_mode","apiName":"","type":"string","description":"Reference assignment mode","default":"reference_image","enumValues":["reference_image","first_last_frame"],"clientOnly":true},
      {"name":"web_search","apiName":"web_search","type":"boolean","description":"Web search","default":false},
      {"name":"virtual_avatar_library","apiName":"","type":"boolean","description":"Virtual avatar library","default":false,"clientOnly":true},
      {"name":"return_last_frame","apiName":"return_last_frame","type":"boolean","description":"Return last frame URL on completion","default":false},
      {"name":"seed","apiName":"seed","type":"number","description":"Random seed (-1 for random)","default":-1,"hidden":true}
    ]
  }'::jsonb,
  "updated_at" = now()
WHERE "canonical_id" IN ('doubao-seedance-2-fast', 'doubao-seedance-2-mini');
