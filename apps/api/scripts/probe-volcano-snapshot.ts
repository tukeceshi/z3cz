import { loadNodeEnv } from "../src/env/load-node-env";
import { createNodeBindings } from "../src/env/create-node-bindings";
import { buildVolcanoSnapshot } from "../src/integrations/volcengine/snapshot";

async function main(): Promise<void> {
  const organizationId =
    process.env.ORG_ID ?? "019f3b1f-9377-705f-a3d4-8a6fe24f42a7";
  const interfaceId =
    process.env.INTERFACE_ID ?? "40cb912f-a986-43e3-9f65-3ba3976a9ee2";

  const envVars = loadNodeEnv();
  const env = await createNodeBindings(envVars);
  const snapshot = await buildVolcanoSnapshot({
    env,
    organizationId,
    interfaceId,
  });

  console.log(
    JSON.stringify(
      {
        fetchedAt: snapshot.fetchedAt,
        apiKey: snapshot.apiKey,
        models: snapshot.models.map((row) => ({
          canonicalId: row.canonicalId,
          enabled: row.enabled,
          usage: row.usage,
          usageError: row.usageError,
        })),
      },
      null,
      2
    )
  );
}

void main();
