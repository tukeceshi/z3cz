import type {
  AddCharacterLibraryCharacterItemRequest,
  AddCharacterLibraryRequest,
  CharacterLibraryStatusResponse,
  CreateCharacterLibraryCharacterRequest,
  ListCharacterLibraryResponse,
  ListPublicCharacterLibraryResponse,
} from "@dafthunk/types";
import { isSingleModelProviderMetadata } from "@dafthunk/types";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { jwtMiddleware } from "../auth";
import type { ApiContext } from "../context";
import { createDatabase } from "../db";
import { getOrganizationAiInterfaceRow } from "../db/ai-interface-queries";
import {
  addCharacterLibraryCharacterItem,
  addCharacterLibraryEntry,
  createCharacterLibraryCharacter,
  deleteCharacterLibraryCharacter,
  listCharacterLibraryCharacters,
  listCharacterLibraryEntries,
  removeCharacterLibraryCharacterItem,
  removeCharacterLibraryEntry,
} from "../db/character-library-queries";
import {
  isVolcanoMetadata,
  parseInterfaceMetadata,
} from "../integrations/volcengine/metadata";
import { requireModelCallsAccess } from "../middleware/org-permissions";
import { createRequireFeatureMiddleware } from "../middleware/require-feature";
import {
  importCharacterResourceToVolcano,
  refreshCharacterResourceImportStatus,
} from "../services/character-library-import-service";
import { fetchPublicCharacterLibrary } from "../services/fetch-public-character-library";

const characterLibraryRoutes = new Hono<ApiContext>();

characterLibraryRoutes.use("*", jwtMiddleware);
characterLibraryRoutes.use("*", requireModelCallsAccess());
characterLibraryRoutes.use(
  "*",
  createRequireFeatureMiddleware("ai-interfaces")
);

const addCharacterSchema = z.object({
  resourceId: z.string().min(1),
  modelCanonicalId: z.string().min(1).optional(),
  interfaceId: z.string().min(1).optional(),
  workflowId: z.string().min(1).optional(),
  category: z.enum(["image", "video", "audio"]).optional(),
});

const createCharacterSchema = z.object({
  name: z.string().trim().min(1).max(80),
  workflowId: z.string().min(1).optional(),
});

const addCharacterItemSchema = z.object({
  resourceId: z.string().min(1),
});

characterLibraryRoutes.get("/", async (c) => {
  const organizationId = c.get("organizationId")!;
  const interfaceId = c.req.query("interfaceId");
  const db = createDatabase(c.env);

  const [entries, characters] = await Promise.all([
    listCharacterLibraryEntries(db, {
      organizationId,
      interfaceId,
    }),
    listCharacterLibraryCharacters(db, { organizationId }),
  ]);

  let groupId: string | null = null;
  if (interfaceId?.trim()) {
    const row = await getOrganizationAiInterfaceRow(
      db,
      organizationId,
      interfaceId.trim()
    );
    if (row?.metadata) {
      try {
        const metadata = JSON.parse(row.metadata) as Record<string, unknown>;
        const value = metadata["characterLibraryAssetGroupId"];
        if (typeof value === "string" && value) {
          groupId = value;
        }
      } catch {
        groupId = null;
      }
    }
  }

  const response: ListCharacterLibraryResponse = {
    entries,
    characters,
    groupId,
  };
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
      } else if (isVolcanoMetadata(metadata)) {
        enabled = metadata.supportsCharacterLibrary === true;
      }
    }
  }

  const response: CharacterLibraryStatusResponse = { enabled };
  return c.json(response);
});

characterLibraryRoutes.get("/public", async (c) => {
  const organizationId = c.get("organizationId")!;
  const db = createDatabase(c.env);
  const pageNum = Math.max(1, Number(c.req.query("page") ?? "1") || 1);
  const ageMin = Number(c.req.query("ageMin"));
  const ageMax = Number(c.req.query("ageMax"));
  try {
    const result = await fetchPublicCharacterLibrary({
      env: c.env,
      db,
      organizationId,
      interfaceId: c.req.query("interfaceId")?.trim() || undefined,
      query: c.req.query("q")?.trim() || undefined,
      gender: c.req.query("gender")?.trim() || undefined,
      country: c.req.query("country")?.trim() || undefined,
      ageMin: Number.isFinite(ageMin) ? ageMin : undefined,
      ageMax: Number.isFinite(ageMax) ? ageMax : undefined,
      pageNum,
    });
    const response: ListPublicCharacterLibraryResponse = {
      groups: result.groups,
      total: result.total,
      offset: (pageNum - 1) * result.pageSize,
      limit: result.pageSize,
    };
    return c.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "加载失败";
    return c.json({ error: message }, 400);
  }
});

characterLibraryRoutes.post(
  "/",
  zValidator("json", addCharacterSchema),
  async (c) => {
    const organizationId = c.get("organizationId")!;
    const body = c.req.valid("json") satisfies AddCharacterLibraryRequest;
    const db = createDatabase(c.env);

    const result = await addCharacterLibraryEntry(db, {
      organizationId,
      resourceId: body.resourceId,
      modelCanonicalId: body.modelCanonicalId,
      interfaceId: body.interfaceId,
      workflowId: body.workflowId,
      category: body.category,
    });
    if (!result.ok) {
      if (result.reason === "not_found") {
        return c.json({ error: "Resource not found" }, 404);
      }
      return c.json(
        { error: "Resource type is not image, video, or audio" },
        400
      );
    }
    return c.json({ entry: result.entry });
  }
);

characterLibraryRoutes.post(
  "/characters",
  zValidator("json", createCharacterSchema),
  async (c) => {
    const organizationId = c.get("organizationId")!;
    const body = c.req.valid(
      "json"
    ) satisfies CreateCharacterLibraryCharacterRequest;
    const db = createDatabase(c.env);
    const character = await createCharacterLibraryCharacter(db, {
      organizationId,
      name: body.name,
      workflowId: body.workflowId,
    });
    if (!character) {
      return c.json({ error: "Name is required" }, 400);
    }
    return c.json({ character });
  }
);

characterLibraryRoutes.delete("/characters/:characterId", async (c) => {
  const organizationId = c.get("organizationId")!;
  const characterId = c.req.param("characterId");
  const db = createDatabase(c.env);
  const removed = await deleteCharacterLibraryCharacter(db, {
    organizationId,
    characterId,
  });
  if (!removed) {
    return c.json({ error: "Character not found" }, 404);
  }
  return c.json({ removed: true });
});

characterLibraryRoutes.post(
  "/characters/:characterId/items",
  zValidator("json", addCharacterItemSchema),
  async (c) => {
    const organizationId = c.get("organizationId")!;
    const characterId = c.req.param("characterId");
    const body = c.req.valid(
      "json"
    ) satisfies AddCharacterLibraryCharacterItemRequest;
    const db = createDatabase(c.env);
    const character = await addCharacterLibraryCharacterItem(db, {
      organizationId,
      characterId,
      resourceId: body.resourceId,
    });
    if (!character) {
      return c.json({ error: "Character or resource not found" }, 404);
    }
    return c.json({ character });
  }
);

characterLibraryRoutes.delete(
  "/characters/:characterId/items/:resourceId",
  async (c) => {
    const organizationId = c.get("organizationId")!;
    const characterId = c.req.param("characterId");
    const resourceId = c.req.param("resourceId");
    const db = createDatabase(c.env);
    const removed = await removeCharacterLibraryCharacterItem(db, {
      organizationId,
      characterId,
      resourceId,
    });
    if (!removed) {
      return c.json({ error: "Character item not found" }, 404);
    }
    return c.json({ removed: true });
  }
);

characterLibraryRoutes.post("/:resourceId/import", async (c) => {
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
});

characterLibraryRoutes.get("/:resourceId/import-status", async (c) => {
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
      error instanceof Error ? error.message : "Failed to fetch import status";
    return c.json({ error: message }, 400);
  }
});

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
