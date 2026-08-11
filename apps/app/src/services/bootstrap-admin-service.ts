import type {
  AdminBootstrapSettings,
  BootstrapConnectionTestResult,
  BootstrapSyncResult,
  UpdateBootstrapSettingsRequest,
} from "@dafthunk/types";
import useSWR from "swr";

import { makeRequest } from "./utils";

export const BOOTSTRAP_CONFIG_KEY = "/admin/bootstrap-config";

export function useAdminBootstrapConfig() {
  const { data, error, isLoading, mutate } = useSWR(BOOTSTRAP_CONFIG_KEY, () =>
    makeRequest<AdminBootstrapSettings>("/admin/bootstrap-config")
  );

  return {
    bootstrapConfig: data,
    bootstrapConfigError: error,
    isBootstrapConfigLoading: isLoading,
    refreshBootstrapConfig: mutate,
  };
}

export async function updateAdminBootstrapConfig(
  input: UpdateBootstrapSettingsRequest
): Promise<AdminBootstrapSettings> {
  return makeRequest<AdminBootstrapSettings>("/admin/bootstrap-config", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function testAdminBootstrapR2Connection(): Promise<BootstrapConnectionTestResult> {
  return makeRequest<BootstrapConnectionTestResult>(
    "/admin/bootstrap-config/test-r2",
    { method: "POST" }
  );
}

export async function syncAdminBootstrapShell(): Promise<BootstrapSyncResult> {
  return makeRequest<BootstrapSyncResult>("/admin/bootstrap-config/sync", {
    method: "POST",
  });
}
