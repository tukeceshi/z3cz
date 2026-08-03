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
