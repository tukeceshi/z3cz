import type { PlatformFeatureConfig } from "./platform-features";

export const APP_LOCALES = ["en", "zh"] as const;

export type AppLocale = (typeof APP_LOCALES)[number];

export const HOMEPAGE_MODES = ["console", "marketing"] as const;

export type HomepageMode = (typeof HOMEPAGE_MODES)[number];

export interface PublicSiteSettings {
  siteName: string;
  siteTagline: string;
  supportEmail: string | null;
  newUserTourEnabled: boolean;
  homepageMode: HomepageMode;
  featureConfig: PlatformFeatureConfig;
}

export interface SiteSettings extends PublicSiteSettings {
  updatedAt: string;
  updatedBy: string | null;
}

export interface UpdateSiteSettingsRequest {
  siteName?: string;
  siteTagline?: string;
  supportEmail?: string | null;
  newUserTourEnabled?: boolean;
  homepageMode?: HomepageMode;
}

export interface UpdateFeatureConfigRequest {
  featureConfig: PlatformFeatureConfig;
}
