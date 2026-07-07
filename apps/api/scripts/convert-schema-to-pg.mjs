import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(__dirname, "../src/db/schema/index.ts");

let content = readFileSync(schemaPath, "utf8");

content = content.replace(
  `import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";`,
  `import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";`
);

content = content.replace(
  /const createCreatedAt = \(\) =>[\s\S]*?\.default\(sql`CURRENT_TIMESTAMP`\);\r?\n\r?\nconst createUpdatedAt = \(\) =>[\s\S]*?\.default\(sql`CURRENT_TIMESTAMP`\);/,
  `const createCreatedAt = () =>
  timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow();

const createUpdatedAt = () =>
  timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow();`
);

content = content.replaceAll("sqliteTable", "pgTable");
content = content.replaceAll(
  /integer\("([^"]+)", \{ mode: "boolean" \}\)/g,
  'boolean("$1")'
);
content = content.replaceAll(
  /integer\("([^"]+)", \{ mode: "timestamp" \}\)/g,
  'timestamp("$1", { withTimezone: true, mode: "date" })'
);

writeFileSync(schemaPath, content);
console.log("Converted schema to Postgres");
