import type { AiModelModality } from "./ai-model-catalog";
import type {
  SingleModelCapabilityLimits,
  SingleModelFormatTransform,
} from "./single-model-interface-metadata";

/** Unified org model record stored in interface metadata.models[instanceId]. */
export interface OrgModelInstanceConfig {
  readonly canonicalId: string;
  readonly enabled: boolean;
  readonly upstreamModelId: string;
  readonly modality: AiModelModality;
  readonly alias?: string;
  readonly capabilityLimits?: SingleModelCapabilityLimits;
  readonly formatTransform?: SingleModelFormatTransform;
}

export interface OrgModelInstanceEntry {
  readonly instanceId: string;
  readonly canonicalId: string;
  readonly config: OrgModelInstanceConfig;
}

function readTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Normalize legacy volcano (providerModelId) and single-model shapes on read. */
export function normalizeOrgModelInstanceConfig(
  instanceId: string,
  raw: unknown
): OrgModelInstanceConfig | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const upstreamModelId =
    readTrimmedString(record.upstreamModelId) ||
    readTrimmedString(record.providerModelId);
  const canonicalId =
    readTrimmedString(record.canonicalId) || instanceId.trim();
  const modality = record.modality;
  if (
    !canonicalId ||
    (modality !== "text" &&
      modality !== "image" &&
      modality !== "video" &&
      modality !== "audio")
  ) {
    return null;
  }

  return {
    canonicalId,
    enabled: record.enabled === true,
    upstreamModelId,
    modality,
    ...(readTrimmedString(record.alias)
      ? { alias: readTrimmedString(record.alias) }
      : {}),
    ...(record.capabilityLimits &&
    typeof record.capabilityLimits === "object"
      ? {
          capabilityLimits:
            record.capabilityLimits as SingleModelCapabilityLimits,
        }
      : {}),
    ...(record.formatTransform && typeof record.formatTransform === "object"
      ? {
          formatTransform: record.formatTransform as SingleModelFormatTransform,
        }
      : {}),
  };
}

export function readOrgModelUpstreamId(
  config: Pick<OrgModelInstanceConfig, "upstreamModelId"> | null | undefined
): string {
  return config?.upstreamModelId?.trim() ?? "";
}

export function orgModelInstanceEntry(
  instanceId: string,
  raw: unknown
): OrgModelInstanceEntry | null {
  const config = normalizeOrgModelInstanceConfig(instanceId, raw);
  if (!config) {
    return null;
  }
  return {
    instanceId,
    canonicalId: config.canonicalId,
    config,
  };
}

export function listOrgModelEntries(
  models: Readonly<Record<string, unknown>>
): readonly OrgModelInstanceEntry[] {
  return Object.entries(models).flatMap(([instanceId, raw]) => {
    const entry = orgModelInstanceEntry(instanceId, raw);
    return entry ? [entry] : [];
  });
}

export function normalizeOrgModelInstancesMap(
  models: Readonly<Record<string, unknown>>
): Record<string, OrgModelInstanceConfig> {
  return Object.fromEntries(
    Object.entries(models).flatMap(([instanceId, raw]) => {
      const config = normalizeOrgModelInstanceConfig(instanceId, raw);
      return config ? [[instanceId, config] as const] : [];
    })
  );
}

export function findOrgModelInstanceEntry(
  entries: readonly OrgModelInstanceEntry[],
  params: {
    readonly canonicalId?: string;
    readonly instanceId?: string;
    readonly enabledOnly?: boolean;
  }
): OrgModelInstanceEntry | null {
  const instanceId = params.instanceId?.trim();
  if (instanceId) {
    const byInstance = entries.find((entry) => entry.instanceId === instanceId);
    if (!byInstance) {
      return null;
    }
    if (params.enabledOnly && !byInstance.config.enabled) {
      return null;
    }
    return byInstance;
  }

  const canonicalId = params.canonicalId?.trim();
  if (!canonicalId) {
    return null;
  }

  for (const entry of entries) {
    if (entry.canonicalId !== canonicalId) {
      continue;
    }
    if (params.enabledOnly && !entry.config.enabled) {
      continue;
    }
    return entry;
  }

  return null;
}

export function findEnabledOrgModelInstanceByCanonicalId(
  entries: readonly OrgModelInstanceEntry[],
  canonicalId: string
): OrgModelInstanceEntry | null {
  return findOrgModelInstanceEntry(entries, { canonicalId, enabledOnly: true });
}

/** @deprecated Use listOrgModelEntries */
export function listVolcanoModelEntries(
  models: Readonly<Record<string, unknown>>
): readonly OrgModelInstanceEntry[] {
  return listOrgModelEntries(models);
}

/** @deprecated Use listOrgModelEntries */
export function listSingleModelInstanceEntries(metadata: {
  readonly models: Readonly<Record<string, unknown>>;
}): readonly OrgModelInstanceEntry[] {
  return listOrgModelEntries(metadata.models);
}
