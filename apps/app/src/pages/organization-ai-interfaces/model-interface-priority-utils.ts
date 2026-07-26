import type { OrganizationAiInterface } from "@dafthunk/types";
import {
  formatPlatformModelLabel,
  isSingleModelAiInterface,
  isSingleModelProviderMetadata,
  isVolcanoAiInterfaceProvider,
  type OrgTextModelOption,
} from "@dafthunk/types";

export type ModelInterfaceChannelKind = "aggregate" | "api";

export interface ModelBrandInterfaceOption {
  readonly interfaceId: string;
  readonly interfaceName: string;
  readonly channelKind: ModelInterfaceChannelKind;
  readonly createdAt: string;
}

export interface DuplicateTextModelEntry {
  readonly canonicalId: string;
  readonly displayLabel: string;
  readonly brandInterfaces: readonly ModelBrandInterfaceOption[];
}

function readVolcanoModelEnabled(
  metadata: OrganizationAiInterface["metadata"],
  canonicalId: string
): boolean {
  if (!metadata || typeof metadata !== "object" || !("models" in metadata)) {
    return false;
  }
  const models = (metadata as { models: Record<string, { enabled?: boolean }> })
    .models;
  return models[canonicalId]?.enabled === true;
}

export function interfaceHasModelEnabled(
  iface: OrganizationAiInterface,
  canonicalId: string
): boolean {
  if (!iface.enabled) {
    return false;
  }
  if (isVolcanoAiInterfaceProvider(iface.provider)) {
    return readVolcanoModelEnabled(iface.metadata, canonicalId);
  }
  if (
    isSingleModelAiInterface(iface) &&
    isSingleModelProviderMetadata(iface.metadata)
  ) {
    return iface.metadata.models[canonicalId]?.enabled === true;
  }
  return false;
}

export function resolveInterfaceChannelKind(
  iface: OrganizationAiInterface
): ModelInterfaceChannelKind | null {
  if (isVolcanoAiInterfaceProvider(iface.provider)) {
    return "aggregate";
  }
  if (isSingleModelAiInterface(iface)) {
    return "api";
  }
  return null;
}

export function listBrandInterfacesForModel(
  canonicalId: string,
  interfaces: readonly OrganizationAiInterface[]
): ModelBrandInterfaceOption[] {
  return interfaces.flatMap((iface) => {
    if (!interfaceHasModelEnabled(iface, canonicalId)) {
      return [];
    }
    const channelKind = resolveInterfaceChannelKind(iface);
    if (!channelKind) {
      return [];
    }
    return [
      {
        interfaceId: iface.id,
        interfaceName: iface.name,
        channelKind,
        createdAt: iface.createdAt,
      },
    ];
  });
}

export function buildDuplicateTextModelEntries(params: {
  readonly models: readonly OrgTextModelOption[];
  readonly interfaces: readonly OrganizationAiInterface[];
  readonly modalityLabelFor: (modality: OrgTextModelOption["modality"]) => string;
}): DuplicateTextModelEntry[] {
  return params.models
    .filter((model) => model.modality === "text")
    .flatMap((model) => {
      const brandInterfaces = listBrandInterfacesForModel(
        model.canonicalId,
        params.interfaces
      );
      if (brandInterfaces.length < 2) {
        return [];
      }
      const modalityLabel = params.modalityLabelFor(model.modality);
      return [
        {
          canonicalId: model.canonicalId,
          displayLabel: formatPlatformModelLabel({
            alias: model.displayName,
            modalityLabel,
          }),
          brandInterfaces,
        },
      ];
    });
}

export function sortBrandInterfacesByPriority(
  brandInterfaces: readonly ModelBrandInterfaceOption[],
  priorityInterfaceIds: readonly string[]
): ModelBrandInterfaceOption[] {
  if (priorityInterfaceIds.length === 0) {
    return [...brandInterfaces].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  const rank = new Map(
    priorityInterfaceIds.map((interfaceId, index) => [interfaceId, index])
  );

  return [...brandInterfaces].sort((a, b) => {
    const rankA = rank.get(a.interfaceId);
    const rankB = rank.get(b.interfaceId);
    if (rankA !== undefined && rankB !== undefined) {
      return rankA - rankB;
    }
    if (rankA !== undefined) {
      return -1;
    }
    if (rankB !== undefined) {
      return 1;
    }
    return (
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  });
}
