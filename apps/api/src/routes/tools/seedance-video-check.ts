import type {
  GetSeedanceVideoCheckResultResponse,
  SeedanceVideoCheckErrorResponse,
  SubmitSeedanceVideoCheckRequest,
  SubmitSeedanceVideoCheckResponse,
} from "@dafthunk/types";
import { SEEDANCE_VIDEO_CHECK_VOLCANO_REQUIRED_CODE } from "@dafthunk/types";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { jwtMiddleware } from "../../auth";
import type { ApiContext, Bindings } from "../../context";
import { createDatabase } from "../../db";
import { getVolcanoInterfaceRowForOrganization } from "../../db/ai-interface-queries";
import {
  createSeedanceVideoCheckQuery,
  getSeedanceVideoCheckResult,
  SeedanceOfficialResultCallError,
} from "../../integrations/volcengine/ark-official-result";
import { VolcengineApiRequestError } from "../../integrations/volcengine/client";
import { getVolcanoCredentials } from "../../integrations/volcengine/ensure-api-key";
import { createRequireFeatureMiddleware } from "../../middleware/require-feature";
import { requireWorkflowView } from "../../middleware/org-permissions";
import { resolveSeedanceCheckVideoUrl } from "../../services/resolve-seedance-check-video-url";

const objectReferenceSchema = z.object({
  id: z.string().min(1),
  mimeType: z.string().min(1),
  storageKey: z.string().min(1),
  storageBackend: z.literal("volcengine_tos"),
});

const submitBodySchema = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("url"),
    url: z
      .string()
      .trim()
      .min(1)
      .refine((value) => /^https?:\/\//i.test(value), {
        message: "Video URL must start with http:// or https://",
      }),
  }),
  z.object({
    source: z.literal("resource"),
    resourceId: z.string().min(1),
  }),
  z.object({
    source: z.literal("object"),
    object: objectReferenceSchema,
  }),
]);

const seedanceVideoCheckRoutes = new Hono<ApiContext>();

seedanceVideoCheckRoutes.use("*", jwtMiddleware);
seedanceVideoCheckRoutes.use("*", requireWorkflowView());
seedanceVideoCheckRoutes.use("*", createRequireFeatureMiddleware("ai-interfaces"));

async function resolveVolcanoCredentialsForOrg(
  env: Bindings,
  organizationId: string
) {
  const db = createDatabase(env);
  const row = await getVolcanoInterfaceRowForOrganization(db, organizationId);
  if (!row) return null;
  return getVolcanoCredentials(env, organizationId, row.metadata);
}

function formatSeedanceCheckError(error: unknown): SeedanceVideoCheckErrorResponse {
  if (error instanceof SeedanceOfficialResultCallError) {
    return {
      error: error.message,
      name: error.name,
      stack: error.stack,
      volcanoCode: error.volcanoCode,
      details: {
        type: error.name,
        code: error.volcanoCode,
        message: error.message,
      },
      log: error.log,
    };
  }

  if (error instanceof VolcengineApiRequestError) {
    return {
      error: error.message,
      name: error.name,
      stack: error.stack,
      volcanoCode: error.code,
      details: {
        type: "VolcengineApiRequestError",
        code: error.code,
        message: error.message,
      },
    };
  }

  if (error instanceof Error) {
    return {
      error: error.message,
      name: error.name,
      stack: error.stack,
      details: {
        type: error.name,
        message: error.message,
      },
    };
  }

  return {
    error: "Seedance video check failed",
    details: error,
  };
}

seedanceVideoCheckRoutes.post(
  "/submit",
  zValidator("json", submitBodySchema),
  async (c) => {
    const organizationId = c.get("organizationId")!;

    try {
      const body = c.req.valid("json") satisfies SubmitSeedanceVideoCheckRequest;
      const credentials = await resolveVolcanoCredentialsForOrg(c.env, organizationId);
      if (!credentials) {
        return c.json(
          {
            error: "Configure a Volcano Engine AI interface before using this tool",
            code: SEEDANCE_VIDEO_CHECK_VOLCANO_REQUIRED_CODE,
          } satisfies SeedanceVideoCheckErrorResponse,
          400
        );
      }

      const videoUrl = await resolveSeedanceCheckVideoUrl({
        env: c.env,
        organizationId,
        source: body.source,
        url: "url" in body ? body.url : undefined,
        resourceId: "resourceId" in body ? body.resourceId : undefined,
        object: "object" in body ? body.object : undefined,
      });

      const created = await createSeedanceVideoCheckQuery({
        credentials,
        videoUrl,
      });
      console.log(
        "[seedance-video-check] CreateArkOfficialResultQuery",
        JSON.stringify(created.log)
      );

      return c.json({
        queryId: created.queryId,
        log: created.log,
      } satisfies SubmitSeedanceVideoCheckResponse);
    } catch (error) {
      console.error("Seedance video check submit failed:", error);
      const payload = formatSeedanceCheckError(error);
      if (payload.log) {
        console.log(
          "[seedance-video-check] CreateArkOfficialResultQuery",
          JSON.stringify(payload.log)
        );
      }
      return c.json(payload, 400);
    }
  }
);

seedanceVideoCheckRoutes.get("/result", async (c) => {
  const organizationId = c.get("organizationId")!;
  const queryId = c.req.query("queryId")?.trim();
  if (!queryId) {
    return c.json({ error: "queryId is required" } satisfies SeedanceVideoCheckErrorResponse, 400);
  }

  try {
    const credentials = await resolveVolcanoCredentialsForOrg(c.env, organizationId);
    if (!credentials) {
      return c.json(
        {
          error: "Configure a Volcano Engine AI interface before using this tool",
          code: SEEDANCE_VIDEO_CHECK_VOLCANO_REQUIRED_CODE,
        } satisfies SeedanceVideoCheckErrorResponse,
        400
      );
    }

    const result = await getSeedanceVideoCheckResult({
      credentials,
      queryId,
    });
    console.log(
      "[seedance-video-check] GetArkOfficialResult",
      JSON.stringify(result.log)
    );

    return c.json({
      status: result.status,
      isOfficial: result.isOfficial,
      modelVersion: result.modelVersion,
      resolution: result.resolution,
      message: result.message,
      raw: result.raw,
      log: result.log,
    } satisfies GetSeedanceVideoCheckResultResponse);
  } catch (error) {
    console.error("Seedance video check result failed:", error);
    const payload = formatSeedanceCheckError(error);
    if (payload.log) {
      console.log(
        "[seedance-video-check] GetArkOfficialResult",
        JSON.stringify(payload.log)
      );
    }
    return c.json(payload, 400);
  }
});

export default seedanceVideoCheckRoutes;
