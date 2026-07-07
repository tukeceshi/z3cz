import type {
  PublicSiteSettings,
  SiteSettings,
  UpdateSiteSettingsRequest,
} from "@dafthunk/types";
import useSWR from "swr";

import { makeRequest } from "./utils";

export const SITE_SETTINGS_KEY = "/admin/settings";

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
