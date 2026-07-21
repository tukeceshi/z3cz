import { ExecutableNode, type NodeContext } from "@dafthunk/runtime";
import type { Field, NodeExecution, NodeType, Schema } from "@dafthunk/types";
import {
  generateDescribeTableColumnsSQL,
  generateUniqueColumnNamesSQL,
  mapPostgresToType,
  type ColumnInfoRow,
  validateIdentifier,
} from "@dafthunk/runtime/utils/database-table";

export class DatabaseDescribeTableNode extends ExecutableNode {
  public static readonly nodeType: NodeType = {
    id: "database-describe-table",
    name: "Database Describe Table",
    type: "database-describe-table",
    description: "Returns the schema (field definitions) of a table.",
    tags: ["Database", "Schema", "Describe"],
    icon: "database",
    documentation:
      "Describes a database table by returning its field definitions. Uses Postgres catalog introspection to get field names and types. Useful for understanding table structure without fetching data.",
    asTool: true,
    inputs: [
      {
        name: "database",
        type: "database",
        description: "Database ID.",
        required: true,
        hidden: true,
      },
      {
        name: "table",
        type: "string",
        description: "Name of the table to describe.",
        required: true,
      },
    ],
    outputs: [
      {
        name: "schema",
        type: "schema",
        description: "Schema with name and field definitions.",
      },
    ],
  };

  async execute(context: NodeContext): Promise<NodeExecution> {
    const { database, table } = context.inputs;

    if (!database) {
      return this.createErrorResult("'database' is a required input.");
    }

    if (!table) {
      return this.createErrorResult("'table' is a required input.");
    }

    try {
      if (!context.databaseService) {
        return this.createErrorResult("Database service not available.");
      }

      const connection = await context.databaseService.resolve(
        database,
        context.organizationId
      );

      if (!connection) {
        return this.createErrorResult(
          `Database '${database}' not found or does not belong to your organization.`
        );
      }

      validateIdentifier(table as string, "table name");

      const describeSQL = generateDescribeTableColumnsSQL(table as string);
      const schemaResult = await connection.query(
        describeSQL.sql,
        describeSQL.params
      );

      if (!schemaResult.results || schemaResult.results.length === 0) {
        return this.createErrorResult(
          `Table '${table}' not found in database.`
        );
      }

      const rows = schemaResult.results as ColumnInfoRow[];
      const uniqueColumns = new Set<string>();
      try {
        const uniqueSQL = generateUniqueColumnNamesSQL(table as string);
        const uniqueResult = await connection.query(
          uniqueSQL.sql,
          uniqueSQL.params
        );
        for (const row of uniqueResult.results as { name: string }[]) {
          uniqueColumns.add(row.name);
        }
      } catch {
        // Unique index introspection is best-effort.
      }

      const fields: Field[] = rows.map((col) => ({
        name: col.name,
        type: mapPostgresToType(col.type || "text"),
        ...(col.pk ? { primaryKey: true } : {}),
        ...(!col.pk && uniqueColumns.has(col.name) ? { unique: true } : {}),
      }));

      const schema: Schema = {
        name: table as string,
        fields,
      };

      return this.createSuccessResult({
        schema,
      });
    } catch (error) {
      return this.createErrorResult(
        `Failed to describe table: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
