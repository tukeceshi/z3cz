CREATE TABLE IF NOT EXISTS "agent_conversations" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "workflow_id" text NOT NULL REFERENCES "workflows"("id") ON DELETE CASCADE,
  "title" text NOT NULL DEFAULT '',
  "cloud_path" text NOT NULL,
  "sealed" boolean NOT NULL DEFAULT true,
  "holder_user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "agent_conversations_org_workflow_idx"
  ON "agent_conversations" ("organization_id", "workflow_id");

CREATE INDEX IF NOT EXISTS "agent_conversations_updated_at_idx"
  ON "agent_conversations" ("updated_at");

UPDATE "platform_ai_models"
SET
  "parameter_rules" = jsonb_set("parameter_rules", '{contextWindowTokens}', '128000'::jsonb),
  "updated_at" = now()
WHERE "modality" = 'text'
  AND "canonical_id" IN ('deepseek-v4-flash', 'deepseek-v4-pro', 'glm-5-2');

UPDATE "platform_ai_models"
SET
  "parameter_rules" = jsonb_set("parameter_rules", '{contextWindowTokens}', '256000'::jsonb),
  "updated_at" = now()
WHERE "modality" = 'text'
  AND "canonical_id" IN (
    'doubao-seed-evolving',
    'kimi-k3',
    'kimi-k2.6',
    'kimi-k2.5',
    'grok-4-5',
    'grok-4-3'
  );

UPDATE "platform_ai_models"
SET
  "parameter_rules" = jsonb_set("parameter_rules", '{contextWindowTokens}', '400000'::jsonb),
  "updated_at" = now()
WHERE "modality" = 'text'
  AND "canonical_id" IN ('gpt-5-6-sol', 'gpt-5-6-terra', 'gpt-5-6-luna');

UPDATE "platform_ai_models"
SET
  "parameter_rules" = jsonb_set("parameter_rules", '{contextWindowTokens}', '200000'::jsonb),
  "updated_at" = now()
WHERE "modality" = 'text'
  AND "canonical_id" IN ('claude-sonnet-5', 'claude-opus-5', 'claude-haiku-4-5');

UPDATE "platform_ai_models"
SET
  "parameter_rules" = jsonb_set("parameter_rules", '{contextWindowTokens}', '1048576'::jsonb),
  "updated_at" = now()
WHERE "modality" = 'text'
  AND "canonical_id" IN (
    'gemini-3-5-flash',
    'gemini-3-6-flash',
    'gemini-3-5-flash-lite'
  );
