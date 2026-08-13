import {
  resolveForwardingVideoSize,
  type ForwardingLockedResolution,
} from "./forwarding-video-size";

export const FORMAT_TRANSFORM_PROVIDERS = ["seedance"] as const;

export {
  FORWARDING_LOCKED_RESOLUTIONS,
  FORWARDING_VIDEO_ASPECT_RATIOS,
  FORWARDING_VIDEO_SIZE_TABLE,
  resolveForwardingVideoSize,
} from "./forwarding-video-size";
export type {
  ForwardingLockedResolution,
  ForwardingVideoAspectRatio,
  ForwardingVideoResolutionTier,
} from "./forwarding-video-size";

export type FormatTransformProvider =
  (typeof FORMAT_TRANSFORM_PROVIDERS)[number];

/** @deprecated Use FormatTransformProvider */
export type ApiFormatForwardingProvider = FormatTransformProvider;

/** @deprecated Use FORMAT_TRANSFORM_PROVIDERS */
export const API_FORMAT_FORWARDING_PROVIDERS = FORMAT_TRANSFORM_PROVIDERS;

export type FormatTransformScope = "platform";

export type TransformParamValueType =
  | "string"
  | "number"
  | "boolean"
  | "string[]"
  | "object[]";

/** @deprecated Use TransformParamValueType */
export type ForwardingParamValueType = TransformParamValueType;

export type TransformCollectMode = "first" | "all";

/** @deprecated Use TransformCollectMode */
export type ForwardingCollectMode = TransformCollectMode;

export type TransformMappingTransform = "ratio_resolution_to_size";

/** @deprecated Use TransformMappingTransform */
export type ForwardingMappingTransform = TransformMappingTransform;

export interface TransformUpstreamParam {
  readonly id: string;
  readonly name: string;
  readonly valueType: TransformParamValueType;
}

/** @deprecated Use TransformUpstreamParam */
export type ForwardingUpstreamParam = TransformUpstreamParam;

export interface TransformParamMapping {
  readonly upstreamParamId: string;
  readonly sourcePath?: string;
  readonly collectMode?: TransformCollectMode;
  readonly transform?: TransformMappingTransform;
}

/** @deprecated Use TransformParamMapping */
export type ForwardingParamMapping = TransformParamMapping;

export interface TransformStandardSchemaNode {
  readonly id: string;
  readonly label: string;
  readonly path: string;
  readonly valueType: TransformParamValueType;
  readonly example: unknown;
  readonly mappingTransform?: TransformMappingTransform;
  readonly children?: readonly TransformStandardSchemaNode[];
}

/** @deprecated Use TransformStandardSchemaNode */
export type StandardSchemaNode = TransformStandardSchemaNode;

export interface FormatTransformTemplate {
  readonly id: string;
  readonly name: string;
  readonly provider: FormatTransformProvider;
  readonly scope: FormatTransformScope;
  readonly upstreamParams: readonly TransformUpstreamParam[];
  readonly paramMappings: readonly TransformParamMapping[];
  readonly lockedResolution: ForwardingLockedResolution | null;
  readonly supportsTaskCancel: boolean;
  readonly enabled: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly updatedBy: string | null;
}

export interface FormatTransformConfig {
  readonly upstreamParams: readonly TransformUpstreamParam[];
  readonly paramMappings: readonly TransformParamMapping[];
  readonly lockedResolution?: ForwardingLockedResolution | null;
}

/** Org-owned format transform snapshot copied from a platform template. */
export interface SingleModelFormatTransform {
  readonly sourceTemplateId: string;
  readonly upstreamParams: readonly TransformUpstreamParam[];
  readonly paramMappings: readonly TransformParamMapping[];
  readonly lockedResolution?: ForwardingLockedResolution | null;
}

export function singleModelFormatTransformFromTemplate(
  template: Pick<
    FormatTransformTemplate,
    "id" | "upstreamParams" | "paramMappings" | "lockedResolution"
  >
): SingleModelFormatTransform {
  return {
    sourceTemplateId: template.id,
    upstreamParams: template.upstreamParams,
    paramMappings: template.paramMappings,
    ...(template.lockedResolution
      ? { lockedResolution: template.lockedResolution }
      : {}),
  };
}

export function singleModelFormatTransformToConfig(
  transform: SingleModelFormatTransform
): FormatTransformConfig {
  return {
    upstreamParams: transform.upstreamParams,
    paramMappings: transform.paramMappings,
    ...(transform.lockedResolution !== undefined
      ? { lockedResolution: transform.lockedResolution }
      : {}),
  };
}

export interface ListFormatTransformTemplatesResponse {
  readonly templates: readonly FormatTransformTemplate[];
}

export interface GetFormatTransformTemplateResponse {
  readonly template: FormatTransformTemplate;
}

export interface CreateFormatTransformTemplateRequest {
  readonly name: string;
  readonly provider: FormatTransformProvider;
  readonly upstreamParams?: readonly TransformUpstreamParam[];
  readonly paramMappings?: readonly TransformParamMapping[];
  readonly lockedResolution?: ForwardingLockedResolution | null;
  readonly supportsTaskCancel?: boolean;
  readonly enabled?: boolean;
}

export interface UpdateFormatTransformTemplateRequest {
  readonly name?: string;
  readonly provider?: FormatTransformProvider;
  readonly upstreamParams?: readonly TransformUpstreamParam[];
  readonly paramMappings?: readonly TransformParamMapping[];
  readonly lockedResolution?: ForwardingLockedResolution | null;
  readonly supportsTaskCancel?: boolean;
  readonly enabled?: boolean;
}

export const VIDEO_TRANSFORM_STANDARD_SCHEMA: readonly TransformStandardSchemaNode[] =
  [
    {
      id: "model",
      label: "模型",
      path: "$.model",
      valueType: "string",
      example: "doubao-seedance-2",
    },
    {
      id: "prompt",
      label: "提示词",
      path: "$.content[?(@.type=='text')].text",
      valueType: "string",
      example: { content: [{ type: "text", text: "一剑开天门" }] },
    },
    {
      id: "first_frame",
      label: "首帧",
      path: "$.content[?(@.role=='first_frame')].image_url.url",
      valueType: "string",
      example: {
        content: [
          {
            type: "image_url",
            image_url: { url: "https://example.com/first.png" },
            role: "first_frame",
          },
        ],
      },
    },
    {
      id: "last_frame",
      label: "尾帧",
      path: "$.content[?(@.role=='last_frame')].image_url.url",
      valueType: "string",
      example: {
        content: [
          {
            type: "image_url",
            image_url: { url: "https://example.com/last.png" },
            role: "last_frame",
          },
        ],
      },
    },
    {
      id: "generate_audio",
      label: "生成音频",
      path: "$.generate_audio",
      valueType: "boolean",
      example: true,
    },
    {
      id: "ratio",
      label: "画面比例",
      path: "$.ratio",
      valueType: "string",
      example: "16:9",
    },
    {
      id: "duration",
      label: "时长",
      path: "$.duration",
      valueType: "string",
      example: "10",
    },
    {
      id: "resolution",
      label: "分辨率",
      path: "$.resolution",
      valueType: "string",
      example: "720p",
    },
    {
      id: "size",
      label: "尺寸（比例+分辨率换算）",
      path: "$.ratio + $.resolution",
      valueType: "string",
      mappingTransform: "ratio_resolution_to_size",
      example: { ratio: "16:9", resolution: "720p" },
    },
    {
      id: "reference_images_string",
      label: "参考图（纯链接数组）",
      path: "$.content[?(@.role=='reference_image')].image_url.url",
      valueType: "string[]",
      example: {
        content: [
          {
            type: "image_url",
            image_url: { url: "https://example.com/ref.png" },
            role: "reference_image",
          },
        ],
      },
    },
    {
      id: "reference_images_object",
      label: "参考图（url 对象数组）",
      path: "$.content[?(@.role=='reference_image')].image_url.url",
      valueType: "object[]",
      example: {
        content: [
          {
            type: "image_url",
            image_url: { url: "https://example.com/ref.png" },
            role: "reference_image",
          },
        ],
      },
    },
    {
      id: "reference_video_string",
      label: "视频参考（纯链接数组）",
      path: "$.content[?(@.role=='reference_video')].video_url.url",
      valueType: "string[]",
      example: {
        content: [
          {
            type: "video_url",
            video_url: { url: "https://example.com/ref.mp4" },
            role: "reference_video",
          },
        ],
      },
    },
    {
      id: "reference_video_object",
      label: "视频参考（url 对象数组）",
      path: "$.content[?(@.role=='reference_video')].video_url.url",
      valueType: "object[]",
      example: {
        content: [
          {
            type: "video_url",
            video_url: { url: "https://example.com/ref.mp4" },
            role: "reference_video",
          },
        ],
      },
    },
    {
      id: "reference_audio_string",
      label: "音频参考（纯链接数组）",
      path: "$.content[?(@.role=='reference_audio')].audio_url.url",
      valueType: "string[]",
      example: {
        content: [
          {
            type: "audio_url",
            audio_url: { url: "https://example.com/ref.mp3" },
            role: "reference_audio",
          },
        ],
      },
    },
    {
      id: "reference_audio_object",
      label: "音频参考（url 对象数组）",
      path: "$.content[?(@.role=='reference_audio')].audio_url.url",
      valueType: "object[]",
      example: {
        content: [
          {
            type: "audio_url",
            audio_url: { url: "https://example.com/ref.mp3" },
            role: "reference_audio",
          },
        ],
      },
    },
  ] as const;

/** @deprecated Use VIDEO_TRANSFORM_STANDARD_SCHEMA */
export const VIDEO_FORWARDING_STANDARD_SCHEMA = VIDEO_TRANSFORM_STANDARD_SCHEMA;

export function getTransformStandardSchema(
  provider: FormatTransformProvider
): readonly TransformStandardSchemaNode[] {
  return VIDEO_TRANSFORM_STANDARD_SCHEMA;
}

/** @deprecated Use getTransformStandardSchema */
export function getForwardingStandardSchema(
  provider: FormatTransformProvider
): readonly TransformStandardSchemaNode[] {
  return getTransformStandardSchema(provider);
}

interface SeedanceTransformExampleEntry {
  readonly name: string;
  readonly valueType: TransformParamValueType;
  readonly schemaNodeId?: string;
  readonly collectMode?: TransformCollectMode;
  readonly transform?: TransformMappingTransform;
}

const SEEDANCE_TRANSFORM_EXAMPLE_ENTRIES: readonly SeedanceTransformExampleEntry[] =
  [
    { name: "prompt", valueType: "string", schemaNodeId: "prompt" },
    { name: "seconds", valueType: "string", schemaNodeId: "duration" },
    {
      name: "size",
      valueType: "string",
      transform: "ratio_resolution_to_size",
    },
    { name: "aspect_ratio", valueType: "string", schemaNodeId: "ratio" },
    { name: "resolution", valueType: "string", schemaNodeId: "resolution" },
    {
      name: "images",
      valueType: "object[]",
      schemaNodeId: "reference_images_object",
      collectMode: "all",
    },
    { name: "first_frame", valueType: "string", schemaNodeId: "first_frame" },
    { name: "last_frame", valueType: "string", schemaNodeId: "last_frame" },
    {
      name: "reference_video",
      valueType: "object[]",
      schemaNodeId: "reference_video_object",
      collectMode: "all",
    },
    {
      name: "reference_audio",
      valueType: "object[]",
      schemaNodeId: "reference_audio_object",
      collectMode: "all",
    },
    {
      name: "generate_audio",
      valueType: "boolean",
      schemaNodeId: "generate_audio",
    },
    { name: "model", valueType: "string", schemaNodeId: "model" },
  ] as const;

export function resolveSuggestedUpstreamParamName(
  schemaNodeId: string
): string | undefined {
  return SEEDANCE_TRANSFORM_EXAMPLE_ENTRIES.find(
    (entry) => entry.schemaNodeId === schemaNodeId
  )?.name;
}

function findSchemaPath(schemaNodeId: string): string {
  const node = VIDEO_TRANSFORM_STANDARD_SCHEMA.find(
    (entry) => entry.id === schemaNodeId
  );
  if (!node) {
    throw new Error(`Unknown schema node: ${schemaNodeId}`);
  }
  return node.path;
}

export function buildSeedanceTransformExamplePreset(): {
  readonly upstreamParams: readonly TransformUpstreamParam[];
  readonly paramMappings: readonly TransformParamMapping[];
} {
  const upstreamParams: TransformUpstreamParam[] = [];
  const paramMappings: TransformParamMapping[] = [];

  for (const entry of SEEDANCE_TRANSFORM_EXAMPLE_ENTRIES) {
    const id = crypto.randomUUID();
    upstreamParams.push({
      id,
      name: entry.name,
      valueType: entry.valueType,
    });
    paramMappings.push({
      upstreamParamId: id,
      ...(entry.transform
        ? { transform: entry.transform }
        : { sourcePath: findSchemaPath(entry.schemaNodeId!) }),
      ...(entry.collectMode ? { collectMode: entry.collectMode } : {}),
    });
  }

  return { upstreamParams, paramMappings };
}

/** @deprecated Use buildSeedanceTransformExamplePreset */
export function buildSeedanceForwardingExamplePreset() {
  return buildSeedanceTransformExamplePreset();
}

export function isTransformMappingConfigComplete(
  upstreamParams: readonly TransformUpstreamParam[],
  paramMappings: readonly TransformParamMapping[]
): boolean {
  if (upstreamParams.length === 0) {
    return false;
  }

  const mappingByParamId = new Map(
    paramMappings.map((mapping) => [mapping.upstreamParamId, mapping])
  );

  return upstreamParams.every((param) => {
    const mapping = mappingByParamId.get(param.id);
    if (!mapping) {
      return false;
    }
    if (mapping.transform === "ratio_resolution_to_size") {
      return true;
    }
    return Boolean(mapping.sourcePath?.trim());
  });
}

/** @deprecated Use isTransformMappingConfigComplete */
export function isForwardingMappingConfigComplete(
  upstreamParams: readonly TransformUpstreamParam[],
  paramMappings: readonly TransformParamMapping[]
): boolean {
  return isTransformMappingConfigComplete(upstreamParams, paramMappings);
}

export interface FormatTransformTemplateRuleMapping {
  readonly upstreamParamName: string;
  readonly sourceLabel: string;
}

export interface FormatTransformTemplateRulesDescription {
  readonly mappings: readonly FormatTransformTemplateRuleMapping[];
}

const TRANSFORM_MAPPING_LABELS: Readonly<
  Record<TransformMappingTransform, string>
> = {
  ratio_resolution_to_size: "比例+分辨率 → 尺寸",
};

function findSchemaLabelBySourcePath(
  sourcePath: string,
  valueType?: TransformParamValueType
): string | null {
  const node = VIDEO_TRANSFORM_STANDARD_SCHEMA.find((entry) => {
    if (entry.path !== sourcePath) {
      return false;
    }
    return valueType ? entry.valueType === valueType : true;
  });
  return node?.label ?? null;
}

export function findTransformSchemaNodeById(
  schemaNodeId: string
): TransformStandardSchemaNode | undefined {
  return VIDEO_TRANSFORM_STANDARD_SCHEMA.find(
    (entry) => entry.id === schemaNodeId
  );
}

export function findTransformSchemaNodeForMapping(
  mapping: TransformParamMapping,
  schema: readonly TransformStandardSchemaNode[] = VIDEO_TRANSFORM_STANDARD_SCHEMA,
  valueType?: TransformParamValueType
): TransformStandardSchemaNode | null {
  if (mapping.transform) {
    return (
      schema.find((entry) => entry.mappingTransform === mapping.transform) ??
      null
    );
  }
  const sourcePath = mapping.sourcePath?.trim();
  if (!sourcePath) {
    return null;
  }
  return (
    schema.find((entry) => {
      if (entry.path !== sourcePath) {
        return false;
      }
      return valueType ? entry.valueType === valueType : true;
    }) ?? null
  );
}

export function isTransformCollectAllValueType(
  valueType: TransformParamValueType
): boolean {
  return valueType === "string[]" || valueType === "object[]";
}

function wrapTransformExampleSourceBody(
  node: TransformStandardSchemaNode
): Record<string, unknown> {
  const { example } = node;
  if (node.mappingTransform === "ratio_resolution_to_size") {
    return example as Record<string, unknown>;
  }
  if (example !== null && typeof example === "object" && "content" in example) {
    return example as Record<string, unknown>;
  }
  const rootKeyMatch = node.path.match(/^\$\.([A-Za-z0-9_]+)/);
  if (rootKeyMatch?.[1]) {
    return { [rootKeyMatch[1]]: example };
  }
  return { value: example };
}

function extractTransformDisplayValue(
  sourceBody: Record<string, unknown>,
  node: TransformStandardSchemaNode
): unknown {
  if (node.mappingTransform === "ratio_resolution_to_size") {
    return resolveForwardingVideoSize({
      sourceBody,
      lockedResolution: null,
    });
  }

  const collectAll = isTransformCollectAllValueType(node.valueType);

  if (node.path.includes("content[?(@.type=='text')].text")) {
    const content = sourceBody.content;
    if (!Array.isArray(content)) {
      return undefined;
    }
    const values = content
      .filter(
        (item): item is Record<string, unknown> =>
          typeof item === "object" &&
          item !== null &&
          item.type === "text" &&
          item.text !== undefined &&
          item.text !== null
      )
      .map((item) => item.text);
    return collectAll ? values : values[0];
  }

  const roleMatch = node.path.match(/role=='([^']+)'/);
  if (roleMatch && node.path.includes("content")) {
    const role = roleMatch[1];
    const urlField = node.path.includes("image_url")
      ? "image_url"
      : node.path.includes("video_url")
        ? "video_url"
        : "audio_url";
    const content = sourceBody.content;
    if (!Array.isArray(content)) {
      return undefined;
    }
    const values = content
      .filter(
        (item): item is Record<string, unknown> =>
          typeof item === "object" && item !== null && item.role === role
      )
      .map((item) => {
        const media = item[urlField];
        if (typeof media === "object" && media !== null && "url" in media) {
          return (media as { url: unknown }).url;
        }
        return undefined;
      })
      .filter((url) => url !== undefined);
    return collectAll ? values : values[0];
  }

  const rootKeyMatch = node.path.match(/^\$\.([A-Za-z0-9_]+)/);
  if (rootKeyMatch?.[1]) {
    return sourceBody[rootKeyMatch[1]];
  }

  return undefined;
}

function coerceTransformDisplayValue(
  value: unknown,
  valueType: TransformParamValueType
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

/** Preview-only upstream value for mapping editor display. */
export function resolveTransformUpstreamDisplayExample(
  node: TransformStandardSchemaNode
): unknown {
  const sourceBody = wrapTransformExampleSourceBody(node);
  const raw = extractTransformDisplayValue(sourceBody, node);
  return coerceTransformDisplayValue(raw, node.valueType);
}

export function buildTransformParamMappingFromSchemaNode(
  upstreamParamId: string,
  node: TransformStandardSchemaNode
): TransformParamMapping {
  if (node.mappingTransform) {
    return {
      upstreamParamId,
      transform: node.mappingTransform,
    };
  }
  return {
    upstreamParamId,
    sourcePath: node.path,
    ...(isTransformCollectAllValueType(node.valueType)
      ? { collectMode: "all" as const }
      : {}),
  };
}

export function resolveTransformMappingLabel(
  mapping: TransformParamMapping | undefined,
  schema: readonly TransformStandardSchemaNode[] = VIDEO_TRANSFORM_STANDARD_SCHEMA,
  valueType?: TransformParamValueType
): string | null {
  if (!mapping) {
    return null;
  }
  if (mapping.transform) {
    return (
      TRANSFORM_MAPPING_LABELS[mapping.transform] ?? mapping.transform
    );
  }
  const sourcePath = mapping.sourcePath?.trim();
  if (!sourcePath) {
    return null;
  }
  return findSchemaLabelBySourcePath(sourcePath, valueType);
}

export function describeFormatTransformTemplateRules(
  template: Pick<
    FormatTransformTemplate,
    "upstreamParams" | "paramMappings"
  >
): FormatTransformTemplateRulesDescription {
  const mappingByParamId = new Map(
    template.paramMappings.map((mapping) => [mapping.upstreamParamId, mapping])
  );
  const mappings: FormatTransformTemplateRuleMapping[] = [];

  for (const param of template.upstreamParams) {
    const mapping = mappingByParamId.get(param.id);
    if (!mapping) {
      continue;
    }

    let sourceLabel: string | null = null;
    if (mapping.transform) {
      sourceLabel = TRANSFORM_MAPPING_LABELS[mapping.transform] ?? mapping.transform;
    } else {
      const sourcePath = mapping.sourcePath?.trim();
      if (sourcePath) {
        sourceLabel =
          findSchemaLabelBySourcePath(sourcePath, param.valueType) ??
          sourcePath;
      }
    }

    if (!sourceLabel) {
      continue;
    }

    mappings.push({
      upstreamParamName: param.name,
      sourceLabel,
    });
  }

  return {
    mappings,
  };
}
