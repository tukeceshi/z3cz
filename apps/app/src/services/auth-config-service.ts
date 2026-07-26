import type {
  AdminAuthConfig,
  PublicAuthConfig,
  UpdateAuthConfigRequest,
} from "@dafthunk/types";
import useSWR from "swr";

import { makeRequest } from "./utils";

export const ADMIN_AUTH_CONFIG_KEY = "/admin/auth-config";
export const PUBLIC_AUTH_CONFIG_KEY = "/auth/config";

export function useAdminAuthConfig() {
  const { data, error, isLoading, mutate } = useSWR(ADMIN_AUTH_CONFIG_KEY, () =>
    makeRequest<AdminAuthConfig>("/admin/auth-config")
  );

  return {
    authConfig: data,
    authConfigError: error,
    isAuthConfigLoading: isLoading,
    refreshAuthConfig: mutate,
  };
}

export function usePublicAuthConfig() {
  const { data, error, isLoading, mutate } = useSWR(
    PUBLIC_AUTH_CONFIG_KEY,
    () => makeRequest<PublicAuthConfig>("/auth/config", {}, true),
    { revalidateOnFocus: false }
  );

  return {
    authConfig: data,
    authConfigError: error,
    isAuthConfigLoading: isLoading,
    refreshAuthConfig: mutate,
  };
}

export async function updateAdminAuthConfig(
  input: UpdateAuthConfigRequest
): Promise<AdminAuthConfig> {
  return makeRequest<AdminAuthConfig>("/admin/auth-config", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
