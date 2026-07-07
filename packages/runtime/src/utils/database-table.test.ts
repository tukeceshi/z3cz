import type { Schema } from "@dafthunk/types";
import { describe, expect, it } from "vitest";
import {
  generateCheckTableExistsSQL,
  generateCreateTableSQL,
  generateInsertSQL,
  generatePutRowSQL,
  getPrimaryKeyField,
  mapPostgresToType,
  mapTypeToPostgres,
  validateIdentifier,
} from "./database-table";

describe("validateIdentifier", () => {
  it("should accept valid identifiers", () => {
    expect(() => validateIdentifier("users", "table name")).not.toThrow();
    expect(() => validateIdentifier("_private", "table name")).not.toThrow();
    expect(() => validateIdentifier("my_table_2", "table name")).not.toThrow();
  });

  it("should reject identifiers starting with a digit", () => {
    expect(() => validateIdentifier("2table", "table name")).toThrow(
      "Invalid table name"
    );
  });

  it("should reject identifiers with spaces", () => {
    expect(() => validateIdentifier("my table", "table name")).toThrow(
      "Invalid table name"
    );
  });

  it("should reject identifiers with special characters", () => {
    expect(() => validateIdentifier("table; DROP", "table name")).toThrow(
      "Invalid table name"
    );
    expect(() => validateIdentifier("table'name", "column name")).toThrow(
      "Invalid column name"
    );
  });

  it("should reject empty string", () => {
    expect(() => validateIdentifier("", "table name")).toThrow(
      "Invalid table name"
    );
  });

  it("should include the label in error message", () => {
    expect(() => validateIdentifier("bad name", "column name")).toThrow(
      "Invalid column name"
    );
  });
});

describe("mapTypeToPostgres", () => {
  it("should map string to TEXT", () => {
    expect(mapTypeToPostgres({ name: "name", type: "string" })).toBe("TEXT");
  });

  it("should map integer to INTEGER", () => {
    expect(mapTypeToPostgres({ name: "id", type: "integer" })).toBe("INTEGER");
  });

  it("should map autoincrement primary key to BIGSERIAL", () => {
    expect(
      mapTypeToPostgres({
        name: "id",
        type: "integer",
        primaryKey: true,
        autoIncrement: true,
      })
    ).toBe("BIGSERIAL");
  });

  it("should map number to DOUBLE PRECISION", () => {
    expect(mapTypeToPostgres({ name: "score", type: "number" })).toBe(
      "DOUBLE PRECISION"
    );
  });

  it("should map boolean to BOOLEAN", () => {
    expect(mapTypeToPostgres({ name: "active", type: "boolean" })).toBe(
      "BOOLEAN"
    );
  });

  it("should map datetime to TIMESTAMPTZ", () => {
    expect(mapTypeToPostgres({ name: "created", type: "datetime" })).toBe(
      "TIMESTAMPTZ"
    );
  });

  it("should map json to JSONB", () => {
    expect(mapTypeToPostgres({ name: "payload", type: "json" })).toBe("JSONB");
  });
});

describe("mapPostgresToType", () => {
  it("should map INTEGER to integer", () => {
    expect(mapPostgresToType("INTEGER")).toBe("integer");
  });

  it("should map BIGINT to integer", () => {
    expect(mapPostgresToType("BIGINT")).toBe("integer");
  });

  it("should map BOOLEAN to boolean", () => {
    expect(mapPostgresToType("BOOLEAN")).toBe("boolean");
  });

  it("should map DOUBLE PRECISION to number", () => {
    expect(mapPostgresToType("DOUBLE PRECISION")).toBe("number");
  });

  it("should map JSONB to json", () => {
    expect(mapPostgresToType("JSONB")).toBe("json");
  });

  it("should map TIMESTAMPTZ to datetime", () => {
    expect(mapPostgresToType("TIMESTAMPTZ")).toBe("datetime");
  });

  it("should map TEXT to string", () => {
    expect(mapPostgresToType("TEXT")).toBe("string");
  });
});

describe("generateCreateTableSQL", () => {
  it("should generate valid CREATE TABLE statement", () => {
    const schema: Schema = {
      name: "users",
      fields: [
        { name: "id", type: "integer", primaryKey: true },
        { name: "name", type: "string" },
        { name: "score", type: "number" },
      ],
    };

    expect(generateCreateTableSQL(schema)).toBe(
      "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT, score DOUBLE PRECISION)"
    );
  });

  it("should throw for missing name", () => {
    const schema = {
      name: "",
      fields: [{ name: "id", type: "integer" as const }],
    };
    expect(() => generateCreateTableSQL(schema)).toThrow();
  });

  it("should throw for empty fields", () => {
    const schema: Schema = { name: "test", fields: [] };
    expect(() => generateCreateTableSQL(schema)).toThrow();
  });

  it("should throw for invalid table name", () => {
    const schema: Schema = {
      name: "bad table",
      fields: [{ name: "id", type: "integer" }],
    };
    expect(() => generateCreateTableSQL(schema)).toThrow("Invalid table name");
  });

  it("should throw for invalid column name", () => {
    const schema: Schema = {
      name: "users",
      fields: [{ name: "bad column", type: "integer" }],
    };
    expect(() => generateCreateTableSQL(schema)).toThrow("Invalid column name");
  });
});

describe("generateInsertSQL", () => {
  it("should generate INSERT statement with params", () => {
    const data = [
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ];

    const result = generateInsertSQL("users", data);
    expect(result.sql).toBe("INSERT INTO users (id, name) VALUES (?, ?)");
    expect(result.params).toEqual([
      [1, "Alice"],
      [2, "Bob"],
    ]);
  });

  it("should throw for empty data", () => {
    expect(() => generateInsertSQL("users", [])).toThrow("No data to insert");
  });
});

describe("generatePutRowSQL", () => {
  it("should generate upsert SQL when primary key exists", () => {
    const schema: Schema = {
      name: "users",
      fields: [
        { name: "id", type: "integer", primaryKey: true },
        { name: "name", type: "string" },
      ],
    };

    expect(generatePutRowSQL(schema, ["id", "name"], schema.fields[0])).toBe(
      "INSERT INTO users (id, name) VALUES (?, ?) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name"
    );
  });
});

describe("generateCheckTableExistsSQL", () => {
  it("should generate check table SQL", () => {
    const result = generateCheckTableExistsSQL("users");
    expect(result.sql).toContain("information_schema.tables");
    expect(result.params).toEqual(["users"]);
  });
});

describe("getPrimaryKeyField", () => {
  it("should return the primary key field", () => {
    const schema: Schema = {
      name: "users",
      fields: [
        { name: "id", type: "integer", primaryKey: true },
        { name: "name", type: "string" },
      ],
    };

    const pk = getPrimaryKeyField(schema);
    expect(pk).toEqual({ name: "id", type: "integer", primaryKey: true });
  });

  it("should return null when no primary key is defined", () => {
    const schema: Schema = {
      name: "logs",
      fields: [
        { name: "message", type: "string" },
        { name: "level", type: "string" },
      ],
    };

    expect(getPrimaryKeyField(schema)).toBeNull();
  });
});
