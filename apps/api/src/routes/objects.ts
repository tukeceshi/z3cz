import type {
  DeleteObjectResponse,
  GetObjectMetadataResponse,
  ListObjectsResponse,
  ObjectMetadata,
  ObjectReference,
  UploadObjectResponse,
} from "@dafthunk/types";
import { Hono } from "hono";

import { apiKeyOrJwtMiddleware, jwtMiddleware } from "../auth";
import type { ApiContext } from "../context";
import { createDatabase } from "../db";
import { VolcengineTosClient } from "../integrations/volcengine/tos-client";
import { requireOrganizationOwner } from "../middleware/org-permissions";
import { CloudflareObjectStore } from "../runtime/cloudflare-object-store";
import { resolveOrgCloudStorage } from "../services/resolve-org-cloud-storage";
import { decryptSecret } from "../utils/encryption";

const objectRoutes = new Hono<ApiContext>();

const STORAGE_KEY_PATTERN = /^[a-zA-Z0-9_\-/.]+$/;

function storageKeyBelongsToOrgPrefix(
  storageKey: string,
  prefix: string
): boolean {
  const normalized = prefix.trim().replace(/\/$/, "");
  if (normalized.length === 0) return true;
  return storageKey === normalized || storageKey.startsWith(`${normalized}/`);
}

objectRoutes.get("/cloud", apiKeyOrJwtMiddleware, requireOrganizationOwner(), async (c) => {
  const storageKey = c.req.query("storageKey");
  const mimeType = c.req.query("mimeType");

  if (!storageKey || !mimeType) {
    return c.json(
      { error: "Missing required parameters: storageKey and mimeType" },
      400
    );
  }

  if (!STORAGE_KEY_PATTERN.test(storageKey)) {
    return c.json({ error: "Invalid storage key" }, 400);
  }

  const organizationId = c.get("organizationId")!;

  try {
    const db = createDatabase(c.env);
    const cloud = await resolveOrgCloudStorage(db, organizationId);
    if (!cloud) {
      return c.json({ error: "Cloud storage is not configured" }, 404);
    }

    if (!storageKeyBelongsToOrgPrefix(storageKey, cloud.tosStorage.prefix)) {
      return c.json({ error: "Forbidden: invalid storage key" }, 403);
    }

    const secretAccessKey = await decryptSecret(
      cloud.secretAccessKeyEncrypted,
      c.env,
      organizationId
    );

    const tosClient = new VolcengineTosClient({
      accessKeyId: cloud.accessKeyId,
      secretAccessKey,
      region: cloud.tosStorage.region,
      bucket: cloud.tosStorage.bucket,
    });

    const result = await tosClient.getObject({ key: storageKey });

    return new Response(result.data, {
      headers: {
        "content-type": mimeType,
        "Cache-Control": "public, max-age=3600",
        "Content-Disposition": `attachment; filename="cloud-${storageKey.split("/").pop() ?? "object"}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Cloud object retrieval error:", error);
    return c.json({ error: "Object not found or error retrieving object" }, 404);
  }
});

// organizationId is guaranteed by jwtMiddleware / apiKeyOrJwtMiddleware,
// so route handlers use c.get("organizationId")! without null checks.

objectRoutes.get("/", apiKeyOrJwtMiddleware, requireOrganizationOwner(), async (c) => {
  const objectId = c.req.query("id");
  const mimeType = c.req.query("mimeType");

  if (!objectId || !mimeType) {
    return c.json(
      { error: "Missing required parameters: id and mimeType" },
      400
    );
  }

  // Defends against header injection now that `id` is interpolated into
  // Content-Disposition; matches the admin objects route's validation.
  if (!/^[a-zA-Z0-9_-]+$/.test(objectId)) {
    return c.json({ error: "Invalid object id" }, 400);
  }

  const organizationId = c.get("organizationId")!;

  try {
    const objectStore = new CloudflareObjectStore(c.env.RESSOURCES);
    const reference: ObjectReference = { id: objectId, mimeType };
    const result = await objectStore.readObject(reference);

    if (!result) {
      return c.json({ error: "Object not found" }, 404);
    }

    const { data, metadata } = result;

    if (metadata?.organizationId !== organizationId) {
      return c.json(
        { error: "Forbidden: You do not have access to this object" },
        403
      );
    }

    // Security: this route serves R2 blobs on the API origin, which shares
    // the JWT cookie domain with the web origin. A user can upload HTML
    // via POST /:orgId/objects (multipart file.type is trusted) and send
    // the URL to a teammate or to a system admin who is also a member.
    // Without these headers, top-level navigation renders the attacker's
    // HTML at api.dafthunk.com with the victim's cookies attached.
    //
    // `Content-Disposition: attachment` forces top-level navigations to
    // download (img/audio/video tags ignore it, so the workflow viewer's
    // inline previews still work). `X-Content-Type-Options: nosniff`
    // blocks browser MIME sniffing.
    return new Response(data, {
      headers: {
        "content-type": mimeType,
        "Cache-Control": "public, max-age=31536000",
        "Content-Disposition": `attachment; filename="object-${objectId}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Object retrieval error:", error);
    if (error instanceof Error && error.message.startsWith("Forbidden")) {
      return c.json({ error: error.message }, 403);
    }
    return c.json(
      { error: "Object not found or error retrieving object" },
      404
    );
  }
});

objectRoutes.post("/", jwtMiddleware, requireOrganizationOwner(), async (c) => {
  const contentType = c.req.header("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return c.json({ error: "Content type must be multipart/form-data" }, 400);
  }

  const body = await c.req.parseBody();
  const file = body.file;

  if (!file || !(file instanceof File)) {
    return c.json({ error: "No file provided or invalid file" }, 400);
  }

  const organizationId = c.get("organizationId")!;

  try {
    const objectStore = new CloudflareObjectStore(c.env.RESSOURCES);
    const buffer = await file.arrayBuffer();
    const data = new Uint8Array(buffer);
    const reference = await objectStore.writeObject(
      data,
      file.type || "application/octet-stream",
      organizationId
    );

    const response: UploadObjectResponse = { reference };
    return c.json(response);
  } catch (error) {
    console.error("Object storage error:", error);
    return c.json({ error: "Error storing object" }, 500);
  }
});

objectRoutes.delete("/:id", jwtMiddleware, requireOrganizationOwner(), async (c) => {
  const objectId = c.req.param("id");
  const mimeType = c.req.query("mimeType");

  if (!objectId || !mimeType) {
    return c.json(
      { error: "Missing required parameters: id and mimeType" },
      400
    );
  }

  const organizationId = c.get("organizationId")!;

  try {
    const objectStore = new CloudflareObjectStore(c.env.RESSOURCES);
    const reference: ObjectReference = { id: objectId, mimeType };

    const result = await objectStore.readObject(reference);

    if (!result) {
      return c.json({ error: "Object not found" }, 404);
    }

    const { metadata } = result;

    if (metadata?.organizationId !== organizationId) {
      return c.json(
        { error: "Forbidden: You do not have access to delete this object" },
        403
      );
    }

    await objectStore.deleteObject(reference);

    const response: DeleteObjectResponse = { success: true };
    return c.json(response);
  } catch (error) {
    console.error("Object deletion error:", error);
    return c.json({ error: "Error deleting object" }, 500);
  }
});

objectRoutes.get("/metadata/:id", jwtMiddleware, requireOrganizationOwner(), async (c) => {
  const objectId = c.req.param("id");
  const mimeType = c.req.query("mimeType");

  if (!objectId || !mimeType) {
    return c.json(
      { error: "Missing required parameters: id and mimeType" },
      400
    );
  }

  const organizationId = c.get("organizationId")!;

  try {
    const objectStore = new CloudflareObjectStore(c.env.RESSOURCES);
    const reference: ObjectReference = { id: objectId, mimeType };

    const result = await objectStore.readObject(reference);

    if (!result) {
      return c.json({ error: "Object not found" }, 404);
    }

    const { metadata } = result;

    if (metadata?.organizationId !== organizationId) {
      return c.json(
        {
          error: "Forbidden: You do not have access to this object's metadata",
        },
        403
      );
    }

    const objectMetadata: ObjectMetadata = {
      id: objectId,
      mimeType,
      size: result.data.length,
      createdAt: metadata?.createdAt
        ? new Date(metadata.createdAt)
        : new Date(),
      organizationId: metadata?.organizationId || "",
      executionId: metadata?.executionId,
    };

    const response: GetObjectMetadataResponse = { metadata: objectMetadata };
    return c.json(response);
  } catch (error) {
    console.error("Object metadata retrieval error:", error);
    return c.json({ error: "Error retrieving object metadata" }, 500);
  }
});

objectRoutes.get("/list", jwtMiddleware, requireOrganizationOwner(), async (c) => {
  const organizationId = c.get("organizationId")!;

  try {
    const objectStore = new CloudflareObjectStore(c.env.RESSOURCES);
    const objectList = await objectStore.listObjects(organizationId);

    const response: ListObjectsResponse = { objects: objectList };
    return c.json(response);
  } catch (error) {
    console.error("Object listing error:", error);
    return c.json({ error: "Error listing objects" }, 500);
  }
});

export default objectRoutes;
