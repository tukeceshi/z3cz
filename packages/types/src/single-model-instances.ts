import type { AiModelModality } from "./ai-model-catalog";
import type { OrgModelInstanceConfig } from "./org-model-instance";
import type {
  SingleModelCapabilityLimits,
  SingleModelFormatTransform,
  SingleModelProviderMetadata,
} from "./single-model-interface-metadata";

export interface SingleModelInstanceDraft {
  readonly instanceId: string;
  readonly canonicalId: string;
  readonly displayName: string;
  readonly modality: AiModelModality;
  readonly upstreamModelId: string;
  readonly enabled: boolean;
  readonly formatTransform?: SingleModelFormatTransform | null;
  readonly capabilityLimits?: SingleModelCapabilityLimits | null;
}

export function createSingleModelInstanceId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sm-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Map key is instanceId; canonicalId lives on config. */
export function singleModelInstanceCanonicalId(
  instanceId: string,
  config: Pick<OrgModelInstanceConfig, "canonicalId">
): string {
  return config.canonicalId.trim() || instanceId;
}

export function listSingleModelMetadataEntries(
  metadata: SingleModelProviderMetadata
): readonly {
  readonly instanceId: string;
  readonly config: OrgModelInstanceConfig;
  readonly canonicalId: string;
}[] {
  return Object.entries(metadata.models).map(([instanceId, config]) => ({
    instanceId,
    config,
    canonicalId: singleModelInstanceCanonicalId(instanceId, config),
  }));
}

export function findSingleModelInstanceByCanonicalId(
  metadata: SingleModelProviderMetadata,
  canonicalId: string,
  params?: { readonly enabledOnly?: boolean }
): { readonly instanceId: string; readonly config: OrgModelInstanceConfig } | null {
  const target = canonicalId.trim();
  if (!target) {
    return null;
  }

  for (const entry of listSingleModelMetadataEntries(metadata)) {
    if (entry.canonicalId !== target) {
      continue;
    }
    if (params?.enabledOnly && !entry.config.enabled) {
      continue;
    }
    return { instanceId: entry.instanceId, config: entry.config };
  }

  return null;
}

export function findEnabledSingleModelInstanceByCanonicalId(
  metadata: SingleModelProviderMetadata,
  canonicalId: string
): { readonly instanceId: string; readonly config: OrgModelInstanceConfig } | null {
  return findSingleModelInstanceByCanonicalId(metadata, canonicalId, {
    enabledOnly: true,
  });
}

export function singleModelInstancesFromMetadata(
  metadata: SingleModelProviderMetadata,
  labelForCanonicalId: (canonicalId: string) => string
): SingleModelInstanceDraft[] {
  return listSingleModelMetadataEntries(metadata).map(
    ({ instanceId, config, canonicalId }) => ({
      instanceId,
      canonicalId,
      displayName:
        config.alias?.trim() || labelForCanonicalId(canonicalId),
      modality: config.modality,
      upstreamModelId: config.upstreamModelId,
      enabled: config.enabled,
      formatTransform: config.formatTransform ?? null,
      capabilityLimits: config.capabilityLimits ?? null,
    })
  );
}

export function createSingleModelInstanceDraft(params: {
  readonly canonicalId: string;
  readonly displayName: string;
  readonly modality: AiModelModality;
  readonly upstreamModelId?: string;
  readonly enabled?: boolean;
}): SingleModelInstanceDraft {
  return {
    instanceId: createSingleModelInstanceId(),
    canonicalId: params.canonicalId,
    displayName: params.displayName,
    modality: params.modality,
    upstreamModelId: params.upstreamModelId?.trim() ?? "",
    enabled: params.enabled ?? true,
  };
}

function singleModelAliasFromDisplayName(
  displayName: string
): string | undefined {
  const trimmed = displayName.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function buildSingleModelModelsMapFromInstances(
  instances: readonly SingleModelInstanceDraft[]
): Record<string, OrgModelInstanceConfig> {
  return Object.fromEntries(
    instances.map((instance) => [
      instance.instanceId,
      {
        canonicalId: instance.canonicalId,
        enabled: instance.enabled,
        upstreamModelId: instance.upstreamModelId.trim(),
        modality: instance.modality,
        ...(singleModelAliasFromDisplayName(instance.displayName)
          ? { alias: singleModelAliasFromDisplayName(instance.displayName) }
          : {}),
        ...(instance.capabilityLimits
          ? { capabilityLimits: instance.capabilityLimits }
          : {}),
        ...(instance.formatTransform
          ? { formatTransform: instance.formatTransform }
          : {}),
      },
    ])
  );
}

export function replaceSingleModelModels(
  metadata: SingleModelProviderMetadata,
  instances: readonly SingleModelInstanceDraft[]
): SingleModelProviderMetadata {
  return {
    ...metadata,
    models: buildSingleModelModelsMapFromInstances(instances),
  };
}

export function applySharedFormatTransformToVideoInstances(
  instances: readonly SingleModelInstanceDraft[],
  formatTransform: SingleModelFormatTransform | null
): SingleModelInstanceDraft[] {
  return instances.map((instance) =>
    instance.modality === "video"
      ? { ...instance, formatTransform }
      : instance
  );
}

function areFormatTransformsEqual(
  left: SingleModelFormatTransform,
  right: SingleModelFormatTransform
): boolean {
  return (
    left.sourceTemplateId === right.sourceTemplateId &&
    JSON.stringify(left.upstreamParams) === JSON.stringify(right.upstreamParams) &&
    JSON.stringify(left.paramMappings) === JSON.stringify(right.paramMappings)
  );
}

export function resolveSharedFormatTransformFromInstanceDrafts(
  instances: readonly SingleModelInstanceDraft[]
): SingleModelFormatTransform | null {
  const transforms = instances
    .filter((instance) => instance.modality === "video")
    .map((instance) => instance.formatTransform)
    .filter((transform): transform is SingleModelFormatTransform =>
      Boolean(transform?.sourceTemplateId?.trim())
    );

  if (transforms.length === 0) {
    return null;
  }

  const [first, ...rest] = transforms;
  if (rest.every((transform) => areFormatTransformsEqual(transform, first))) {
    return first;
  }

  return null;
}

export function prepareSingleModelInstancesForSave(params: {
  readonly instances: readonly SingleModelInstanceDraft[];
  readonly sharedFormatTransform: SingleModelFormatTransform | null;
  readonly capabilityLimitsByInstanceId: Readonly<
    Record<string, SingleModelCapabilityLimits | null>
  >;
  readonly applyCustomVideoRules: boolean;
}): SingleModelInstanceDraft[] {
  const withLimits = params.instances.map((instance) => ({
    ...instance,
    capabilityLimits:
      params.capabilityLimitsByInstanceId[instance.instanceId] ??
      instance.capabilityLimits ??
      null,
  }));

  if (!params.applyCustomVideoRules) {
    return withLimits.map((instance) => ({
      ...instance,
      formatTransform: null,
    }));
  }

  return applySharedFormatTransformToVideoInstances(
    withLimits,
    params.sharedFormatTransform
  );
}
