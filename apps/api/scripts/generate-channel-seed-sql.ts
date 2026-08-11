import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { PLATFORM_AI_MODEL_CHANNEL_SEED } from "@dafthunk/types";

const values = PLATFORM_AI_MODEL_CHANNEL_SEED.map((row) => {
  const canonicalId = row.canonicalId.replace(/'/g, "''");
  const presetId = row.presetId.replace(/'/g, "''");
  const upstreamModelId = row.upstreamModelId.replace(/'/g, "''");
  return `  ('${canonicalId}', '${row.channel}', '${presetId}', '${upstreamModelId}', ${row.channelEnabled})`;
}).join(",\n");

const sql = `CREATE TABLE IF NOT EXISTS "platform_ai_model_channels" (
  "canonical_id" text NOT NULL REFERENCES "platform_ai_models"("canonical_id") ON DELETE CASCADE,
  "channel" text NOT NULL,
  "preset_id" text NOT NULL,
  "upstream_model_id" text NOT NULL,
  "channel_enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("canonical_id", "channel")
);

INSERT INTO "platform_ai_model_channels" (
  "canonical_id",
  "channel",
  "preset_id",
  "upstream_model_id",
  "channel_enabled"
) VALUES
${values}
ON CONFLICT ("canonical_id", "channel") DO NOTHING;
`;

const target = resolve(
  import.meta.dirname,
  "../db/migrations/0065_platform_ai_model_channels.sql"
);
writeFileSync(target, sql, "utf8");
console.log(`Wrote ${PLATFORM_AI_MODEL_CHANNEL_SEED.length} channel rows to ${target}`);
