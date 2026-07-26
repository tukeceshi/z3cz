import {
  type CreateDatabaseRequest,
  type CreateDatabaseResponse,
  type DatabaseQueryRequest,
  type DatabaseQueryResponse,
  type DatabaseSchemaColumn,
  type DatabaseSchemaForeignKey,
  type DatabaseSchemaResponse,
  type DatabaseSchemaTable,
  type DeleteDatabaseResponse,
  type GetDatabaseResponse,
  IDENTIFIER_PATTERN,
  type ListDatabasesResponse,
  type UpdateDatabaseRequest,
  type UpdateDatabaseResponse,
} from "@dafthunk/types";
import {
  columnHasAutoIncrement,
  generateDescribeTableColumnsSQL,
  generateForeignKeysSQL,
  generateListTablesSQL,
  generateUniqueColumnNamesSQL,
  type ColumnInfoRow,
} from "@dafthunk/runtime";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { v7 as uuid } from "uuid";
import { z } from "zod";

import { apiKeyOrJwtMiddleware, jwtMiddleware } from "../auth";
import { ApiContext } from "../context";
import {
  createDatabase,
  createDatabaseRecord,
  deleteDatabaseRecord,
  dropUserDatabaseSchema,
  ensureUserDatabaseSchema,
  getDatabase,
  getDatabases,
  updateDatabaseRecord,
} from "../db";
import { PostgresDatabaseService } from "../runtime/postgres-database-service";
import { getAuthContext } from "../utils/auth-context";
import { createRequireFeatureMiddleware } from "../middleware/require-feature";
import { requireOrganizationOwner } from "../middleware/org-permissions";

type ExtendedApiContext = ApiContext & {
  Variables: {
    organizationId?: string;
  };
};

const databaseRoutes = new Hono<ExtendedApiContext>();

databaseRoutes.use("*", jwtMiddleware);
databaseRoutes.use("*", requireOrganizationOwner());
databaseRoutes.use("*", createRequireFeatureMiddleware("databases"));

databaseRoutes.get("/", async (c) => {
  const db = createDatabase(c.env);
  const organizationId = c.get("organizationId")!;

  const allDatabases = await getDatabases(db, organizationId);

  const response: ListDatabasesResponse = { databases: allDatabases };
  return c.json(response);
});

databaseRoutes.post(
  "/",
  zValidator(
    "json",
    z.object({
      name: z
        .string()
        .min(1, "Database name is required")
        .regex(
          IDENTIFIER_PATTERN,
          "Must start with a letter or underscore, and contain only letters, digits, or underscores"
        ),
    }) as z.ZodType<CreateDatabaseRequest>
  ),
  async (c) => {
    const data = c.req.valid("json");
    const now = new Date();
    const organizationId = c.get("organizationId")!;
    const db = createDatabase(c.env);

    const databaseId = uuid();
    const databaseName = data.name || "Untitled Database";

    const newDatabase = await createDatabaseRecord(db, {
      id: databaseId,
      name: databaseName,
      organizationId: organizationId,
      createdAt: now,
      updatedAt: now,
    });

    await ensureUserDatabaseSchema(db, databaseId);

    const response: CreateDatabaseResponse = {
      id: newDatabase.id,
      name: newDatabase.name,
      createdAt: newDatabase.createdAt,
      updatedAt: newDatabase.updatedAt,
    };

    return c.json(response, 201);
  }
);

databaseRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const db = createDatabase(c.env);
  const organizationId = c.get("organizationId")!;

  const database = await getDatabase(db, id, organizationId);
  if (!database) {
    return c.json({ error: "Database not found" }, 404);
  }

  const response: GetDatabaseResponse = {
    id: database.id,
    name: database.name,
    createdAt: database.createdAt,
    updatedAt: database.updatedAt,
  };

  return c.json(response);
});

databaseRoutes.put(
  "/:id",
  zValidator(
    "json",
    z.object({
      name: z
        .string()
        .min(1, "Database name is required")
        .regex(
          IDENTIFIER_PATTERN,
          "Must start with a letter or underscore, and contain only letters, digits, or underscores"
        ),
    }) as z.ZodType<UpdateDatabaseRequest>
  ),
  async (c) => {
    const id = c.req.param("id");
    const db = createDatabase(c.env);
    const organizationId = c.get("organizationId")!;

    const existingDatabase = await getDatabase(db, id, organizationId);
    if (!existingDatabase) {
      return c.json({ error: "Database not found" }, 404);
    }

    const data = c.req.valid("json");
    const now = new Date();

    const updatedDatabase = await updateDatabaseRecord(db, id, organizationId, {
      name: data.name,
      updatedAt: now,
    });

    const response: UpdateDatabaseResponse = {
      id: updatedDatabase.id,
      name: updatedDatabase.name,
      createdAt: updatedDatabase.createdAt,
      updatedAt: updatedDatabase.updatedAt,
    };

    return c.json(response);
  }
);

databaseRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const db = createDatabase(c.env);
  const organizationId = c.get("organizationId")!;

  const existingDatabase = await getDatabase(db, id, organizationId);
  if (!existingDatabase) {
    return c.json({ error: "Database not found" }, 404);
  }

  await dropUserDatabaseSchema(db, id);

  const deletedDatabase = await deleteDatabaseRecord(db, id, organizationId);
  if (!deletedDatabase) {
    return c.json({ error: "Failed to delete database" }, 500);
  }

  const response: DeleteDatabaseResponse = { id: deletedDatabase.id };
  return c.json(response);
});

databaseRoutes.get("/:databaseId/schema", apiKeyOrJwtMiddleware, async (c) => {
  const databaseId = c.req.param("databaseId")!;
  const { organizationId } = getAuthContext(c);

  const databaseService = new PostgresDatabaseService(c.env);
  const connection = await databaseService.resolve(databaseId, organizationId);
  if (!connection) {
    return c.json(
      { error: "Database not found or does not belong to your organization" },
      404
    );
  }

  try {
    const listTablesSQL = generateListTablesSQL();
    const tablesResult = await connection.query(
      listTablesSQL.sql,
      listTablesSQL.params
    );
    const tableNames = (tablesResult.results as { name: string }[]).map(
      (row) => row.name
    );

    const tables: DatabaseSchemaTable[] = await Promise.all(
      tableNames.map(async (tableName) => {
        const describeSQL = generateDescribeTableColumnsSQL(tableName);
        const uniqueSQL = generateUniqueColumnNamesSQL(tableName);
        const foreignKeysSQL = generateForeignKeysSQL(tableName);

        const [columnsResult, uniqueResult, fksResult] = await Promise.all([
          connection.query(describeSQL.sql, describeSQL.params),
          connection.query(uniqueSQL.sql, uniqueSQL.params),
          connection.query(foreignKeysSQL.sql, foreignKeysSQL.params),
        ]);

        const uniqueColumns = new Set(
          (uniqueResult.results as { name: string }[]).map((row) => row.name)
        );

        const columns: DatabaseSchemaColumn[] = (
          columnsResult.results as ColumnInfoRow[]
        ).map((col) => ({
          name: col.name,
          type: col.type,
          notnull: col.notnull === true || col.notnull === 1,
          defaultValue: col.dflt_value,
          primaryKey: col.pk === true || col.pk === 1,
          unique: uniqueColumns.has(col.name),
          autoIncrement:
            (col.pk === true || col.pk === 1) &&
            columnHasAutoIncrement(col.dflt_value),
        }));

        const foreignKeys: DatabaseSchemaForeignKey[] = (
          fksResult.results as {
            from: string;
            table: string;
            to: string;
          }[]
        ).map((fk) => ({
          column: fk.from,
          referencedTable: fk.table,
          referencedColumn: fk.to,
        }));

        return { name: tableName, columns, foreignKeys };
      })
    );

    const response: DatabaseSchemaResponse = { tables };
    return c.json(response);
  } catch (error) {
    return c.json(
      {
        error: `Failed to fetch schema: ${error instanceof Error ? error.message : String(error)}`,
      },
      500
    );
  }
});

databaseRoutes.post(
  "/:databaseId/query",
  apiKeyOrJwtMiddleware,
  zValidator(
    "json",
    z.object({
      sql: z.string().min(1, "SQL query is required"),
      params: z.array(z.unknown()).optional(),
    }) as z.ZodType<DatabaseQueryRequest>
  ),
  async (c) => {
    const databaseId = c.req.param("databaseId");
    const { sql, params } = c.req.valid("json");
    const { organizationId } = getAuthContext(c);

    const databaseService = new PostgresDatabaseService(c.env);
    const connection = await databaseService.resolve(
      databaseId,
      organizationId
    );
    if (!connection) {
      return c.json(
        { error: "Database not found or does not belong to your organization" },
        404
      );
    }

    try {
      const result = await connection.query(sql, params);

      const response: DatabaseQueryResponse = result;
      return c.json(response);
    } catch (error) {
      return c.json(
        {
          error: `Failed to execute query: ${error instanceof Error ? error.message : String(error)}`,
        },
        500
      );
    }
  }
);

export default databaseRoutes;
