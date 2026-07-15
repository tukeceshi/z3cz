CREATE TABLE IF NOT EXISTS "platform_ai_models" (
  "canonical_id" text PRIMARY KEY NOT NULL,
  "display_name" text NOT NULL,
  "modality" text NOT NULL,
  "platform_enabled" boolean NOT NULL DEFAULT true,
  "provider_model_id" text NOT NULL,
  "parameter_rules" jsonb NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "ai_model_invocations" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "canonical_id" text NOT NULL,
  "display_name" text NOT NULL,
  "interface_id" text,
  "interface_name" text,
  "prompt_excerpt" text NOT NULL DEFAULT '',
  "content" text NOT NULL DEFAULT '',
  "source" text NOT NULL,
  "status" text NOT NULL,
  "error" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ai_model_invocations_org_created_idx"
  ON "ai_model_invocations" ("organization_id", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "organization_model_interface_priorities" (
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "canonical_id" text NOT NULL,
  "interface_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("organization_id", "canonical_id")
);

INSERT INTO "platform_ai_models" (
  "canonical_id",
  "display_name",
  "modality",
  "platform_enabled",
  "provider_model_id",
  "parameter_rules",
  "sort_order"
) VALUES
  (
    'deepseek-v4-flash',
    'DeepSeek V4 Flash',
    'text',
    true,
    'deepseek-v4-flash-260425',
    '{"schemaVersion":1,"referenceInputs":[{"type":"string","field":"keywords","maxCount":1}],"keywordsMaxChars":32000,"promptMaxChars":32000,"outputMaxTokens":4096,"outputMaxTokensLimit":8192,"outputMaxChars":32000,"contextWindowTokens":1048576}'::jsonb,
    10
  ),
  (
    'deepseek-v4-pro',
    'DeepSeek V4 Pro',
    'text',
    true,
    'deepseek-v4-pro-260425',
    '{"schemaVersion":1,"referenceInputs":[{"type":"string","field":"keywords","maxCount":1}],"keywordsMaxChars":32000,"promptMaxChars":32000,"outputMaxTokens":4096,"outputMaxTokensLimit":8192,"outputMaxChars":32000,"contextWindowTokens":1048576}'::jsonb,
    20
  ),
  (
    'doubao-seed-evolving',
    'Doubao Seed Evolving',
    'text',
    true,
    'doubao-seed-evolving',
    '{"schemaVersion":1,"referenceInputs":[{"type":"string","field":"keywords","maxCount":1}],"keywordsMaxChars":32000,"promptMaxChars":32000,"outputMaxTokens":4096,"outputMaxTokensLimit":8192,"outputMaxChars":32000,"contextWindowTokens":1048576}'::jsonb,
    30
  ),
  (
    'doubao-seedream-5',
    'Seedream 5.0',
    'image',
    true,
    'doubao-seedream-5-0-260128',
    '{"schemaVersion":1,"maxReferenceImages":4}'::jsonb,
    40
  ),
  (
    'doubao-seedance-2',
    'Seedance 2.0',
    'video',
    true,
    'doubao-seedance-2-0-260128',
    '{"schemaVersion":1,"maxReferenceVideos":1}'::jsonb,
    50
  ),
  (
    'doubao-seedance-2-fast',
    'Seedance 2.0 Fast',
    'video',
    true,
    'doubao-seedance-2-0-fast-260128',
    '{"schemaVersion":1,"maxReferenceVideos":1}'::jsonb,
    60
  ),
  (
    'doubao-seedance-2-mini',
    'Seedance 2.0 Mini',
    'video',
    true,
    'doubao-seedance-2-0-mini-260615',
    '{"schemaVersion":1,"maxReferenceVideos":1}'::jsonb,
    70
  )
ON CONFLICT ("canonical_id") DO NOTHING;
