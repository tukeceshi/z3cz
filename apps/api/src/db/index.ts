import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import type { DatabaseEnv } from "../context";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

interface GlobalDbState {
  __dafthunkPg?: Map<string, postgres.Sql>;
}

const globalForDb = globalThis as GlobalDbState;
const nodeClients =
  globalForDb.__dafthunkPg ?? new Map<string, postgres.Sql>();
globalForDb.__dafthunkPg = nodeClients;

function getConnectionString(env: DatabaseEnv): string {
  const connectionString =
    env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "Database connection requires HYPERDRIVE binding or DATABASE_URL"
    );
  }
  return connectionString;
}

function createPostgresClient(
  connectionString: string,
  env: DatabaseEnv
): postgres.Sql {
  // Hyperdrive (Workers) pools externally — keep per-request clients there.
  if (env.HYPERDRIVE) {
    return postgres(connectionString, {
      prepare: false,
      max: 5,
      fetch_types: false,
    });
  }

  const existing = nodeClients.get(connectionString);
  if (existing) {
    return existing;
  }

  const client = postgres(connectionString, {
    prepare: false,
    max: 5,
    fetch_types: false,
    idle_timeout: 20,
    max_lifetime: 60 * 30,
  });
  nodeClients.set(connectionString, client);
  return client;
}

export function getSharedPostgresClient(env: DatabaseEnv): postgres.Sql {
  return createPostgresClient(getConnectionString(env), env);
}

export function createDatabase(env: DatabaseEnv): Database {
  const connectionString = getConnectionString(env);
  const client = createPostgresClient(connectionString, env);
  return drizzle(client, { schema });
}

export async function closeDatabaseConnections(): Promise<void> {
  await Promise.all([...nodeClients.values()].map((client) => client.end()));
  nodeClients.clear();
}
export * from "./platform-relay-account-queries";
export * from "./ai-interface-queries";
export * from "./onboarding";
export * from "./platform-settings-queries";
export * from "./workflow-scheme-queries";
export * from "./queries";
export * from "./schema";
export * from "./support-queries";
export * from "./user-database-schema";
