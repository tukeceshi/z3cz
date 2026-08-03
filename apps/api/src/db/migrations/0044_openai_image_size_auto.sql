-- GPT Image 2: add smart (auto) resolution option.

UPDATE "platform_ai_models"
SET
  "parameter_rules" = '{
    "schemaVersion": 1,
    "maxReferenceImages": 4,
    "maxImageReferenceBytes": 10485760,
    "promptMaxChars": 600,
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
        "enumValues": ["auto", "1:1", "16:9", "9:16"],
        "clientOnly": true
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
WHERE "canonical_id" = 'gpt-image-2';
