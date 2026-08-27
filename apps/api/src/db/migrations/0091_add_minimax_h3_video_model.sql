INSERT INTO "platform_ai_models" (

  "canonical_id",

  "display_name",

  "modality",

  "platform_enabled",

  "parameter_rules",

  "sort_order",

  "brand_icon"

) VALUES (

  'minimax-h3',

  'MiniMax H3',

  'video',

  true,

  '{

    "schemaVersion": 1,

    "sizePolicy": {"enabled": false, "effectMode": "legacy"},

    "maxReferenceImages": 9,

    "maxImageReferenceBytes": 31457280,

    "maxReferenceVideos": 3,

    "maxVideoReferenceBytes": 52428800,

    "maxVideoReferenceSeconds": 15,

    "maxReferenceAudios": 3,

    "maxAudioReferenceBytes": 15728640,

    "maxAudioReferenceSeconds": 15,

    "promptMaxChars": 7000,

    "supportsTaskCancel": true,

    "priceEstimate": {

      "enabled": false,

      "tiers": [

        {"resolution": "480p", "enabled": false, "priceWithoutVideo": 0, "priceWithVideo": 0},

        {"resolution": "720p", "enabled": false, "priceWithoutVideo": 0, "priceWithVideo": 0},

        {"resolution": "768p", "enabled": false, "priceWithoutVideo": 0, "priceWithVideo": 0},

        {"resolution": "1080p", "enabled": false, "priceWithoutVideo": 0, "priceWithVideo": 0},

        {"resolution": "2k", "enabled": false, "priceWithoutVideo": 0, "priceWithVideo": 0},

        {"resolution": "4k", "enabled": false, "priceWithoutVideo": 0, "priceWithVideo": 0}

      ],

      "promos": []

    },

    "generationFields": [

      {"name": "ratio", "apiName": "ratio", "type": "string", "description": "Output aspect ratio", "default": "16:9", "enumValues": ["16:9", "9:16", "4:3", "1:1", "3:4", "21:9"]},

      {"name": "duration", "apiName": "duration", "type": "number", "description": "Video duration in seconds", "default": 5, "enumValues": ["4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15"]},

      {"name": "resolution", "apiName": "resolution", "type": "string", "description": "Output resolution", "default": "768p", "enumValues": ["768p", "2k"]},

      {"name": "watermark", "apiName": "aigc_watermark", "type": "boolean", "description": "Add AI-generated watermark", "default": false},

      {"name": "reference_mode", "apiName": "", "type": "string", "description": "Reference assignment mode", "default": "reference_image", "enumValues": ["reference_image", "first_last_frame"], "clientOnly": true},

      {"name": "seed", "apiName": "seed", "type": "number", "description": "Random seed (-1 for random)", "default": -1, "hidden": true}

    ]

  }'::jsonb,

  98,

  'minimax'

)

ON CONFLICT ("canonical_id") DO NOTHING;



INSERT INTO "platform_ai_model_channels" (

  "canonical_id",

  "channel",

  "preset_id",

  "upstream_model_id",

  "channel_enabled"

) VALUES (

  'minimax-h3',

  'api',

  'provider:minimax-video',

  'MiniMax-H3',

  true

)

ON CONFLICT ("canonical_id", "channel") DO NOTHING;


