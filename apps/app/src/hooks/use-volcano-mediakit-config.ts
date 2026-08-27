import {
  isVolcanoAiInterfaceProvider,
  isVolcanoMediaKitActive,
  listEnabledVolcanoMediaKitVideoEnhanceModes,
  resolveVolcanoMediaKitFromMetadata,
  type OrganizationAiInterface,
  type VolcanoInterfaceMetadata,
  type VolcanoMediaKitSnapshot,
  type VolcanoMediaKitVideoEnhanceMode,
} from "@dafthunk/types";
import { useMemo } from "react";

import {
  fetchOrganizationAiInterface,
  fetchVolcanoSnapshot,
  useOrganizationAiInterfaces,
} from "@/services/organization-ai-interface-service";

export interface VolcanoMediaKitConfigState {
  readonly snapshot: VolcanoMediaKitSnapshot;
  readonly active: boolean;
  readonly enabledVideoModes: readonly VolcanoMediaKitVideoEnhanceMode[];
  readonly hasApiKey: boolean;
}

export function resolveMediaKitConfigFromInterface(
  metadata: VolcanoInterfaceMetadata | null | undefined
): VolcanoMediaKitConfigState {
  const snapshot = resolveVolcanoMediaKitFromMetadata(metadata);
  return {
    snapshot,
    active: isVolcanoMediaKitActive(snapshot),
    enabledVideoModes: listEnabledVolcanoMediaKitVideoEnhanceModes(snapshot),
    hasApiKey: Boolean(metadata?.mediaKitApiKeyEncrypted?.trim()),
  };
}

export function useVolcanoMediaKitConfig(
  organizationId: string | undefined,
  interfaceId: string | undefined
): {
  readonly config: VolcanoMediaKitConfigState | null;
  readonly isLoading: boolean;
} {
  const { interfaces, isInterfacesLoading } =
    useOrganizationAiInterfaces(organizationId);

  const iface = useMemo(
    () => interfaces.find((entry) => entry.id === interfaceId),
    [interfaceId, interfaces]
  );

  const config = useMemo(() => {
    if (!iface) {
      return null;
    }
    return resolveMediaKitConfigFromInterface(
      iface.metadata as VolcanoInterfaceMetadata | null | undefined
    );
  }, [iface]);

  return {
    config,
    isLoading: isInterfacesLoading,
  };
}

export interface OrgVolcanoMediaKitConfigState {
  readonly interfaceId: string | null;
  readonly config: VolcanoMediaKitConfigState | null;
}

/** MediaKit lives on the org volcano interface, not on each video model interface. */
export function resolveOrgVolcanoMediaKitFromInterfaces(
  interfaces: readonly OrganizationAiInterface[]
): OrgVolcanoMediaKitConfigState {
  const volcanoInterface = interfaces.find((entry) =>
    isVolcanoAiInterfaceProvider(entry.provider)
  );
  if (!volcanoInterface) {
    return { interfaceId: null, config: null };
  }

  return {
    interfaceId: volcanoInterface.id,
    config: resolveMediaKitConfigFromInterface(
      volcanoInterface.metadata as VolcanoInterfaceMetadata | null | undefined
    ),
  };
}

export function useOrgVolcanoMediaKitConfig(organizationId: string | undefined): {
  readonly interfaceId: string | null;
  readonly config: VolcanoMediaKitConfigState | null;
  readonly isLoading: boolean;
} {
  const { interfaces, isInterfacesLoading } =
    useOrganizationAiInterfaces(organizationId);

  const resolved = useMemo(
    () => resolveOrgVolcanoMediaKitFromInterfaces(interfaces),
    [interfaces]
  );

  return {
    interfaceId: resolved.interfaceId,
    config: resolved.config,
    isLoading: isInterfacesLoading,
  };
}

export async function fetchVolcanoMediaKitConfigState(
  organizationId: string,
  interfaceId: string
): Promise<VolcanoMediaKitConfigState> {
  const [snapshotResponse, iface] = await Promise.all([
    fetchVolcanoSnapshot(organizationId, interfaceId),
    fetchOrganizationAiInterface(organizationId, interfaceId),
  ]);

  const metadata = iface.metadata as VolcanoInterfaceMetadata | null | undefined;
  const snapshot =
    snapshotResponse.snapshot.mediaKit ??
    resolveVolcanoMediaKitFromMetadata(metadata);

  return {
    snapshot,
    active: isVolcanoMediaKitActive(snapshot),
    enabledVideoModes: listEnabledVolcanoMediaKitVideoEnhanceModes(snapshot),
    hasApiKey: Boolean(metadata?.mediaKitApiKeyEncrypted?.trim()),
  };
}
