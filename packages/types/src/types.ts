import type { NodeType } from "./workflow";

/**
 * Response for getting all available node types
 */
export interface GetNodeTypesResponse {
  nodeTypes: NodeType[];
}

/**
 * Field types
 */
/**
 * All supported field types, in display order. Single source of truth — derive
 * enums/validators from this (e.g. `z.enum(FIELD_TYPES)`) so they can't drift.
 * The blob types (image…blob) hold an `ObjectReference` (an R2-stored file),
 * serialized as JSON wherever a record is persisted (database, queue), and are
 * invalid for LLM structured output — a model cannot emit a file.
 */
export const FIELD_TYPES = [
  "string",
  "integer",
  "number",
  "boolean",
  "datetime",
  "json",
  "image",
  "document",
  "audio",
  "video",
  "blob",
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

/**
 * Blob-backed field types whose value is an `ObjectReference`.
 * Used to branch persistence/validation and to gate structured-output usage.
 */
export const BLOB_FIELD_TYPES = [
  "image",
  "document",
  "audio",
  "video",
  "blob",
] as const satisfies readonly FieldType[];

export function isBlobFieldType(type: FieldType): boolean {
  return (BLOB_FIELD_TYPES as readonly string[]).includes(type);
}

/**
 * Pattern for valid identifier names (schema names, field names).
 * Must start with a letter or underscore, followed by letters, digits, or underscores.
 * Valid: firstName, first_name, FIRSTNAME
 * Invalid: first-name, "first name", 123abc
 */
export const IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * Field definition
 */
export interface Field {
  name: string;
  type: FieldType;
  required?: boolean;
  primaryKey?: boolean;
  autoIncrement?: boolean;
  label?: string;
  defaultValue?: string;
  unique?: boolean;
  references?: string;
}

/**
 * Schema definition
 */
export interface Schema {
  id?: string;
  name: string;
  description?: string;
  fields: Field[];
}

/**
 * Table with schema and data
 */
export interface Table {
  schema: Schema;
  data: Record<string, unknown>[];
}

