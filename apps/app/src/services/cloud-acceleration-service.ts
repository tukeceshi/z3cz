import type {
  AiInterfaceCloudAccelerationEntry,
  ListAiInterfaceCloudAccelerationResponse,
} from "@dafthunk/types";
import useSWR from "swr";

import { makeRequest } from "./utils";

function orgEndpoint(organizationId: string): string {
  return `/${organizationId}/cloud-acceleration`;
}

export function useOrgCloudAccelerationInterfaces(
  organizationId: string | undefined
) {
  const key = organizationId
    ? `${orgEndpoint(organizationId)}/interfaces`
    : null;
  const { data, error, isLoading, mutate } = useSWR(key, async () => {
    const response = await makeRequest<ListAiInterfaceCloudAccelerationResponse>(
      `${orgEndpoint(organizationId!)}/interfaces`
    );
    return response.entries;
  });

  return {
    interfaceEntries: data ?? [],
    interfacesError: error,
    isInterfacesLoading: isLoading,
    refreshInterfaces: mutate,
  };
}

export async function disableOrgInterfaceCloudAcceleration(
  organizationId: string,
  aiInterfaceId: string
): Promise<void> {
  await makeRequest<{ success: boolean }>(
    `${orgEndpoint(organizationId)}/interfaces/${encodeURIComponent(aiInterfaceId)}/disable`,
    { method: "POST" }
  );
}

export async function enableAlwaysOrgInterfaceCloudAcceleration(
  organizationId: string,
  aiInterfaceId: string
): Promise<AiInterfaceCloudAccelerationEntry> {
  const response = await makeRequest<{
    entry: AiInterfaceCloudAccelerationEntry;
  }>(
    `${orgEndpoint(organizationId)}/interfaces/${encodeURIComponent(aiInterfaceId)}/enable-always`,
    { method: "POST" }
  );
  return response.entry;
}
