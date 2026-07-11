import type {
  CreateWorkflowSchemeRequest,
  PublicWorkflowScheme,
  UpdateWorkflowSchemeRequest,
  WorkflowRuntime,
  WorkflowScheme,
  WorkflowSchemeNodeRules,
  WorkflowTrigger,
} from "@dafthunk/types";
import {
  ALL_WORKFLOW_RUNTIMES,
  ALL_WORKFLOW_TRIGGERS,
} from "@dafthunk/types";
import { and, asc, eq, ne } from "drizzle-orm";

import type { Database } from "./index";
import {
  WORKFLOW_SCHEME_OMNIPOTENT_ID as OMNIPOTENT_ID,
  workflowSchemes,
} from "./schema";

function parseJsonArray<T extends string>(value: string | null): T[] {
  if (!value) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is T => typeof item === "string");
  } catch {
    return [];
  }
}

function serializeJsonArray(values: readonly string[] | undefined): string | null {
  if (!values || values.length === 0) {
    return null;
  }
  return JSON.stringify([...values]);
}

function rowToNodeRules(
  row: typeof workflowSchemes.$inferSelect
): WorkflowSchemeNodeRules {
  return {
    includeTags: parseJsonArray(row.includeTags),
    includeNodeTypes: parseJsonArray(row.includeNodeTypes),
    excludeNodeTypes: parseJsonArray(row.excludeNodeTypes),
    alwaysIncludeNodeTypes: parseJsonArray(row.alwaysIncludeNodeTypes),
  };
}

function rowToWorkflowScheme(
  row: typeof workflowSchemes.$inferSelect
): WorkflowScheme {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    icon: row.icon,
    allowedTriggers: parseJsonArray<WorkflowTrigger>(row.allowedTriggers),
    allowedRuntimes: parseJsonArray<WorkflowRuntime>(row.allowedRuntimes),
    nodeRules: rowToNodeRules(row),
    isDefault: row.isDefault,
    isSystem: row.isSystem,
    sortOrder: row.sortOrder,
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy,
  };
}

function rowToPublicWorkflowScheme(
  row: typeof workflowSchemes.$inferSelect
): PublicWorkflowScheme {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    icon: row.icon,
    allowedTriggers: parseJsonArray<WorkflowTrigger>(row.allowedTriggers),
    allowedRuntimes: parseJsonArray<WorkflowRuntime>(row.allowedRuntimes),
    isDefault: row.isDefault,
  };
}

function isWorkflowTrigger(value: string): value is WorkflowTrigger {
  return (ALL_WORKFLOW_TRIGGERS as readonly string[]).includes(value);
}

function isWorkflowRuntime(value: string): value is WorkflowRuntime {
  return (ALL_WORKFLOW_RUNTIMES as readonly string[]).includes(value);
}

function normalizeTriggers(values: WorkflowTrigger[]): WorkflowTrigger[] {
  const unique = [...new Set(values)];
  if (unique.length === 0) {
    throw new Error("At least one trigger type is required");
  }
  for (const value of unique) {
    if (!isWorkflowTrigger(value)) {
      throw new Error(`Invalid trigger type: ${value}`);
    }
  }
  return unique;
}

function normalizeRuntimes(values: WorkflowRuntime[]): WorkflowRuntime[] {
  const unique = [...new Set(values)];
  if (unique.length === 0) {
    throw new Error("At least one execution mode is required");
  }
  for (const value of unique) {
    if (!isWorkflowRuntime(value)) {
      throw new Error(`Invalid execution mode: ${value}`);
    }
  }
  return unique;
}

function normalizeNodeRules(
  nodeRules: WorkflowSchemeNodeRules | undefined
): WorkflowSchemeNodeRules {
  return {
    includeTags: nodeRules?.includeTags ? [...new Set(nodeRules.includeTags)] : [],
    includeNodeTypes: nodeRules?.includeNodeTypes
      ? [...new Set(nodeRules.includeNodeTypes)]
      : [],
    excludeNodeTypes: nodeRules?.excludeNodeTypes
      ? [...new Set(nodeRules.excludeNodeTypes)]
      : [],
    alwaysIncludeNodeTypes: nodeRules?.alwaysIncludeNodeTypes
      ? [...new Set(nodeRules.alwaysIncludeNodeTypes)]
      : [],
  };
}

async function clearDefaultScheme(db: Database, exceptId?: string): Promise<void> {
  const conditions = [eq(workflowSchemes.isDefault, true)];
  if (exceptId) {
    conditions.push(ne(workflowSchemes.id, exceptId));
  }

  await db
    .update(workflowSchemes)
    .set({ isDefault: false, updatedAt: new Date() })
    .where(and(...conditions));
}

export async function listEnabledWorkflowSchemes(
  db: Database
): Promise<PublicWorkflowScheme[]> {
  const rows = await db
    .select()
    .from(workflowSchemes)
    .where(eq(workflowSchemes.enabled, true))
    .orderBy(asc(workflowSchemes.sortOrder), asc(workflowSchemes.name));

  return rows.map(rowToPublicWorkflowScheme);
}

export async function listWorkflowSchemes(db: Database): Promise<WorkflowScheme[]> {
  const rows = await db
    .select()
    .from(workflowSchemes)
    .orderBy(asc(workflowSchemes.sortOrder), asc(workflowSchemes.name));

  return rows.map(rowToWorkflowScheme);
}

export async function getWorkflowSchemeById(
  db: Database,
  id: string
): Promise<WorkflowScheme | null> {
  const [row] = await db
    .select()
    .from(workflowSchemes)
    .where(eq(workflowSchemes.id, id))
    .limit(1);

  return row ? rowToWorkflowScheme(row) : null;
}

export async function getEnabledWorkflowSchemeById(
  db: Database,
  id: string
): Promise<WorkflowScheme | null> {
  const [row] = await db
    .select()
    .from(workflowSchemes)
    .where(and(eq(workflowSchemes.id, id), eq(workflowSchemes.enabled, true)))
    .limit(1);

  return row ? rowToWorkflowScheme(row) : null;
}

export async function setDefaultWorkflowSchemeById(
  db: Database,
  id: string
): Promise<void> {
  const scheme = await getWorkflowSchemeById(db, id);
  if (!scheme || !scheme.enabled) {
    throw new Error("Scheme not found or disabled");
  }

  await clearDefaultScheme(db, id);
  await db
    .update(workflowSchemes)
    .set({ isDefault: true, updatedAt: new Date() })
    .where(eq(workflowSchemes.id, id));
}

export async function getDefaultWorkflowScheme(
  db: Database
): Promise<WorkflowScheme | null> {
  const [defaultRow] = await db
    .select()
    .from(workflowSchemes)
    .where(eq(workflowSchemes.isDefault, true))
    .limit(1);

  if (defaultRow) {
    return rowToWorkflowScheme(defaultRow);
  }

  return getWorkflowSchemeById(db, OMNIPOTENT_ID);
}

export async function createWorkflowScheme(
  db: Database,
  input: CreateWorkflowSchemeRequest,
  updatedBy: string
): Promise<WorkflowScheme> {
  const id = input.id.trim();
  if (!id) {
    throw new Error("Scheme id is required");
  }
  if (id === OMNIPOTENT_ID) {
    throw new Error("Reserved scheme id");
  }

  const allowedTriggers = normalizeTriggers(input.allowedTriggers);
  const allowedRuntimes = normalizeRuntimes(input.allowedRuntimes);
  const nodeRules = normalizeNodeRules(input.nodeRules);
  const now = new Date();

  const [row] = await db
    .insert(workflowSchemes)
    .values({
      id,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      icon: input.icon?.trim() || null,
      allowedTriggers: JSON.stringify(allowedTriggers),
      allowedRuntimes: JSON.stringify(allowedRuntimes),
      includeTags: serializeJsonArray(nodeRules.includeTags),
      includeNodeTypes: serializeJsonArray(nodeRules.includeNodeTypes),
      excludeNodeTypes: serializeJsonArray(nodeRules.excludeNodeTypes),
      alwaysIncludeNodeTypes: serializeJsonArray(nodeRules.alwaysIncludeNodeTypes),
      isDefault: false,
      isSystem: false,
      sortOrder: input.sortOrder ?? 0,
      enabled: input.enabled ?? true,
      updatedBy,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return rowToWorkflowScheme(row);
}

export async function updateWorkflowScheme(
  db: Database,
  id: string,
  input: UpdateWorkflowSchemeRequest,
  updatedBy: string
): Promise<WorkflowScheme> {
  const existing = await getWorkflowSchemeById(db, id);
  if (!existing) {
    throw new Error("Scheme not found");
  }

  if (input.isDefault === true) {
    await clearDefaultScheme(db, id);
  }

  const allowedTriggers =
    input.allowedTriggers !== undefined
      ? normalizeTriggers(input.allowedTriggers)
      : existing.allowedTriggers;
  const allowedRuntimes =
    input.allowedRuntimes !== undefined
      ? normalizeRuntimes(input.allowedRuntimes)
      : existing.allowedRuntimes;
  const nodeRules =
    input.nodeRules !== undefined
      ? normalizeNodeRules(input.nodeRules)
      : existing.nodeRules;

  const [row] = await db
    .update(workflowSchemes)
    .set({
      name: input.name?.trim() ?? existing.name,
      description:
        input.description !== undefined
          ? input.description?.trim() || null
          : existing.description,
      icon:
        input.icon !== undefined ? input.icon?.trim() || null : existing.icon,
      allowedTriggers: JSON.stringify(allowedTriggers),
      allowedRuntimes: JSON.stringify(allowedRuntimes),
      includeTags: serializeJsonArray(nodeRules.includeTags),
      includeNodeTypes: serializeJsonArray(nodeRules.includeNodeTypes),
      excludeNodeTypes: serializeJsonArray(nodeRules.excludeNodeTypes),
      alwaysIncludeNodeTypes: serializeJsonArray(nodeRules.alwaysIncludeNodeTypes),
      sortOrder: input.sortOrder ?? existing.sortOrder,
      enabled: input.enabled ?? existing.enabled,
      isDefault: input.isDefault ?? existing.isDefault,
      updatedBy,
      updatedAt: new Date(),
    })
    .where(eq(workflowSchemes.id, id))
    .returning();

  return rowToWorkflowScheme(row);
}

export async function deleteWorkflowScheme(
  db: Database,
  id: string
): Promise<void> {
  const existing = await getWorkflowSchemeById(db, id);
  if (!existing) {
    throw new Error("Scheme not found");
  }
  if (existing.isSystem) {
    throw new Error("System schemes cannot be deleted");
  }

  await db.delete(workflowSchemes).where(eq(workflowSchemes.id, id));
}
