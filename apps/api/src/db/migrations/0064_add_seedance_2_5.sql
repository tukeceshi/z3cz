INSERT INTO "platform_ai_models" (
  "canonical_id",
  "display_name",
  "modality",
  "platform_enabled",
  "parameter_rules",
  "sort_order",
  "brand_icon"
) VALUES (
  'doubao-seedance-2-5',
  'Seedance 2.5',
  'video',
  true,
  '{
    "schemaVersion": 1,
    "maxReferenceImages": 30,
    "maxImageReferenceBytes": 31457280,
    "maxReferenceVideos": 10,
    "maxVideoReferenceBytes": 52428800,
    "maxVideoReferenceSeconds": 30,
    "maxReferenceAudios": 10,
    "maxAudioReferenceBytes": 15728640,
    "maxAudioReferenceSeconds": 30,
    "promptMaxChars": 1000,
    "generationFields": [
      {"name":"ratio","apiName":"ratio","type":"string","description":"Output aspect ratio","default":"16:9","enumValues":["adaptive","16:9","9:16","4:3","1:1","3:4","21:9"]},
      {"name":"duration","apiName":"duration","type":"number","description":"Video duration in seconds","default":5,"enumValues":["4","5","6","7","8","9","10","11","12","13","14","15","16","17","18","19","20","21","22","23","24","25","26","27","28","29","30"]},
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
  75,
  'doubao'
)
ON CONFLICT ("canonical_id") DO NOTHING;
