import type { UpdateLegalDocumentsRequest } from "@dafthunk/types";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { ApiContext } from "../../context";
import {
  createDatabase,
  getAdminLegalDocumentsConfig,
  updateLegalDocumentsConfig,
} from "../../db";

const adminLegalDocumentsRoutes = new Hono<ApiContext>();

const legalDocumentSchema = z.object({
  title: z.string().trim().min(1).max(200),
  effectiveDate: z.string().trim().min(1).max(40),
  body: z.string().min(1),
});

const localizedDocumentSchema = z.object({
  en: legalDocumentSchema,
  zh: legalDocumentSchema,
});

const updateLegalDocumentsSchema = z.object({
  legalConfig: z.object({
    terms: localizedDocumentSchema,
    privacy: localizedDocumentSchema,
  }),
});

adminLegalDocumentsRoutes.get("/", async (c) => {
  const db = createDatabase(c.env);

  try {
    const config = await getAdminLegalDocumentsConfig(db);
    return c.json(config);
  } catch (error) {
    console.error("Error fetching legal documents config:", error);
    return c.json({ error: "Failed to fetch legal documents" }, 500);
  }
});

adminLegalDocumentsRoutes.patch(
  "/",
  zValidator("json", updateLegalDocumentsSchema),
  async (c) => {
    const jwtPayload = c.get("jwtPayload");
    if (!jwtPayload) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const body = c.req.valid("json");
    const db = createDatabase(c.env);
    const input: UpdateLegalDocumentsRequest = body;

    try {
      const config = await updateLegalDocumentsConfig(
        db,
        input,
        jwtPayload.sub
      );
      return c.json(config);
    } catch (error) {
      console.error("Error updating legal documents:", error);
      return c.json({ error: "Failed to update legal documents" }, 500);
    }
  }
);

export default adminLegalDocumentsRoutes;
