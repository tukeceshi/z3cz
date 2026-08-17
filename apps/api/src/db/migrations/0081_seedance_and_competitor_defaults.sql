-- Snapshot current admin Seedance rules and competitor rates into defaults.

UPDATE "platform_ai_models"
SET
  "parameter_rules" = $json${
    "schemaVersion": 1,
    "sizePolicy": {"enabled": false, "effectMode": "legacy"},
    "maxReferenceImages": 9,
    "maxImageReferenceBytes": 31457280,
    "maxReferenceVideos": 3,
    "maxVideoReferenceBytes": 52428800,
    "maxVideoReferenceSeconds": 60,
    "maxReferenceAudios": 3,
    "maxAudioReferenceBytes": 15728640,
    "maxAudioReferenceSeconds": 15,
    "promptMaxChars": 1000,
    "supportsTaskCancel": true,
    "priceEstimate": {
      "enabled": true,
      "tiers": [
        {"resolution": "480p", "enabled": true, "priceWithoutVideo": 46, "priceWithVideo": 28},
        {"resolution": "720p", "enabled": true, "priceWithoutVideo": 46, "priceWithVideo": 28},
        {"resolution": "1080p", "enabled": true, "priceWithoutVideo": 51, "priceWithVideo": 31},
        {"resolution": "4k", "enabled": true, "priceWithoutVideo": 26, "priceWithVideo": 16}
      ],
      "promos": []
    },
    "generationFields": [
      {"name": "ratio", "apiName": "ratio", "type": "string", "description": "Output aspect ratio", "default": "adaptive", "enumValues": ["adaptive", "16:9", "9:16", "4:3", "1:1", "3:4", "21:9"]},
      {"name": "duration", "apiName": "duration", "type": "number", "description": "Video duration in seconds", "default": 5, "enumValues": ["4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15"]},
      {"name": "resolution", "apiName": "resolution", "type": "string", "description": "Output resolution", "default": "720p", "enumValues": ["480p", "720p", "1080p", "4k"]},
      {"name": "generate_audio", "apiName": "generate_audio", "type": "boolean", "description": "Generate synchronized audio", "default": true},
      {"name": "watermark", "apiName": "watermark", "type": "boolean", "description": "Add AI-generated watermark", "default": false},
      {"name": "reference_mode", "apiName": "", "type": "string", "description": "Reference assignment mode", "default": "reference_image", "enumValues": ["reference_image", "first_last_frame"], "clientOnly": true},
      {"name": "web_search", "apiName": "web_search", "type": "boolean", "description": "Web search", "default": false},
      {"name": "seed", "apiName": "seed", "type": "number", "description": "Random seed (-1 for random)", "default": -1, "hidden": true}
    ]
  }$json$::jsonb,
  "updated_at" = now()
WHERE "canonical_id" = 'doubao-seedance-2';

UPDATE "platform_ai_models"
SET
  "parameter_rules" = $json${
    "schemaVersion": 1,
    "sizePolicy": {"enabled": false, "effectMode": "legacy"},
    "maxReferenceImages": 9,
    "maxImageReferenceBytes": 31457280,
    "maxReferenceVideos": 3,
    "maxVideoReferenceBytes": 52428800,
    "maxVideoReferenceSeconds": 60,
    "maxReferenceAudios": 3,
    "maxAudioReferenceBytes": 15728640,
    "maxAudioReferenceSeconds": 15,
    "promptMaxChars": 1000,
    "supportsTaskCancel": true,
    "priceEstimate": {
      "enabled": true,
      "tiers": [
        {"resolution": "480p", "enabled": true, "priceWithoutVideo": 37, "priceWithVideo": 22},
        {"resolution": "720p", "enabled": true, "priceWithoutVideo": 37, "priceWithVideo": 22},
        {"resolution": "1080p", "enabled": false, "priceWithoutVideo": 0, "priceWithVideo": 0},
        {"resolution": "4k", "enabled": false, "priceWithoutVideo": 0, "priceWithVideo": 0}
      ],
      "promos": [
        {"id": "30c706ea-ea51-41e5-9c65-624ae33bf19a", "resolution": "any", "startsAt": "2026-08-07", "endsAt": "2026-09-07", "discountFold": 7.5}
      ]
    },
    "generationFields": [
      {"name": "ratio", "apiName": "ratio", "type": "string", "description": "Output aspect ratio", "default": "adaptive", "enumValues": ["adaptive", "16:9", "9:16", "4:3", "1:1", "3:4", "21:9"]},
      {"name": "duration", "apiName": "duration", "type": "number", "description": "Video duration in seconds", "default": 5, "enumValues": ["4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15"]},
      {"name": "resolution", "apiName": "resolution", "type": "string", "description": "Output resolution", "default": "480p", "enumValues": ["480p", "720p"]},
      {"name": "generate_audio", "apiName": "generate_audio", "type": "boolean", "description": "Generate synchronized audio", "default": true},
      {"name": "watermark", "apiName": "watermark", "type": "boolean", "description": "Add AI-generated watermark", "default": false},
      {"name": "reference_mode", "apiName": "", "type": "string", "description": "Reference assignment mode", "default": "reference_image", "enumValues": ["reference_image", "first_last_frame"], "clientOnly": true},
      {"name": "web_search", "apiName": "web_search", "type": "boolean", "description": "Web search", "default": false},
      {"name": "seed", "apiName": "seed", "type": "number", "description": "Random seed (-1 for random)", "default": -1, "hidden": true}
    ]
  }$json$::jsonb,
  "updated_at" = now()
WHERE "canonical_id" = 'doubao-seedance-2-fast';

UPDATE "platform_ai_models"
SET
  "parameter_rules" = $json${
    "schemaVersion": 1,
    "sizePolicy": {"enabled": false, "effectMode": "legacy"},
    "maxReferenceImages": 9,
    "maxImageReferenceBytes": 31457280,
    "maxReferenceVideos": 3,
    "maxVideoReferenceBytes": 52428800,
    "maxVideoReferenceSeconds": 60,
    "maxReferenceAudios": 3,
    "maxAudioReferenceBytes": 15728640,
    "maxAudioReferenceSeconds": 15,
    "promptMaxChars": 1000,
    "supportsTaskCancel": true,
    "priceEstimate": {
      "enabled": true,
      "tiers": [
        {"resolution": "480p", "enabled": true, "priceWithoutVideo": 23, "priceWithVideo": 14},
        {"resolution": "720p", "enabled": true, "priceWithoutVideo": 23, "priceWithVideo": 14},
        {"resolution": "1080p", "enabled": false, "priceWithoutVideo": 0, "priceWithVideo": 0},
        {"resolution": "4k", "enabled": false, "priceWithoutVideo": 0, "priceWithVideo": 0}
      ],
      "promos": [
        {"id": "85f670d1-57ec-446a-ba69-1e4532c3de50", "resolution": "any", "startsAt": "2026-08-07", "endsAt": "2026-09-07", "discountFold": 4}
      ]
    },
    "generationFields": [
      {"name": "ratio", "apiName": "ratio", "type": "string", "description": "Output aspect ratio", "default": "adaptive", "enumValues": ["adaptive", "16:9", "9:16", "4:3", "1:1", "3:4", "21:9"]},
      {"name": "duration", "apiName": "duration", "type": "number", "description": "Video duration in seconds", "default": 5, "enumValues": ["4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15"]},
      {"name": "resolution", "apiName": "resolution", "type": "string", "description": "Output resolution", "default": "480p", "enumValues": ["480p", "720p"]},
      {"name": "generate_audio", "apiName": "generate_audio", "type": "boolean", "description": "Generate synchronized audio", "default": true},
      {"name": "watermark", "apiName": "watermark", "type": "boolean", "description": "Add AI-generated watermark", "default": false},
      {"name": "reference_mode", "apiName": "", "type": "string", "description": "Reference assignment mode", "default": "reference_image", "enumValues": ["reference_image", "first_last_frame"], "clientOnly": true},
      {"name": "web_search", "apiName": "web_search", "type": "boolean", "description": "Web search", "default": false},
      {"name": "seed", "apiName": "seed", "type": "number", "description": "Random seed (-1 for random)", "default": -1, "hidden": true}
    ]
  }$json$::jsonb,
  "updated_at" = now()
WHERE "canonical_id" = 'doubao-seedance-2-mini';

UPDATE "platform_ai_models"
SET
  "parameter_rules" = $json${
    "schemaVersion": 1,
    "sizePolicy": {"enabled": false, "effectMode": "legacy"},
    "maxReferenceImages": 30,
    "maxImageReferenceBytes": 31457280,
    "maxReferenceVideos": 10,
    "maxVideoReferenceBytes": 52428800,
    "maxVideoReferenceSeconds": 30,
    "maxReferenceAudios": 10,
    "maxAudioReferenceBytes": 15728640,
    "maxAudioReferenceSeconds": 30,
    "promptMaxChars": 1000,
    "supportsTaskCancel": true,
    "priceEstimate": {
      "enabled": true,
      "tiers": [
        {"resolution": "480p", "enabled": true, "priceWithoutVideo": 70, "priceWithVideo": 42},
        {"resolution": "720p", "enabled": true, "priceWithoutVideo": 70, "priceWithVideo": 42},
        {"resolution": "1080p", "enabled": true, "priceWithoutVideo": 77, "priceWithVideo": 46},
        {"resolution": "4k", "enabled": false, "priceWithoutVideo": 0, "priceWithVideo": 0}
      ],
      "promos": [
        {"id": "d25d8019-2cab-4229-a632-bf35321d96d8", "resolution": "1080p", "startsAt": "2026-08-14", "endsAt": "2026-09-17", "discountFold": 7.2}
      ]
    },
    "generationFields": [
      {"name": "ratio", "apiName": "ratio", "type": "string", "description": "Output aspect ratio", "default": "adaptive", "enumValues": ["adaptive", "16:9", "9:16", "4:3", "1:1", "3:4", "21:9"]},
      {"name": "duration", "apiName": "duration", "type": "number", "description": "Video duration in seconds", "default": 5, "enumValues": ["4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30"]},
      {"name": "resolution", "apiName": "resolution", "type": "string", "description": "Output resolution", "default": "720p", "enumValues": ["480p", "720p", "1080p"]},
      {"name": "generate_audio", "apiName": "generate_audio", "type": "boolean", "description": "Generate synchronized audio", "default": true},
      {"name": "watermark", "apiName": "watermark", "type": "boolean", "description": "Add AI-generated watermark", "default": false},
      {"name": "reference_mode", "apiName": "", "type": "string", "description": "Reference assignment mode", "default": "reference_image", "enumValues": ["reference_image", "first_last_frame"], "clientOnly": true},
      {"name": "web_search", "apiName": "web_search", "type": "boolean", "description": "Web search", "default": false},
      {"name": "seed", "apiName": "seed", "type": "number", "description": "Random seed (-1 for random)", "default": -1, "hidden": true}
    ]
  }$json$::jsonb,
  "updated_at" = now()
WHERE "canonical_id" = 'doubao-seedance-2-5';

UPDATE "platform_settings"
SET "competitor_video_pricing" = $json${
  "series": {
    "doubao-seedance-2": {
      "addReferenceSecondsToOutput": false,
      "resolutions": {
        "480p": {"withoutReferencePerSec": 13, "withReferencePerSec": 20},
        "720p": {"withoutReferencePerSec": 27, "withReferencePerSec": 49},
        "1080p": {"withoutReferencePerSec": 68, "withReferencePerSec": 110},
        "4k": {"withoutReferencePerSec": 140, "withReferencePerSec": 260}
      }
    },
    "doubao-seedance-2-fast": {
      "addReferenceSecondsToOutput": false,
      "resolutions": {
        "480p": {"withoutReferencePerSec": 10, "withReferencePerSec": 16},
        "720p": {"withoutReferencePerSec": 22, "withReferencePerSec": 41}
      }
    },
    "doubao-seedance-2-mini": {
      "addReferenceSecondsToOutput": false,
      "resolutions": {
        "480p": {"withoutReferencePerSec": 8, "withReferencePerSec": 9},
        "720p": {"withoutReferencePerSec": 16, "withReferencePerSec": 20}
      }
    },
    "doubao-seedance-2-5": {
      "addReferenceSecondsToOutput": true,
      "resolutions": {
        "480p": {"withoutReferencePerSec": 20, "withReferencePerSec": null},
        "720p": {"withoutReferencePerSec": 46, "withReferencePerSec": null},
        "1080p": {"withoutReferencePerSec": 110, "withReferencePerSec": null}
      }
    }
  },
  "plans": [
    {"id": "standard-monthly", "name": "标准", "credits": 1500, "priceYuan": 59},
    {"id": "supreme-monthly", "name": "进阶", "credits": 4600, "priceYuan": 199},
    {"id": "74c0dc1d-bc04-4414-b6de-581ee929ab50", "name": "高级1", "credits": 11700, "priceYuan": 469},
    {"id": "6fef8318-d95c-4992-a1d6-198191ffb3a6", "name": "高级2", "credits": 16300, "priceYuan": 649},
    {"id": "76529922-831a-405d-b81b-74f0787d36d4", "name": "豪华", "credits": 32800, "priceYuan": 1199},
    {"id": "98806e9f-85c1-4a61-9d8b-5d76ef34233d", "name": "至尊1", "credits": 50500, "priceYuan": 1799},
    {"id": "e47b6ac7-9a0d-4c87-8460-5adaed8ee20a", "name": "至尊2", "credits": 66000, "priceYuan": 2299}
  ],
  "promos": [
    {"id": "0837a1b9-39a7-475e-9130-1ee39b3849f1", "canonicalId": "doubao-seedance-2-mini", "resolution": "any", "withReference": false, "startsAt": "2026-08-07", "endsAt": "2026-09-07", "discountFold": 4},
    {"id": "5133c6a0-c797-41dc-9472-72ab5a66a49a", "canonicalId": "doubao-seedance-2-fast", "resolution": "any", "withReference": false, "startsAt": "2026-08-07", "endsAt": "2026-09-07", "discountFold": 7.5},
    {"id": "0b3a8085-3e4a-4290-9377-30c3e07afb4c", "canonicalId": "doubao-seedance-2-5", "resolution": "720p", "withReference": true, "startsAt": "2026-08-07", "endsAt": "2026-09-17", "discountFold": 5.8}
  ]
}$json$
WHERE "competitor_video_pricing" IS NULL
   OR btrim("competitor_video_pricing") = '';
