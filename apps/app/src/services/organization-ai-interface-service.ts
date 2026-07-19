import type {
  CreateOrganizationAiInterfaceRequest,
  OrganizationAiInterface,
  UpdateOrganizationAiInterfaceRequest,
  VolcanoProbeActivationResponse,
  VolcanoSnapshotResponse,
} from "@dafthunk/types";
import useSWR from "swr";

import { makeRequest } from "./utils";

function orgEndpoint(organizationId: string): string {
  return `/${organizationId}/ai-interfaces`;
}

export function useOrganizationAiInterfaces(organizationId: string | undefined) {
  const key = organizationId ? orgEndpoint(organizationId) : null;
  const { data, error, isLoading, mutate } = useSWR(key, async () => {
    const response = await makeRequest<{
      interfaces: OrganizationAiInterface[];
    }>(orgEndpoint(organizationId!));
    return response.interfaces;
  });

  return {
    interfaces: data ?? [],
    interfacesError: error,
    isInterfacesLoading: isLoading,
    refreshInterfaces: mutate,
  };
}

export async function createOrganizationAiInterface(
  organizationId: string,
  input: CreateOrganizationAiInterfaceRequest
): Promise<OrganizationAiInterface> {
  const response = await makeRequest<{ interface: OrganizationAiInterface }>(
    orgEndpoint(organizationId),
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
  return response.interface;
}

export async function updateOrganizationAiInterface(
  organizationId: string,
  id: string,
  input: UpdateOrganizationAiInterfaceRequest
): Promise<OrganizationAiInterface> {
  const response = await makeRequest<{ interface: OrganizationAiInterface }>(
    `${orgEndpoint(organizationId)}/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    }
  );
  return response.interface;
}

export async function deleteOrganizationAiInterface(
  organizationId: string,
  id: string
): Promise<void> {
  await makeRequest(`${orgEndpoint(organizationId)}/${id}`, {
    method: "DELETE",
  });
}

export async function fetchVolcanoSnapshot(
  organizationId: string,
  interfaceId: string,
  options?: { refreshPackages?: boolean }
): Promise<VolcanoSnapshotResponse> {
  const query = options?.refreshPackages ? "?refreshPackages=1" : "";
  const response = await makeRequest<{ snapshot: VolcanoSnapshotResponse }>(
    `${orgEndpoint(organizationId)}/${interfaceId}/volcano-snapshot${query}`
  );
  return response.snapshot;
}

export async function updateVolcanoModelEnabled(
  organizationId: string,
  interfaceId: string,
  volcanoModelEnabled: Record<string, boolean>
): Promise<OrganizationAiInterface> {
  return updateOrganizationAiInterface(organizationId, interfaceId, {
    volcanoModelEnabled,
  });
}

export async function probeVolcanoCredentials(
  organizationId: string,
  input: {
    accessKeyId: string;
    secretAccessKey: string;
    canonicalIds?: string[];
  }
): Promise<VolcanoProbeActivationResponse> {
  return makeRequest<VolcanoProbeActivationResponse>(
    `${orgEndpoint(organizationId)}/volcano-probe-credentials`,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}

export async function listVolcanoTosBuckets(
  organizationId: string,
  interfaceId: string,
  region: string
): Promise<readonly string[]> {
  const response = await makeRequest<{ buckets: string[] }>(
    `${orgEndpoint(organizationId)}/${interfaceId}/tos-buckets?region=${encodeURIComponent(region)}`
  );
  return response.buckets ?? [];
}

export async function updateVolcanoTosStorage(
  organizationId: string,
  interfaceId: string,
  input: {
    readonly enabled: boolean;
    readonly region: string;
    readonly bucket: string;
    readonly createBucket?: boolean;
  }
): Promise<OrganizationAiInterface> {
  return updateOrganizationAiInterface(organizationId, interfaceId, {
    tosStorage: input,
  });
}

export async function probeVolcanoActivation(
  organizationId: string,
  interfaceId: string,
  canonicalIds?: string[]
): Promise<VolcanoProbeActivationResponse> {
  return makeRequest<VolcanoProbeActivationResponse>(
    `${orgEndpoint(organizationId)}/${interfaceId}/probe-activation`,
    {
      method: "POST",
      body: JSON.stringify(
        canonicalIds ? { canonicalIds } : {}
      ),
    }
  );
}
