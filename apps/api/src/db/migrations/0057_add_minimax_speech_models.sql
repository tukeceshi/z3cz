INSERT INTO "platform_ai_model_groups" ("id", "name", "description", "icon", "sort_order")
VALUES ('minimax', 'MiniMax', 'MiniMax 语音合成系列', 'audio', 95)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "platform_ai_models" (
  "canonical_id",
  "display_name",
  "modality",
  "platform_enabled",
  "parameter_rules",
  "sort_order",
  "group_id"
) VALUES
  (
    'minimax-speech-2-8-hd',
    'MiniMax Speech 2.8 HD',
    'audio',
    true,
    '{"schemaVersion":1,"promptMaxChars":5000,"generationFields":[{"name":"speed","apiName":"voice_setting.speed","type":"number","description":"Speech speed multiplier","default":1},{"name":"vol","apiName":"voice_setting.vol","type":"number","description":"Speech volume","default":1},{"name":"pitch","apiName":"voice_setting.pitch","type":"number","description":"Speech pitch adjustment","default":0},{"name":"emotion","apiName":"voice_setting.emotion","type":"string","description":"Speech emotion style","default":"neutral","enumValues":["happy","sad","angry","fearful","disgusted","surprised","neutral"]},{"name":"voice_id","apiName":"voice_setting.voice_id","type":"string","description":"Default voice identifier","default":"male-qn-qingse","hidden":true}]}'::jsonb,
    96,
    'minimax'
  ),
  (
    'minimax-speech-2-8-turbo',
    'MiniMax Speech 2.8 Turbo',
    'audio',
    true,
    '{"schemaVersion":1,"promptMaxChars":5000,"generationFields":[{"name":"speed","apiName":"voice_setting.speed","type":"number","description":"Speech speed multiplier","default":1},{"name":"vol","apiName":"voice_setting.vol","type":"number","description":"Speech volume","default":1},{"name":"pitch","apiName":"voice_setting.pitch","type":"number","description":"Speech pitch adjustment","default":0},{"name":"emotion","apiName":"voice_setting.emotion","type":"string","description":"Speech emotion style","default":"neutral","enumValues":["happy","sad","angry","fearful","disgusted","surprised","neutral"]},{"name":"voice_id","apiName":"voice_setting.voice_id","type":"string","description":"Default voice identifier","default":"male-qn-qingse","hidden":true}]}'::jsonb,
    97,
    'minimax'
  )
ON CONFLICT ("canonical_id") DO NOTHING;
