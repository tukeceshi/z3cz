import type {
  AddCharacterLibraryRequest,
  CharacterLibraryStatusResponse,
  ListCharacterLibraryResponse,
} from "@dafthunk/types";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { jwtMiddleware } from "../auth";
import type { ApiContext } from "../context";
import { createDatabase } from "../db";
import { getOrganizationAiInterfaceRow } from "../db/ai-interface-queries";
import {
  addCharacterLibraryEntry,
  listCharacterLibraryEntries,
  removeCharacterLibraryEntry,
} from "../db/character-library-queries";
import { requireModelCallsAccess } from "../middleware/org-permissions";
import { createRequireFeatureMiddleware } from "../middleware/require-feature";
import { isSingleModelProviderMetadata } from "@dafthunk/types";
import { parseInterfaceMetadata } from "../integrations/volcengine/metadata";
import {
  importCharacterResourceToVolcano,
  refreshCharacterResourceImportStatus,
} from "../services/character-library-import-service";

const characterLibraryRoutes = new Hono<ApiContext>();

characterLibraryRoutes.use("*", jwtMiddleware);
characterLibraryRoutes.use("*", requireModelCallsAccess());
characterLibraryRoutes.use("*", createRequireFeatureMiddleware("ai-interfaces"));

const addCharacterSchema = z.object({
  resourceId: z.string().min(1),
  modelCanonicalId: z.string().min(1).optional(),
  interfaceId: z.string().min(1).optional(),
});

characterLibraryRoutes.get("/", async (c) => {
  const organizationId = c.get("organizationId")!;
  const interfaceId = c.req.query("interfaceId");
  const db = createDatabase(c.env);

  const entries = await listCharacterLibraryEntries(db, {
    organizationId,
    interfaceId,
  });
  const response: ListCharacterLibraryResponse = { entries };
  return c.json(response);
});

characterLibraryRoutes.get("/status", async (c) => {
  const organizationId = c.get("organizationId")!;
  const interfaceId = c.req.query("interfaceId")?.trim();
  const db = createDatabase(c.env);

  let enabled = false;
  if (interfaceId) {
    const row = await getOrganizationAiInterfaceRow(
      db,
      organizationId,
      interfaceId
    );
    if (row) {
      const metadata = parseInterfaceMetadata(row.metadata);
      if (isSingleModelProviderMetadata(metadata)) {
        enabled = metadata.supportsCharacterLibrary === true;
      }
    }
  }

  const response: CharacterLibraryStatusResponse = { enabled };
  return c.json(response);
});

characterLibraryRoutes.post(
  "/",
  zValidator("json", addCharacterSchema),
  async (c) => {
    const organizationId = c.get("organizationId")!;
    const body = c.req.valid("json") satisfies AddCharacterLibraryRequest;
    const db = createDatabase(c.env);

    const entry = await addCharacterLibraryEntry(db, {
      organizationId,
      resourceId: body.resourceId,
      modelCanonicalId: body.modelCanonicalId,
      interfaceId: body.interfaceId,
    });
    if (!entry) {
      return c.json({ error: "Resource not found" }, 404);
    }
    return c.json({ entry });
  }
);

characterLibraryRoutes.post(
  "/:resourceId/import",
  async (c) => {
    const organizationId = c.get("organizationId")!;
    const resourceId = c.req.param("resourceId");
    const db = createDatabase(c.env);

    try {
      const entry = await importCharacterResourceToVolcano(c.env, db, {
        organizationId,
        resourceId,
      });
      return c.json({ entry });
    } catch (error) {
      console.error(
        `[character-library] import failed for ${resourceId}:`,
        error
      );
      const message =
        error instanceof Error
          ? error.message
          : "Failed to import character resource";
      return c.json({ error: message }, 400);
    }
  }
);

characterLibraryRoutes.get(
  "/:resourceId/import-status",
  async (c) => {
    const organizationId = c.get("organizationId")!;
    const resourceId = c.req.param("resourceId");
    const db = createDatabase(c.env);

    try {
      const result = await refreshCharacterResourceImportStatus(c.env, db, {
        organizationId,
        resourceId,
      });
      return c.json(result);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to fetch import status";
      return c.json({ error: message }, 400);
    }
  }
);

characterLibraryRoutes.delete("/:resourceId", async (c) => {
  const organizationId = c.get("organizationId")!;
  const resourceId = c.req.param("resourceId");
  const db = createDatabase(c.env);

  const removed = await removeCharacterLibraryEntry(db, {
    organizationId,
    resourceId,
  });
  if (!removed) {
    return c.json({ error: "Character library entry not found" }, 404);
  }
  return c.json({ removed: true });
});

export default characterLibraryRoutes;
