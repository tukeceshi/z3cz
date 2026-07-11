import type {
  PlatformFeatureConfig,
  PublicSiteSettings,
  SiteSettings,
  UpdateFeatureConfigRequest,
  UpdateSiteSettingsRequest,
} from "@dafthunk/types";
import useSWR from "swr";

import { makeRequest } from "./utils";

export const SITE_SETTINGS_KEY = "/admin/settings";
export const FEATURE_CONFIG_KEY = "/admin/feature-config";

export function usePublicSiteSettings() {
  const { data, error, isLoading, mutate } = useSWR(
    "/site-settings",
    () => makeRequest<PublicSiteSettings>("/site-settings", {}, true),
    { revalidateOnFocus: false }
  );

  return {
    siteSettings: data,
    siteSettingsError: error,
    isSiteSettingsLoading: isLoading,
    refreshSiteSettings: mutate,
  };
}

export function useAdminSiteSettings() {
  const { data, error, isLoading, mutate } = useSWR(SITE_SETTINGS_KEY, () =>
    makeRequest<SiteSettings>("/admin/settings")
  );

  return {
    settings: data,
    settingsError: error,
    isSettingsLoading: isLoading,
    refreshSettings: mutate,
  };
}

export async function updateAdminSiteSettings(
  input: UpdateSiteSettingsRequest
): Promise<SiteSettings> {
  return makeRequest<SiteSettings>("/admin/settings", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function useAdminFeatureConfig() {
  const { data, error, isLoading, mutate } = useSWR(FEATURE_CONFIG_KEY, () =>
    makeRequest<{ featureConfig: PlatformFeatureConfig }>("/admin/feature-config")
  );

  return {
    featureConfig: data?.featureConfig,
    featureConfigError: error,
    isFeatureConfigLoading: isLoading,
    refreshFeatureConfig: mutate,
  };
}

export async function updateAdminFeatureConfig(
  input: UpdateFeatureConfigRequest
): Promise<{ featureConfig: PlatformFeatureConfig }> {
  return makeRequest<{ featureConfig: PlatformFeatureConfig }>(
    "/admin/feature-config",
    {
      method: "PATCH",
      body: JSON.stringify(input),
    }
  );
}
