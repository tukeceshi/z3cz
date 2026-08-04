export type OrgModelChannelKind = "aggregate" | "api";

export function buildOrgModelOptionId(
  interfaceId: string,
  canonicalId: string
): string {
  return `${interfaceId}:${canonicalId}`;
}

export function parseOrgModelOptionId(optionId: string): {
  readonly interfaceId: string;
  readonly canonicalId: string;
} | null {
  const separatorIndex = optionId.indexOf(":");
  if (separatorIndex <= 0 || separatorIndex >= optionId.length - 1) {
    return null;
  }
  return {
    interfaceId: optionId.slice(0, separatorIndex),
    canonicalId: optionId.slice(separatorIndex + 1),
  };
}

export function resolveInterfaceModelAlias(params: {
  readonly alias: string | undefined;
  readonly platformDisplayName: string;
}): string {
  const trimmed = params.alias?.trim();
  if (trimmed && trimmed.length > 0) {
    return trimmed;
  }
  return params.platformDisplayName;
}

export function formatCanvasModelLabel(params: {
  readonly channelKind: OrgModelChannelKind;
  readonly alias: string;
}): string {
  const prefix = params.channelKind === "aggregate" ? "聚合" : "API";
  return `[${prefix}] ${params.alias}`;
}

export interface OrgModelBindingPickRef {
  readonly canonicalId: string;
  readonly interfaceId: string;
  readonly selectable: boolean;
}

/** Resolve ai_interface_id for legacy nodes that only stored model. */
export function pickLegacyOrgModelInterfaceId<T extends OrgModelBindingPickRef>(
  bindings: readonly T[],
  canonicalId: string,
  preferredInterfaceId?: string
): string | undefined {
  const modelId = canonicalId.trim();
  if (!modelId) {
    return undefined;
  }

  const matches = bindings.filter(
    (entry) => entry.canonicalId === modelId && entry.selectable
  );
  if (matches.length === 0) {
    return undefined;
  }

  const preferredId = preferredInterfaceId?.trim();
  if (preferredId) {
    const preferred = matches.find((entry) => entry.interfaceId === preferredId);
    if (preferred) {
      return preferred.interfaceId;
    }
  }

  if (matches.length === 1) {
    return matches[0]!.interfaceId;
  }

  return undefined;
}
