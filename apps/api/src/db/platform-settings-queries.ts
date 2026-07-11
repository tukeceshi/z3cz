import type {
  AppLocale,
  PlatformFeatureConfig,
  PublicSiteSettings,
  SiteSettings,
  UpdateFeatureConfigRequest,
  UpdateSiteSettingsRequest,
} from "@dafthunk/types";
import {
  DEFAULT_PLATFORM_FEATURE_CONFIG,
  mergePlatformFeatureConfig,
} from "@dafthunk/types";
import { eq } from "drizzle-orm";

import type { Database } from "./index";
import {
  PLATFORM_SETTINGS_ID,
  platformSettings,
} from "./schema";
import {
  getWorkflowSchemeById,
  setDefaultWorkflowSchemeById,
} from "./workflow-scheme-queries";

const DEFAULT_PUBLIC_SETTINGS: PublicSiteSettings = {
  siteName: "Dafthunk",
  siteTagline: "Build serverless workflows visually.",
  defaultLocale: "en",
  supportEmail: null,
  featureConfig: DEFAULT_PLATFORM_FEATURE_CONFIG,
};

function isAppLocale(value: string): value is AppLocale {
  return value === "en" || value === "zh";
}

function parseFeatureConfig(value: string | null): PlatformFeatureConfig {
  if (!value) {
    return DEFAULT_PLATFORM_FEATURE_CONFIG;
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") {
      return DEFAULT_PLATFORM_FEATURE_CONFIG;
    }
    return mergePlatformFeatureConfig(parsed as Partial<PlatformFeatureConfig>);
  } catch {
    return DEFAULT_PLATFORM_FEATURE_CONFIG;
  }
}

function serializeFeatureConfig(config: PlatformFeatureConfig): string {
  return JSON.stringify(mergePlatformFeatureConfig(config));
}

function rowToPublicSettings(
  row: typeof platformSettings.$inferSelect
): PublicSiteSettings {
  return {
    siteName: row.siteName,
    siteTagline: row.siteTagline,
    defaultLocale: isAppLocale(row.defaultLocale) ? row.defaultLocale : "en",
    supportEmail: row.supportEmail,
    featureConfig: parseFeatureConfig(row.featureConfig),
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
      featureConfig: serializeFeatureConfig(DEFAULT_PLATFORM_FEATURE_CONFIG),
      ...values,
    })
    .returning();

  return rowToSiteSettings(row);
}

export async function updateFeatureConfig(
  db: Database,
  input: UpdateFeatureConfigRequest,
  updatedBy: string
): Promise<SiteSettings> {
  const featureConfig = mergePlatformFeatureConfig(input.featureConfig);
  const scheme = await getWorkflowSchemeById(
    db,
    featureConfig.defaultWorkflowSchemeId
  );
  if (!scheme || !scheme.enabled) {
    throw new Error("Invalid default workflow scheme");
  }

  await setDefaultWorkflowSchemeById(db, featureConfig.defaultWorkflowSchemeId);

  const [existing] = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.id, PLATFORM_SETTINGS_ID))
    .limit(1);

  const values = {
    featureConfig: serializeFeatureConfig(featureConfig),
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
