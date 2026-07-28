import type {
  AdminAuthConfig,
  AdminLegalDocumentsConfig,
  AppLocale,
  AuthConfig,
  HomepageMode,
  LegalDocumentType,
  LegalDocumentsConfig,
  PlatformFeatureConfig,
  PublicAuthConfig,
  PublicLegalDocumentResponse,
  PublicSiteSettings,
  SiteSettings,
  UpdateAuthConfigRequest,
  UpdateFeatureConfigRequest,
  UpdateLegalDocumentsRequest,
  UpdateSiteSettingsRequest,
} from "@dafthunk/types";
import {
  DEFAULT_PLATFORM_FEATURE_CONFIG,
  mergePlatformFeatureConfig,
} from "@dafthunk/types";
import { eq } from "drizzle-orm";

import type { Bindings } from "../context";
import type { Database } from "./index";
import {
  PLATFORM_SETTINGS_ID,
  platformSettings,
} from "./schema";
import {
  getWorkflowSchemeById,
  setDefaultWorkflowSchemeById,
} from "./workflow-scheme-queries";
import {
  mergeAuthConfigUpdate,
  parseAuthConfig,
  serializeAuthConfig,
  toAdminAuthConfig,
  toPublicAuthConfig,
  validateAuthConfigUpdate,
} from "../services/auth-config";
import {
  getLegalDocument,
  parseLegalConfig,
  serializeLegalConfig,
  toAdminLegalDocumentsConfig,
} from "../services/legal-documents";

const DEFAULT_PUBLIC_SETTINGS: PublicSiteSettings = {
  siteName: "z3cz.com",
  siteTagline: "Build serverless workflows visually.",
  supportEmail: null,
  newUserTourEnabled: false,
  homepageMode: "console",
  featureConfig: DEFAULT_PLATFORM_FEATURE_CONFIG,
};

function parseHomepageMode(value: string | null | undefined): HomepageMode {
  return value === "marketing" ? "marketing" : "console";
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
    supportEmail: row.supportEmail,
    newUserTourEnabled: row.newUserTourEnabled,
    homepageMode: parseHomepageMode(row.homepageMode),
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
    supportEmail:
      input.supportEmail !== undefined
        ? input.supportEmail
        : (existing?.supportEmail ?? null),
    newUserTourEnabled:
      input.newUserTourEnabled ??
      existing?.newUserTourEnabled ??
      DEFAULT_PUBLIC_SETTINGS.newUserTourEnabled,
    homepageMode:
      input.homepageMode ??
      (existing
        ? parseHomepageMode(existing.homepageMode)
        : DEFAULT_PUBLIC_SETTINGS.homepageMode),
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

export async function getAuthConfig(db: Database): Promise<AuthConfig> {
  const [row] = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.id, PLATFORM_SETTINGS_ID))
    .limit(1);

  return parseAuthConfig(row?.authConfig ?? null);
}

export async function getAdminAuthConfig(db: Database): Promise<AdminAuthConfig> {
  const [row] = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.id, PLATFORM_SETTINGS_ID))
    .limit(1);

  const config = parseAuthConfig(row?.authConfig ?? null);
  return toAdminAuthConfig(
    config,
    row?.updatedAt.toISOString() ?? new Date(0).toISOString(),
    row?.updatedBy ?? null
  );
}

export async function getPublicAuthConfig(db: Database): Promise<PublicAuthConfig> {
  const config = await getAuthConfig(db);
  return toPublicAuthConfig(config);
}

export async function updateAuthConfig(
  db: Database,
  env: Bindings,
  input: UpdateAuthConfigRequest,
  updatedBy: string
): Promise<AdminAuthConfig> {
  const [existing] = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.id, PLATFORM_SETTINGS_ID))
    .limit(1);

  const current = parseAuthConfig(existing?.authConfig ?? null);
  const next = mergeAuthConfigUpdate(current, input);
  const validationError = validateAuthConfigUpdate(next, env);
  if (validationError) {
    throw new Error(validationError);
  }

  const values = {
    authConfig: serializeAuthConfig(next),
    updatedBy,
    updatedAt: new Date(),
  };

  if (existing) {
    const [row] = await db
      .update(platformSettings)
      .set(values)
      .where(eq(platformSettings.id, PLATFORM_SETTINGS_ID))
      .returning();
    return toAdminAuthConfig(
      parseAuthConfig(row.authConfig),
      row.updatedAt.toISOString(),
      row.updatedBy
    );
  }

  const [row] = await db
    .insert(platformSettings)
    .values({
      id: PLATFORM_SETTINGS_ID,
      featureConfig: serializeFeatureConfig(DEFAULT_PLATFORM_FEATURE_CONFIG),
      authConfig: values.authConfig,
      updatedBy,
      updatedAt: values.updatedAt,
    })
    .returning();

  return toAdminAuthConfig(
    parseAuthConfig(row.authConfig),
    row.updatedAt.toISOString(),
    row.updatedBy
  );
}

export async function getLegalDocumentsConfig(
  db: Database
): Promise<LegalDocumentsConfig> {
  const [row] = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.id, PLATFORM_SETTINGS_ID))
    .limit(1);

  return parseLegalConfig(row?.legalConfig ?? null);
}

export async function getAdminLegalDocumentsConfig(
  db: Database
): Promise<AdminLegalDocumentsConfig> {
  const [row] = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.id, PLATFORM_SETTINGS_ID))
    .limit(1);

  const config = parseLegalConfig(row?.legalConfig ?? null);
  return toAdminLegalDocumentsConfig(
    config,
    row?.updatedAt.toISOString() ?? new Date(0).toISOString(),
    row?.updatedBy ?? null
  );
}

export async function getPublicLegalDocument(
  db: Database,
  type: LegalDocumentType,
  locale: AppLocale
): Promise<PublicLegalDocumentResponse> {
  const config = await getLegalDocumentsConfig(db);
  return {
    type,
    locale,
    document: getLegalDocument(config, type, locale),
  };
}

export async function updateLegalDocumentsConfig(
  db: Database,
  input: UpdateLegalDocumentsRequest,
  updatedBy: string
): Promise<AdminLegalDocumentsConfig> {
  const next = parseLegalConfig(JSON.stringify(input.legalConfig));

  const [existing] = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.id, PLATFORM_SETTINGS_ID))
    .limit(1);

  const values = {
    legalConfig: serializeLegalConfig(next),
    updatedBy,
    updatedAt: new Date(),
  };

  if (existing) {
    const [row] = await db
      .update(platformSettings)
      .set(values)
      .where(eq(platformSettings.id, PLATFORM_SETTINGS_ID))
      .returning();
    return toAdminLegalDocumentsConfig(
      parseLegalConfig(row.legalConfig),
      row.updatedAt.toISOString(),
      row.updatedBy
    );
  }

  const [row] = await db
    .insert(platformSettings)
    .values({
      id: PLATFORM_SETTINGS_ID,
      featureConfig: serializeFeatureConfig(DEFAULT_PLATFORM_FEATURE_CONFIG),
      legalConfig: values.legalConfig,
      updatedBy,
      updatedAt: values.updatedAt,
    })
    .returning();

  return toAdminLegalDocumentsConfig(
    parseLegalConfig(row.legalConfig),
    row.updatedAt.toISOString(),
    row.updatedBy
  );
}
