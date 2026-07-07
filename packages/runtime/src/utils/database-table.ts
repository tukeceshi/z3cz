import {
  type Field,
  type FieldType,
  IDENTIFIER_PATTERN,
  type Schema,
} from "@dafthunk/types";

export interface ColumnInfoRow {
  name: string;
  type: string;
  notnull: boolean | number;
  dflt_value: string | null;
  pk: boolean | number;
}

/** @deprecated Use ColumnInfoRow */
export type PragmaTableInfoRow = ColumnInfoRow;

export function validateIdentifier(name: string, label: string): void {
  if (!IDENTIFIER_PATTERN.test(name)) {
    throw new Error(
      `Invalid ${label}: '${name}'. Must start with a letter or underscore and contain only letters, digits, and underscores.`
    );
  }
}

export function mapTypeToPostgres(field: Field): string {
  switch (field.type) {
    case "string":
      return "TEXT";
    case "integer":
      if (field.primaryKey && field.autoIncrement) {
        return "BIGSERIAL";
      }
      return "INTEGER";
    case "number":
      return "DOUBLE PRECISION";
    case "boolean":
      return "BOOLEAN";
    case "datetime":
      return "TIMESTAMPTZ";
    case "json":
      return "JSONB";
    case "image":
    case "document":
    case "audio":
    case "video":
    case "blob":
      return "JSONB";
    default:
      throw new Error(`Unsupported field type: ${field.type satisfies never}`);
  }
}

/** @deprecated Use mapTypeToPostgres */
export function mapTypeToSqlite(type: FieldType): string {
  return mapTypeToPostgres({ name: "_", type });
}

export function mapPostgresToType(pgType: string): FieldType {
  const normalized = pgType.toUpperCase().trim();

  if (
    normalized.includes("INT") ||
    normalized.includes("SERIAL") ||
    normalized === "BIGSERIAL"
  ) {
    return "integer";
  }

  if (
    normalized.includes("DOUBLE") ||
    normalized.includes("REAL") ||
    normalized.includes("FLOAT") ||
    normalized.includes("DECIMAL") ||
    normalized.includes("NUMERIC")
  ) {
    return "number";
  }

  if (normalized.includes("BOOL")) {
    return "boolean";
  }

  if (
    normalized.includes("JSON") ||
    normalized.includes("JSONB") ||
    normalized.includes("BLOB")
  ) {
    return "json";
  }

  if (
    normalized.includes("DATE") ||
    normalized.includes("TIME") ||
    normalized.includes("TIMESTAMP")
  ) {
    return "datetime";
  }

  return "string";
}

/** @deprecated Use mapPostgresToType */
export function mapSqliteToType(sqliteType: string): FieldType {
  return mapPostgresToType(sqliteType);
}

export function generateCreateTableSQL(schema: Schema): string {
  const { name, fields } = schema;

  if (!name || !fields || fields.length === 0) {
    throw new Error("Invalid schema: name and fields are required");
  }

  validateIdentifier(name, "table name");
  for (const field of fields) {
    validateIdentifier(field.name, "column name");
  }

  const columns = fields.map((field) => {
    const sqlType = mapTypeToPostgres(field);
    const isSerial = sqlType === "BIGSERIAL";
    const pk = field.primaryKey ? " PRIMARY KEY" : "";
    const uq = !field.primaryKey && field.unique ? " UNIQUE" : "";
    let ref = "";
    if (field.references) {
      validateIdentifier(field.references, "referenced table name");
      ref = ` REFERENCES ${field.references}`;
    }
    if (isSerial) {
      return `${field.name} ${sqlType}${pk}${ref}`;
    }
    return `${field.name} ${sqlType}${pk}${uq}${ref}`;
  });

  return `CREATE TABLE IF NOT EXISTS ${name} (${columns.join(", ")})`;
}

export function generateInsertSQL(
  tableName: string,
  data: Record<string, unknown>[]
): { sql: string; params: unknown[][] } {
  if (!data || data.length === 0) {
    throw new Error("No data to insert");
  }

  validateIdentifier(tableName, "table name");

  const columns = Object.keys(data[0]);
  for (const col of columns) {
    validateIdentifier(col, "column name");
  }
  const placeholders = columns.map(() => "?").join(", ");
  const sql = `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${placeholders})`;
  const params = data.map((row) => columns.map((col) => row[col]));

  return { sql, params };
}

export function generatePutRowSQL(
  schema: Schema,
  columns: readonly string[],
  pkField: Field | null
): string {
  validateIdentifier(schema.name, "table name");
  const placeholders = columns.map(() => "?").join(", ");

  if (!pkField) {
    return `INSERT INTO ${schema.name} (${columns.join(", ")}) VALUES (${placeholders})`;
  }

  const updates = columns
    .filter((column) => column !== pkField.name)
    .map((column) => `${column} = EXCLUDED.${column}`)
    .join(", ");

  return `INSERT INTO ${schema.name} (${columns.join(", ")}) VALUES (${placeholders}) ON CONFLICT (${pkField.name}) DO UPDATE SET ${updates}`;
}

export function getPrimaryKeyField(schema: Schema): Field | null {
  return schema.fields.find((field) => field.primaryKey === true) ?? null;
}

export function generateCheckTableExistsSQL(tableName: string): {
  sql: string;
  params: string[];
} {
  validateIdentifier(tableName, "table name");
  return {
    sql: `SELECT table_name AS name FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_type = 'BASE TABLE'
        AND table_name = ?`,
    params: [tableName],
  };
}

export function generateListTablesSQL(): { sql: string; params: [] } {
  return {
    sql: `SELECT table_name AS name FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_type = 'BASE TABLE'
      ORDER BY table_name`,
    params: [],
  };
}

export function generateDescribeTableColumnsSQL(tableName: string): {
  sql: string;
  params: string[];
} {
  validateIdentifier(tableName, "table name");
  return {
    sql: `SELECT c.column_name AS name,
             c.data_type AS type,
             CASE WHEN c.is_nullable = 'NO' THEN 1 ELSE 0 END AS notnull,
             c.column_default AS dflt_value,
             CASE WHEN pk.column_name IS NOT NULL THEN 1 ELSE 0 END AS pk
      FROM information_schema.columns c
      LEFT JOIN (
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = current_schema()
          AND tc.table_name = ?
      ) pk ON pk.column_name = c.column_name
      WHERE c.table_schema = current_schema()
        AND c.table_name = ?
      ORDER BY c.ordinal_position`,
    params: [tableName, tableName],
  };
}

export function generateUniqueColumnNamesSQL(tableName: string): {
  sql: string;
  params: string[];
} {
  validateIdentifier(tableName, "table name");
  return {
    sql: `WITH single_column_unique AS (
        SELECT tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'UNIQUE'
          AND tc.table_schema = current_schema()
          AND tc.table_name = ?
        GROUP BY tc.constraint_name
        HAVING COUNT(*) = 1
      )
      SELECT kcu.column_name AS name
      FROM single_column_unique scu
      JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_name = scu.constraint_name
       AND kcu.table_schema = current_schema()
      WHERE kcu.table_name = ?`,
    params: [tableName, tableName],
  };
}

export function generateForeignKeysSQL(tableName: string): {
  sql: string;
  params: string[];
} {
  validateIdentifier(tableName, "table name");
  return {
    sql: `SELECT kcu.column_name AS "from",
             ccu.table_name AS "table",
             ccu.column_name AS "to"
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
       AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = current_schema()
        AND tc.table_name = ?`,
    params: [tableName],
  };
}

export function columnHasAutoIncrement(defaultValue: string | null): boolean {
  if (!defaultValue) {
    return false;
  }
  return /nextval\(/i.test(defaultValue);
}
