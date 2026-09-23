import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../migrations"
);
const client = postgres(databaseUrl, { max: 1, prepare: false });
try {
  await migrate(drizzle(client), { migrationsFolder });
  console.log("Database migrations completed");
} finally {
  await client.end();
}
