import type {
  DatabaseConnection,
  DatabaseService,
  QueryResult,
} from "@dafthunk/runtime";
import postgres from "postgres";

import type { DatabaseEnv } from "../context";
import { createDatabase, getDatabase, getSharedPostgresClient } from "../db";
import {
  ensureUserDatabaseSchema,
  getUserDatabaseSchemaName,
} from "../db/user-database-schema";

type PostgresClient = ReturnType<typeof postgres>;
type PostgresTransaction = Parameters<
  Parameters<PostgresClient["begin"]>[0]
>[0];

function convertPlaceholders(
  sqlStr: string,
  params: readonly unknown[] = []
): { sql: string; params: unknown[] } {
  let index = 0;
  const sql = sqlStr.replace(/\?/g, () => `$${++index}`);
  return { sql, params: [...params] };
}

class PostgresDatabaseConnection implements DatabaseConnection {
  constructor(
    private readonly client: PostgresClient,
    private readonly schemaName: string
  ) {}

  private async runInSchema<T>(
    operation: (tx: PostgresTransaction) => Promise<T>
  ): Promise<T> {
    return this.client.begin(async (tx) => {
      await tx.unsafe(`SET LOCAL search_path TO "${this.schemaName}"`);
      return operation(tx);
    }) as Promise<T>;
  }

  async query(sqlStr: string, params?: unknown[]): Promise<QueryResult> {
    const { sql, params: pgParams } = convertPlaceholders(sqlStr, params);
    return this.runInSchema(async (tx) => {
      const results = await tx.unsafe(sql, pgParams);
      return { results: [...results] as unknown[] };
    });
  }

  async execute(sqlStr: string, params?: unknown[]): Promise<QueryResult> {
    const { sql, params: pgParams } = convertPlaceholders(sqlStr, params);
    return this.runInSchema(async (tx) => {
      const result = await tx.unsafe(sql, pgParams);
      return {
        results: [],
        meta: {
          rowsAffected: result.count,
        },
      };
    });
  }
}

export class PostgresDatabaseService implements DatabaseService {
  constructor(private readonly env: DatabaseEnv) {}

  async resolve(
    databaseId: string,
    organizationId: string
  ): Promise<DatabaseConnection | undefined> {
    const db = createDatabase(this.env);
    const database = await getDatabase(db, databaseId, organizationId);
    if (!database) {
      return undefined;
    }

    await ensureUserDatabaseSchema(db, database.id);

    const client = getSharedPostgresClient(this.env);

    return new PostgresDatabaseConnection(
      client,
      getUserDatabaseSchemaName(database.id)
    );
  }
}
