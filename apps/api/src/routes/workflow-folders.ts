import type {
  CreateWorkflowFolderRequest,
  CreateWorkflowFolderResponse,
  DeleteWorkflowFolderResponse,
  ListWorkflowFoldersResponse,
  UpdateWorkflowFolderRequest,
  UpdateWorkflowFolderResponse,
} from "@dafthunk/types";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { v7 as uuid } from "uuid";
import { z } from "zod";

import { jwtMiddleware } from "../auth";
import type { ApiContext } from "../context";
import { createDatabase } from "../db";
import {
  createWorkflowFolder,
  deleteWorkflowFolder,
  folderToApi,
  getWorkflowFolder,
  listWorkflowFolders,
  listWorkflowIdsInFolder,
  updateWorkflowFolder,
} from "../db/workflow-folder-queries";
import { requireWorkflowRouteAccess } from "../middleware/org-permissions";
import { assertOrgCloudStorageConfigured } from "../services/assert-org-cloud-storage-configured";
import { WorkflowStore } from "../stores/workflow-store";

const workflowFolderRoutes = new Hono<ApiContext>();

workflowFolderRoutes.use("*", jwtMiddleware);
workflowFolderRoutes.use("*", requireWorkflowRouteAccess());

const coverSchema = z.object({
  coverObjectId: z.string().min(1).nullable(),
  coverMimeType: z.string().min(1).nullable(),
});

workflowFolderRoutes.get("/", async (c) => {
  const organizationId = c.get("organizationId")!;
  const db = createDatabase(c.env);
  const folders = await listWorkflowFolders(db, organizationId);
  const response: ListWorkflowFoldersResponse = {
    folders: folders.map(folderToApi),
  };
  return c.json(response);
});

workflowFolderRoutes.get("/:folderId", async (c) => {
  const organizationId = c.get("organizationId")!;
  const folderId = c.req.param("folderId")!;
  const db = createDatabase(c.env);
  const folder = await getWorkflowFolder(db, folderId, organizationId);
  if (!folder) {
    return c.json({ error: "Folder not found" }, 404);
  }
  return c.json(folderToApi(folder));
});

workflowFolderRoutes.post(
  "/",
  zValidator(
    "json",
    z.object({
      name: z.string().min(1),
    }) as z.ZodType<CreateWorkflowFolderRequest>
  ),
  async (c) => {
    const organizationId = c.get("organizationId")!;
    const { name } = c.req.valid("json");
    const now = new Date();
    const db = createDatabase(c.env);

    const row = await createWorkflowFolder(db, {
      id: uuid(),
      name,
      organizationId,
      createdAt: now,
      updatedAt: now,
    });

    const response: CreateWorkflowFolderResponse = folderToApi({
      ...row,
      workflowCount: 0,
    });
    return c.json(response, 201);
  }
);

workflowFolderRoutes.patch(
  "/:folderId",
  zValidator(
    "json",
    z
      .object({
        name: z.string().min(1).optional(),
        coverObjectId: z.string().min(1).nullable().optional(),
        coverMimeType: z.string().min(1).nullable().optional(),
      })
      .refine(
        (value) =>
          value.name !== undefined ||
          value.coverObjectId !== undefined ||
          value.coverMimeType !== undefined,
        { message: "At least one field is required" }
      ) as z.ZodType<UpdateWorkflowFolderRequest>
  ),
  async (c) => {
    const organizationId = c.get("organizationId")!;
    const folderId = c.req.param("folderId")!;
    const data = c.req.valid("json");
    const db = createDatabase(c.env);

    if (
      data.coverObjectId !== undefined ||
      data.coverMimeType !== undefined
    ) {
      const hasCover =
        data.coverObjectId !== null && data.coverMimeType !== null;
      const clearingCover =
        data.coverObjectId === null && data.coverMimeType === null;
      if (hasCover || clearingCover) {
        const cloudCheck = await assertOrgCloudStorageConfigured(
          c,
          organizationId
        );
        if (!cloudCheck.ok) {
          return cloudCheck.response;
        }
      }
      if (hasCover && (!data.coverObjectId || !data.coverMimeType)) {
        return c.json({ error: "Cover requires object id and mime type" }, 400);
      }
    }

    const updated = await updateWorkflowFolder(db, folderId, organizationId, {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.coverObjectId !== undefined
        ? { coverObjectId: data.coverObjectId }
        : {}),
      ...(data.coverMimeType !== undefined
        ? { coverMimeType: data.coverMimeType }
        : {}),
      updatedAt: new Date(),
    });

    if (!updated) {
      return c.json({ error: "Folder not found" }, 404);
    }

    const folder = await getWorkflowFolder(db, folderId, organizationId);
    const response: UpdateWorkflowFolderResponse = folderToApi(
      folder ?? { ...updated, workflowCount: 0 }
    );
    return c.json(response);
  }
);

workflowFolderRoutes.delete("/:folderId", async (c) => {
  const organizationId = c.get("organizationId")!;
  const folderId = c.req.param("folderId")!;
  const db = createDatabase(c.env);
  const workflowStore = new WorkflowStore(c.env);

  const folder = await getWorkflowFolder(db, folderId, organizationId);
  if (!folder) {
    return c.json({ error: "Folder not found" }, 404);
  }

  const workflowIds = await listWorkflowIdsInFolder(
    db,
    folderId,
    organizationId
  );

  for (const workflowId of workflowIds) {
    await workflowStore.delete(workflowId, organizationId);
  }

  await deleteWorkflowFolder(db, folderId, organizationId);

  const response: DeleteWorkflowFolderResponse = {
    id: folderId,
    deletedWorkflowCount: workflowIds.length,
  };
  return c.json(response);
});

export default workflowFolderRoutes;
