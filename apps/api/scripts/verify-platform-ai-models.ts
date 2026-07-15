import { createDatabase } from "../src/db";
import { listPlatformAiModels } from "../src/db/platform-ai-model-queries";

async function main() {
  const db = createDatabase({ DATABASE_URL: process.env.DATABASE_URL });
  const models = await listPlatformAiModels(db, "text");
  console.log(
    JSON.stringify({
      count: models.length,
      first: models[0]?.canonicalId,
      schemaVersion: models[0]?.parameterRules.schemaVersion,
    })
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
