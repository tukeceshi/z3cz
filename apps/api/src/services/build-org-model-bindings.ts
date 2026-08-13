import type {
  AiModelModality,
  OrgModelInstanceConfig,
  OrgModelInstanceEntry,
  OrgTextModelUnavailableReason,
  PlatformAiModel,
} from "@dafthunk/types";
import {
  formatCanvasModelLabel,
  buildOrgModelOptionId,
  listOrgModelEntries,
  resolveInterfaceModelAlias,
  type OrgModelChannelKind,
} from "@dafthunk/types";

export interface OrgBindingInterface {
  readonly id: string;
  readonly channelKind: OrgModelChannelKind;
  readonly entries: readonly OrgModelInstanceEntry[];
}

export interface OrgModelBindingBase {
  readonly optionId: string;
  readonly instanceId: string;
  readonly canonicalId: string;
  readonly interfaceId: string;
  readonly channelKind: OrgModelChannelKind;
  readonly alias: string;
  readonly displayName: string;
  readonly modality: AiModelModality;
  readonly selectable: boolean;
  readonly unavailableReason?: OrgTextModelUnavailableReason;
  readonly description: string;
  readonly sortOrder: number;
  readonly brandIcon: string | null;
  readonly providerModelId: string;
}

/** @deprecated Use OrgBindingInterface */
export interface VolcanoBindingInterface {
  readonly id: string;
  readonly models: Readonly<Record<string, OrgModelInstanceConfig>>;
}

/** @deprecated Use OrgBindingInterface */
export interface SingleModelBindingInterface {
  readonly id: string;
  readonly models: Readonly<Record<string, OrgModelInstanceConfig>>;
}

function bindingFromEntry(params: {
  readonly model: PlatformAiModel;
  readonly interfaceId: string;
  readonly channelKind: OrgModelChannelKind;
  readonly entry: OrgModelInstanceEntry;
}): OrgModelBindingBase | null {
  const upstreamModelId = params.entry.config.upstreamModelId.trim();
  if (!upstreamModelId) {
    return null;
  }

  const alias = resolveInterfaceModelAlias({
    alias: params.entry.config.alias,
    platformDisplayName: params.model.displayName,
  });

  return {
    optionId: buildOrgModelOptionId(params.interfaceId, params.entry.instanceId),
    instanceId: params.entry.instanceId,
    canonicalId: params.model.canonicalId,
    interfaceId: params.interfaceId,
    channelKind: params.channelKind,
    alias,
    displayName: formatCanvasModelLabel({
      channelKind: params.channelKind,
      alias,
    }),
    modality: params.model.modality as AiModelModality,
    selectable: params.entry.config.enabled === true,
    unavailableReason:
      params.entry.config.enabled === true
        ? undefined
        : "model_disabled_on_interface",
    description: params.model.description,
    sortOrder: params.model.sortOrder,
    brandIcon: params.model.brandIcon,
    providerModelId: upstreamModelId,
  };
}

export function buildOrgModelBindings(params: {
  readonly platformModels: readonly PlatformAiModel[];
  readonly interfaces: readonly OrgBindingInterface[];
}): OrgModelBindingBase[] {
  const visibleModels = params.platformModels.filter((model) => model.platformEnabled);
  const bindings: OrgModelBindingBase[] = [];

  for (const model of visibleModels) {
    for (const iface of params.interfaces) {
      for (const entry of iface.entries) {
        if (entry.canonicalId !== model.canonicalId) {
          continue;
        }
        const binding = bindingFromEntry({
          model,
          interfaceId: iface.id,
          channelKind: iface.channelKind,
          entry,
        });
        if (binding) {
          bindings.push(binding);
        }
      }
    }
  }

  return bindings;
}

export function toOrgBindingInterfaces(params: {
  readonly volcanoInterfaces: readonly VolcanoBindingInterface[];
  readonly singleModelInterfaces: readonly SingleModelBindingInterface[];
}): OrgBindingInterface[] {
  return [
    ...params.volcanoInterfaces.map((iface) => ({
      id: iface.id,
      channelKind: "aggregate" as const,
      entries: listOrgModelEntries(iface.models),
    })),
    ...params.singleModelInterfaces.map((iface) => ({
      id: iface.id,
      channelKind: "api" as const,
      entries: listOrgModelEntries(iface.models),
    })),
  ];
}
