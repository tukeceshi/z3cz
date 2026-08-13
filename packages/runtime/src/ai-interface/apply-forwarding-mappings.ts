import type {
  ForwardingCollectMode,
  ForwardingLockedResolution,
  ForwardingParamMapping,
  ForwardingParamValueType,
  ForwardingUpstreamParam,
} from "@dafthunk/types";
import {
  isTransformCollectAllValueType,
  resolveForwardingVideoSize,
} from "@dafthunk/types";
import { JSONPath } from "jsonpath-plus";

export function extractForwardingValue(params: {
  readonly source: unknown;
  readonly sourcePath: string;
  readonly collectMode: ForwardingCollectMode;
}): unknown {
  const results = JSONPath({
    path: params.sourcePath,
    json: params.source as object,
    wrap: false,
  });

  if (params.collectMode === "all") {
    if (results === undefined || results === null) {
      return [];
    }
    return Array.isArray(results) ? results : [results];
  }

  if (Array.isArray(results)) {
    return results[0];
  }

  return results;
}

function coerceForwardingValue(
  value: unknown,
  valueType: ForwardingParamValueType
): unknown {
  if (value === undefined || value === null) {
    return undefined;
  }

  switch (valueType) {
    case "string":
      return String(value);
    case "number": {
      const numeric = typeof value === "number" ? value : Number(value);
      return Number.isFinite(numeric) ? numeric : undefined;
    }
    case "boolean":
      return value === true || value === "true" || value === 1;
    case "string[]": {
      if (Array.isArray(value)) {
        return value.map((entry) => String(entry));
      }
      return [String(value)];
    }
    case "object[]": {
      const urls = Array.isArray(value)
        ? value.map((entry) => String(entry))
        : [String(value)];
      return urls.map((url) => ({ url }));
    }
    default:
      return value;
  }
}

function shouldOmitMappedValue(value: unknown): boolean {
  if (value === undefined || value === null) {
    return true;
  }
  if (value === "") {
    return true;
  }
  if (Array.isArray(value) && value.length === 0) {
    return true;
  }
  return false;
}

export function applyForwardingMappings(params: {
  readonly sourceBody: unknown;
  readonly upstreamParams: readonly ForwardingUpstreamParam[];
  readonly paramMappings: readonly ForwardingParamMapping[];
  readonly lockedResolution?: ForwardingLockedResolution | null;
}): Record<string, unknown> {
  const mappingByParamId = new Map(
    params.paramMappings.map((mapping) => [mapping.upstreamParamId, mapping])
  );

  const output: Record<string, unknown> = {};

  for (const upstreamParam of params.upstreamParams) {
    const mapping = mappingByParamId.get(upstreamParam.id);
    if (!mapping) {
      continue;
    }

    if (mapping.transform === "ratio_resolution_to_size") {
      const size = resolveForwardingVideoSize({
        sourceBody: params.sourceBody,
        lockedResolution: params.lockedResolution ?? null,
      });
      if (!shouldOmitMappedValue(size)) {
        output[upstreamParam.name] = size;
      }
      continue;
    }

    if (!mapping.sourcePath?.trim()) {
      continue;
    }

    const raw = extractForwardingValue({
      source: params.sourceBody,
      sourcePath: mapping.sourcePath,
      collectMode: isTransformCollectAllValueType(upstreamParam.valueType)
          ? (mapping.collectMode ?? "all")
          : (mapping.collectMode ?? "first"),
    });

    const coerced = coerceForwardingValue(raw, upstreamParam.valueType);
    if (shouldOmitMappedValue(coerced)) {
      continue;
    }

    output[upstreamParam.name] = coerced;
  }

  return output;
}
