import type { AppLocale, PublicLegalDocumentResponse } from "@dafthunk/types";
import { APP_LOCALES } from "@dafthunk/types";
import { Hono } from "hono";

import { ApiContext } from "../context";
import { createDatabase, getPublicLegalDocument } from "../db";
import {
  isAppLocale,
  isLegalDocumentType,
} from "../services/legal-documents";

const legalDocumentsRoutes = new Hono<ApiContext>();

legalDocumentsRoutes.get("/:type", async (c) => {
  const typeParam = c.req.param("type");
  if (!isLegalDocumentType(typeParam)) {
    return c.json({ error: "Invalid document type" }, 400);
  }

  const localeParam = c.req.query("locale") ?? "en";
  const locale: AppLocale = isAppLocale(localeParam) ? localeParam : "en";

  const db = createDatabase(c.env);

  try {
    const document: PublicLegalDocumentResponse = await getPublicLegalDocument(
      db,
      typeParam,
      locale
    );
    return c.json(document);
  } catch (error) {
    console.error("Error fetching legal document:", error);
    return c.json({ error: "Failed to fetch legal document" }, 500);
  }
});

legalDocumentsRoutes.get("/", (c) => {
  return c.json({ types: ["terms", "privacy"], locales: APP_LOCALES });
});

export default legalDocumentsRoutes;
