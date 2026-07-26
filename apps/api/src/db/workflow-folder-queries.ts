import { and, count, desc, eq, isNull } from "drizzle-orm";

import type { Database } from "./index";
import {
  workflowFolders,
  workflows,
  type WorkflowFolderRow,
} from "./schema";

export async function listWorkflowFolders(
  db: Database,
  organizationId: string
): Promise<
  Array<
    WorkflowFolderRow & {
      workflowCount: number;
    }
  >
> {
  const rows = await db
    .select({
      id: workflowFolders.id,
      name: workflowFolders.name,
      organizationId: workflowFolders.organizationId,
      coverObjectId: workflowFolders.coverObjectId,
      coverMimeType: workflowFolders.coverMimeType,
      createdAt: workflowFolders.createdAt,
      updatedAt: workflowFolders.updatedAt,
      workflowCount: count(workflows.id),
    })
    .from(workflowFolders)
    .leftJoin(workflows, eq(workflows.folderId, workflowFolders.id))
    .where(eq(workflowFolders.organizationId, organizationId))
    .groupBy(workflowFolders.id)
    .orderBy(desc(workflowFolders.updatedAt));

  return rows.map((row) => ({
    ...row,
    workflowCount: Number(row.workflowCount),
  }));
}

export async function getWorkflowFolder(
  db: Database,
  folderId: string,
  organizationId: string
): Promise<(WorkflowFolderRow & { workflowCount: number }) | undefined> {
  const [row] = await db
    .select({
      id: workflowFolders.id,
      name: workflowFolders.name,
      organizationId: workflowFolders.organizationId,
      coverObjectId: workflowFolders.coverObjectId,
      coverMimeType: workflowFolders.coverMimeType,
      createdAt: workflowFolders.createdAt,
      updatedAt: workflowFolders.updatedAt,
      workflowCount: count(workflows.id),
    })
    .from(workflowFolders)
    .leftJoin(workflows, eq(workflows.folderId, workflowFolders.id))
    .where(
      and(
        eq(workflowFolders.id, folderId),
        eq(workflowFolders.organizationId, organizationId)
      )
    )
    .groupBy(workflowFolders.id)
    .limit(1);

  if (!row) {
    return undefined;
  }

  return {
    ...row,
    workflowCount: Number(row.workflowCount),
  };
}

export async function createWorkflowFolder(
  db: Database,
  input: {
    id: string;
    name: string;
    organizationId: string;
    createdAt: Date;
    updatedAt: Date;
  }
): Promise<WorkflowFolderRow> {
  const [row] = await db.insert(workflowFolders).values(input).returning();
  return row;
}

export async function updateWorkflowFolder(
  db: Database,
  folderId: string,
  organizationId: string,
  data: Partial<
    Pick<
      WorkflowFolderRow,
      "name" | "coverObjectId" | "coverMimeType" | "updatedAt"
    >
  >
): Promise<WorkflowFolderRow | undefined> {
  const [row] = await db
    .update(workflowFolders)
    .set(data)
    .where(
      and(
        eq(workflowFolders.id, folderId),
        eq(workflowFolders.organizationId, organizationId)
      )
    )
    .returning();
  return row;
}

export async function deleteWorkflowFolder(
  db: Database,
  folderId: string,
  organizationId: string
): Promise<WorkflowFolderRow | undefined> {
  const [row] = await db
    .delete(workflowFolders)
    .where(
      and(
        eq(workflowFolders.id, folderId),
        eq(workflowFolders.organizationId, organizationId)
      )
    )
    .returning();
  return row;
}

export async function listWorkflowIdsInFolder(
  db: Database,
  folderId: string,
  organizationId: string
): Promise<string[]> {
  const rows = await db
    .select({ id: workflows.id })
    .from(workflows)
    .where(
      and(
        eq(workflows.folderId, folderId),
        eq(workflows.organizationId, organizationId)
      )
    );
  return rows.map((row) => row.id);
}

export async function countRootWorkflows(
  db: Database,
  organizationId: string
): Promise<number> {
  const [row] = await db
    .select({ total: count(workflows.id) })
    .from(workflows)
    .where(
      and(
        eq(workflows.organizationId, organizationId),
        isNull(workflows.folderId)
      )
    );
  return Number(row?.total ?? 0);
}

export function folderToApi(
  row: WorkflowFolderRow & { workflowCount: number }
) {
  return {
    id: row.id,
    name: row.name,
    coverObjectId: row.coverObjectId,
    coverMimeType: row.coverMimeType,
    workflowCount: row.workflowCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function touchWorkflowFolderUpdatedAt(
  db: Database,
  folderId: string,
  organizationId: string
): Promise<void> {
  await db
    .update(workflowFolders)
    .set({ updatedAt: new Date() })
    .where(
      and(
        eq(workflowFolders.id, folderId),
        eq(workflowFolders.organizationId, organizationId)
      )
    );
}
