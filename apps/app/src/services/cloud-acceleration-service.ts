import type {
  AiInterfaceCloudAccelerationEntry,
  ListAiInterfaceCloudAccelerationAvailableResponse,
  ListAiInterfaceCloudAccelerationResponse,
  ListApiForwardingAvailableResponse,
  ListApiForwardingInterfacesResponse,
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

export function useOrgCloudAccelerationAvailable(
  organizationId: string | undefined
) {
  const key = organizationId
    ? `${orgEndpoint(organizationId)}/interfaces/available`
    : null;
  const { data, error, isLoading, mutate } = useSWR(key, async () => {
    const response =
      await makeRequest<ListAiInterfaceCloudAccelerationAvailableResponse>(
        `${orgEndpoint(organizationId!)}/interfaces/available`
      );
    return response.interfaces;
  });

  return {
    availableDownloadInterfaces: data ?? [],
    availableDownloadError: error,
    isAvailableDownloadLoading: isLoading,
    refreshAvailableDownload: mutate,
  };
}

export function useOrgApiForwardingInterfaces(
  organizationId: string | undefined
) {
  const key = organizationId
    ? `${orgEndpoint(organizationId)}/api-forwarding`
    : null;
  const { data, error, isLoading, mutate } = useSWR(key, async () => {
    const response = await makeRequest<ListApiForwardingInterfacesResponse>(
      `${orgEndpoint(organizationId!)}/api-forwarding`
    );
    return response.interfaces;
  });

  return {
    forwardingInterfaces: data ?? [],
    forwardingError: error,
    isForwardingLoading: isLoading,
    refreshForwarding: mutate,
  };
}

export function useOrgApiForwardingAvailable(
  organizationId: string | undefined
) {
  const key = organizationId
    ? `${orgEndpoint(organizationId)}/api-forwarding/available`
    : null;
  const { data, error, isLoading, mutate } = useSWR(key, async () => {
    const response = await makeRequest<ListApiForwardingAvailableResponse>(
      `${orgEndpoint(organizationId!)}/api-forwarding/available`
    );
    return response.interfaces;
  });

  return {
    availableInterfaces: data ?? [],
    availableError: error,
    isAvailableLoading: isLoading,
    refreshAvailable: mutate,
  };
}

export async function setOrgInterfaceApiForwarding(
  organizationId: string,
  aiInterfaceId: string,
  enabled: boolean
): Promise<void> {
  await makeRequest<{ success: boolean }>(
    `${orgEndpoint(organizationId)}/api-forwarding/${encodeURIComponent(aiInterfaceId)}`,
    {
      method: "POST",
      body: JSON.stringify({ enabled }),
    }
  );
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
