import type {
  AppLocale,
  PublicSiteSettings,
  SiteSettings,
  UpdateSiteSettingsRequest,
} from "@dafthunk/types";
import { eq } from "drizzle-orm";

import type { Database } from "./index";
import {
  PLATFORM_SETTINGS_ID,
  platformSettings,
} from "./schema";

const DEFAULT_PUBLIC_SETTINGS: PublicSiteSettings = {
  siteName: "Dafthunk",
  siteTagline: "Build serverless workflows visually.",
  defaultLocale: "en",
  supportEmail: null,
};

function isAppLocale(value: string): value is AppLocale {
  return value === "en" || value === "zh";
}

function rowToPublicSettings(
  row: typeof platformSettings.$inferSelect
): PublicSiteSettings {
  return {
    siteName: row.siteName,
    siteTagline: row.siteTagline,
    defaultLocale: isAppLocale(row.defaultLocale) ? row.defaultLocale : "en",
    supportEmail: row.supportEmail,
  };
}

function rowToSiteSettings(
  row: typeof platformSettings.$inferSelect
): SiteSettings {
  return {
    ...rowToPublicSettings(row),
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy,
  };
}

export async function getPublicSiteSettings(
  db: Database
): Promise<PublicSiteSettings> {
  const [row] = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.id, PLATFORM_SETTINGS_ID))
    .limit(1);

  if (!row) {
    return DEFAULT_PUBLIC_SETTINGS;
  }

  return rowToPublicSettings(row);
}

export async function getSiteSettings(db: Database): Promise<SiteSettings> {
  const [row] = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.id, PLATFORM_SETTINGS_ID))
    .limit(1);

  if (!row) {
    return {
      ...DEFAULT_PUBLIC_SETTINGS,
      updatedAt: new Date(0).toISOString(),
      updatedBy: null,
    };
  }

  return rowToSiteSettings(row);
}

export async function updateSiteSettings(
  db: Database,
  input: UpdateSiteSettingsRequest,
  updatedBy: string
): Promise<SiteSettings> {
  const [existing] = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.id, PLATFORM_SETTINGS_ID))
    .limit(1);

  const values = {
    siteName: input.siteName ?? existing?.siteName ?? DEFAULT_PUBLIC_SETTINGS.siteName,
    siteTagline:
      input.siteTagline ??
      existing?.siteTagline ??
      DEFAULT_PUBLIC_SETTINGS.siteTagline,
    defaultLocale:
      input.defaultLocale ??
      existing?.defaultLocale ??
      DEFAULT_PUBLIC_SETTINGS.defaultLocale,
    supportEmail:
      input.supportEmail !== undefined
        ? input.supportEmail
        : (existing?.supportEmail ?? null),
    updatedBy,
    updatedAt: new Date(),
  };

  if (existing) {
    const [row] = await db
      .update(platformSettings)
      .set(values)
      .where(eq(platformSettings.id, PLATFORM_SETTINGS_ID))
      .returning();
    return rowToSiteSettings(row);
  }

  const [row] = await db
    .insert(platformSettings)
    .values({
      id: PLATFORM_SETTINGS_ID,
      ...values,
    })
    .returning();

  return rowToSiteSettings(row);
}
