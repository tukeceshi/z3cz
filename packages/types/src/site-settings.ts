import type { PlatformFeatureConfig } from "./platform-features";

export const APP_LOCALES = ["en", "zh"] as const;

export type AppLocale = (typeof APP_LOCALES)[number];

export interface PublicSiteSettings {
  siteName: string;
  siteTagline: string;
  supportEmail: string | null;
  newUserTourEnabled: boolean;
  /** Experimental: load app JS over WebSocket instead of HTTP script tags. */
  wsBootstrapEnabled: boolean;
  maintenanceEnabled: boolean;
  maintenanceMessage: string | null;
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
  wsBootstrapEnabled?: boolean;
  maintenanceEnabled?: boolean;
  maintenanceMessage?: string | null;
}

export interface UpdateFeatureConfigRequest {
  featureConfig: PlatformFeatureConfig;
}
