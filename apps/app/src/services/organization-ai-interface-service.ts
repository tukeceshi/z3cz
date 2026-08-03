import type {
  CreateOrganizationAiInterfaceRequest,
  OrganizationAiInterface,
  UpdateOrganizationAiInterfaceRequest,
  VolcanoProbeActivationResponse,
  VolcanoProbeTosBucketsResponse,
  VolcanoSnapshotFetchResponse,
  VolcanoSnapshotResponse,
} from "@dafthunk/types";
import useSWR from "swr";

import { makeRequest } from "./utils";

export const VOLCANO_ARK_NOT_OPENED_CODE = "volcano_ark_not_opened" as const;
export const AI_INTERFACE_NAME_CONFLICT_CODE =
  "ai_interface_name_conflict" as const;
export const VOLCANO_INTERFACE_EXISTS_CODE =
  "volcano_interface_exists" as const;
export const VOLCANO_TOS_NOT_OPENED_CODE = "volcano_tos_not_opened" as const;

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
  input: CreateOrganizationAiInterfaceRequest,
  options?: { readonly idempotencyKey?: string }
): Promise<OrganizationAiInterface> {
  const headers: HeadersInit = {};
  if (options?.idempotencyKey) {
    headers["Idempotency-Key"] = options.idempotencyKey;
  }
  const response = await makeRequest<{ interface: OrganizationAiInterface }>(
    orgEndpoint(organizationId),
    {
      method: "POST",
      body: JSON.stringify(input),
      headers,
    }
  );
  return response.interface;
}

export async function fetchOrganizationAiInterface(
  organizationId: string,
  interfaceId: string
): Promise<OrganizationAiInterface> {
  const response = await makeRequest<{ interface: OrganizationAiInterface }>(
    `${orgEndpoint(organizationId)}/${interfaceId}`
  );
  return response.interface;
}

export async function retryVolcanoInterfaceSetup(
  organizationId: string,
  interfaceId: string
): Promise<OrganizationAiInterface> {
  const response = await makeRequest<{ interface: OrganizationAiInterface }>(
    `${orgEndpoint(organizationId)}/${interfaceId}/volcano-setup/retry`,
    { method: "POST" }
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
): Promise<VolcanoSnapshotFetchResponse> {
  const query = options?.refreshPackages ? "?refreshPackages=1" : "";
  return makeRequest<VolcanoSnapshotFetchResponse>(
    `${orgEndpoint(organizationId)}/${interfaceId}/volcano-snapshot${query}`
  );
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

export async function updateVolcanoModelAlias(
  organizationId: string,
  interfaceId: string,
  volcanoModelAlias: Record<string, string>
): Promise<OrganizationAiInterface> {
  return updateOrganizationAiInterface(organizationId, interfaceId, {
    volcanoModelAlias,
  });
}

export async function updateSingleModelModelEnabled(
  organizationId: string,
  interfaceId: string,
  singleModelModelEnabled: Record<string, boolean>
): Promise<OrganizationAiInterface> {
  return updateOrganizationAiInterface(organizationId, interfaceId, {
    singleModelModelEnabled,
  });
}

export async function updateSingleModelModelAlias(
  organizationId: string,
  interfaceId: string,
  singleModelModelAlias: Record<string, string>
): Promise<OrganizationAiInterface> {
  return updateOrganizationAiInterface(organizationId, interfaceId, {
    singleModelModelAlias,
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
): Promise<VolcanoProbeTosBucketsResponse> {
  return makeRequest<VolcanoProbeTosBucketsResponse>(
    `${orgEndpoint(organizationId)}/${interfaceId}/tos-buckets?region=${encodeURIComponent(region)}`
  );
}

export async function probeVolcanoTosBuckets(
  organizationId: string,
  input: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
  }
): Promise<VolcanoProbeTosBucketsResponse> {
  return makeRequest<VolcanoProbeTosBucketsResponse>(
    `${orgEndpoint(organizationId)}/volcano-probe-tos-buckets`,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
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

export async function ensureVolcanoTosCors(
  organizationId: string,
  interfaceId: string
): Promise<{
  readonly applied: boolean;
  readonly configured: boolean;
  readonly origins: readonly string[];
}> {
  return makeRequest(`${orgEndpoint(organizationId)}/${interfaceId}/ensure-tos-cors`, {
    method: "POST",
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
