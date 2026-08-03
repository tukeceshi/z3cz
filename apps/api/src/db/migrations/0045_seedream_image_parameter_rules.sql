-- Seedream: explicit generation fields (count via countPolicy, not DEFAULT fallback).

UPDATE "platform_ai_models"
SET
  "parameter_rules" = '{
    "schemaVersion": 1,
    "maxReferenceImages": 4,
    "maxImageReferenceBytes": 10485760,
    "promptMaxChars": 600,
    "countPolicy": {
      "enabled": true,
      "effectMode": "sequential_image_generation"
    },
    "generationFields": [
      {
        "name": "size",
        "apiName": "size",
        "type": "string",
        "description": "分辨率",
        "default": "auto",
        "enumValues": ["auto", "1K", "2K", "4K"]
      },
      {
        "name": "ratio",
        "apiName": "",
        "type": "string",
        "description": "选择比例",
        "default": "auto",
        "enumValues": ["auto", "21:9", "16:9", "3:2", "4:3", "1:1", "3:4", "2:3", "9:16"],
        "clientOnly": true
      },
      {
        "name": "generate_count",
        "apiName": "max_images",
        "type": "number",
        "description": "生成数量",
        "default": 1,
        "enumValues": ["1", "2", "3", "4"],
        "clientOnly": true,
        "implementationMode": "sequential_count"
      },
      {
        "name": "watermark",
        "apiName": "watermark",
        "type": "boolean",
        "description": "水印",
        "default": false
      }
    ]
  }'::jsonb,
  "updated_at" = now()
WHERE "canonical_id" = 'doubao-seedream-5';
