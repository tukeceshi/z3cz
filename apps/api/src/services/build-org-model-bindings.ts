import type {
  AiModelModality,
  OrgTextModelUnavailableReason,
  PlatformAiModel,
  PlatformAiModelGroup,
  SingleModelModelConfig,
  VolcanoModelConfig,
} from "@dafthunk/types";
import {
  formatCanvasModelLabel,
  buildOrgModelOptionId,
  resolveInterfaceModelAlias,
  type OrgModelChannelKind,
} from "@dafthunk/types";

export interface VolcanoBindingInterface {
  readonly id: string;
  readonly models: Readonly<Record<string, VolcanoModelConfig>>;
}

export interface SingleModelBindingInterface {
  readonly id: string;
  readonly models: Readonly<Record<string, SingleModelModelConfig>>;
}

export interface OrgModelBindingBase {
  readonly optionId: string;
  readonly canonicalId: string;
  readonly interfaceId: string;
  readonly channelKind: OrgModelChannelKind;
  readonly alias: string;
  readonly displayName: string;
  readonly modality: AiModelModality;
  readonly selectable: boolean;
  readonly unavailableReason?: OrgTextModelUnavailableReason;
  readonly description: string;
  readonly groupId: string | null;
  readonly groupName: string | null;
  readonly groupDescription: string | null;
  readonly groupIcon: string | null;
  readonly providerModelId: string;
}

function bindingFromConfig(params: {
  readonly model: PlatformAiModel;
  readonly interfaceId: string;
  readonly channelKind: OrgModelChannelKind;
  readonly config: VolcanoModelConfig | SingleModelModelConfig;
  readonly providerModelId: string;
  readonly group: PlatformAiModelGroup | undefined;
}): OrgModelBindingBase {
  const alias = resolveInterfaceModelAlias({
    alias: params.config.alias,
    platformDisplayName: params.model.displayName,
  });

  return {
    optionId: buildOrgModelOptionId(params.interfaceId, params.model.canonicalId),
    canonicalId: params.model.canonicalId,
    interfaceId: params.interfaceId,
    channelKind: params.channelKind,
    alias,
    displayName: formatCanvasModelLabel({
      channelKind: params.channelKind,
      alias,
    }),
    modality: params.model.modality as AiModelModality,
    selectable: params.config.enabled === true,
    unavailableReason:
      params.config.enabled === true
        ? undefined
        : "model_disabled_on_interface",
    description: params.model.description,
    groupId: params.model.groupId,
    groupName: params.group?.name ?? null,
    groupDescription: params.group?.description ?? null,
    groupIcon: params.group?.icon ?? null,
    providerModelId: params.providerModelId,
  };
}

export function buildOrgModelBindings(params: {
  readonly platformModels: readonly PlatformAiModel[];
  readonly groups: readonly PlatformAiModelGroup[];
  readonly volcanoInterfaces: readonly VolcanoBindingInterface[];
  readonly singleModelInterfaces: readonly SingleModelBindingInterface[];
}): OrgModelBindingBase[] {
  const groupById = new Map(params.groups.map((group) => [group.id, group]));
  const visibleModels = params.platformModels.filter((model) => model.platformEnabled);
  const bindings: OrgModelBindingBase[] = [];

  for (const model of visibleModels) {
    const group = model.groupId ? groupById.get(model.groupId) : undefined;

    for (const iface of params.volcanoInterfaces) {
      const config = iface.models[model.canonicalId];
      if (!config) {
        continue;
      }
      const providerModelId = config.providerModelId?.trim();
      if (!providerModelId) {
        continue;
      }
      bindings.push(
        bindingFromConfig({
          model,
          interfaceId: iface.id,
          channelKind: "aggregate",
          config,
          providerModelId,
          group,
        })
      );
    }

    for (const iface of params.singleModelInterfaces) {
      const config = iface.models[model.canonicalId];
      if (!config) {
        continue;
      }
      const upstreamModelId = config.upstreamModelId?.trim();
      if (!upstreamModelId) {
        continue;
      }
      bindings.push(
        bindingFromConfig({
          model,
          interfaceId: iface.id,
          channelKind: "api",
          config,
          providerModelId: upstreamModelId,
          group,
        })
      );
    }
  }

  return bindings;
}
