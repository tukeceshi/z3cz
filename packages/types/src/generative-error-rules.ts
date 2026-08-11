import {
  AI_AUDIO_NODE_TYPE,
  AI_IMAGE_NODE_TYPE,
  AI_TEXT_NODE_TYPE,
  AI_VIDEO_NODE_TYPE,
} from "./ai-interface";

export type GenerativeModelKind = "text" | "image" | "video" | "audio";

export type GenerativeErrorLocale = "zh" | "en";

export type GenerativeErrorAppliesTo = "all" | readonly GenerativeModelKind[];

export interface GenerativeErrorRule {
  readonly id: string;
  readonly pattern: RegExp;
  readonly zh: string;
  readonly en: string;
  readonly i18nKey?: string;
  readonly appliesTo: GenerativeErrorAppliesTo;
}

export interface MatchedGenerativeErrorRule {
  readonly id: string;
  readonly message: string;
  readonly cardLines?: readonly string[];
  readonly i18nKey?: string;
}

const UPSTREAM_HTTP_ERROR_PREFIX =
  /^Upstream request failed \(\d+\):\s*/iu;

export const GENERATIVE_ERROR_RULES: readonly GenerativeErrorRule[] = [
  {
    id: "balance",
    pattern:
      /余额不足|insufficient\s+balance|accountoverdue|account.?overdue|overdue.?balance/iu,
    zh: "账户余额不足，请充值后重试。",
    en: "Account balance is insufficient. Please top up and retry.",
    appliesTo: "all",
  },
  {
    id: "auth",
    pattern:
      /invalid\s+api\s+key|incorrect\s+api\s+key|unauthorized|authentication|api\s+key.*invalid|401/iu,
    zh: "API Key 无效或已失效，请检查接口配置。",
    en: "API Key is invalid or expired. Check the interface settings.",
    appliesTo: "all",
  },
  {
    id: "rateLimit",
    pattern:
      /429|rate\s+limit|too\s+many\s+requests|请求过于频繁|request failed with status:\s*429/iu,
    zh: "请求过于频繁，请稍后重试。",
    en: "Too many requests. Please try again later.",
    i18nKey: "workflow.generativeErrors.rateLimited",
    appliesTo: "all",
  },
  {
    id: "modelId",
    pattern:
      /model\s+not\s+found|invalid\s+model|does\s+not\s+exist|unknown\s+model|模型不存在|无效模型/iu,
    zh: "模型 ID 配置有误，请在接口设置中核对。",
    en: "Model ID is misconfigured. Verify it in interface settings.",
    appliesTo: "all",
  },
  {
    id: "quota",
    pattern:
      /quota|额度|资源包|insufficientquota|exceeded.*limit|用量.*用尽/iu,
    zh: "免费额度或资源包已用尽。",
    en: "Free quota or resource package has been used up.",
    appliesTo: "all",
  },
  {
    id: "promptRequired",
    pattern: /prompt is required|a prompt or reference/iu,
    zh: "请先填写提示词，或添加参考图后再生成",
    en: "Enter a prompt or add a reference before generating.",
    i18nKey: "workflow.generativeErrors.promptRequired",
    appliesTo: ["text", "image", "video"],
  },
  {
    id: "promptTooLong",
    pattern: /prompt exceeds maximum length/iu,
    zh: "提示词过长，请缩短后重试",
    en: "Prompt is too long. Shorten it and try again.",
    i18nKey: "workflow.generativeErrors.promptTooLong",
    appliesTo: ["text", "image", "video"],
  },
  {
    id: "localReference",
    pattern: /local browser-only reference/iu,
    zh: "本地参考图无法在工作流运行中使用，请在画布面板生成",
    en: "Local browser-only references cannot be used in workflow runs. Generate from the canvas panel.",
    i18nKey: "workflow.generativeErrors.localReferenceUnsupported",
    appliesTo: ["image", "video"],
  },
  {
    id: "cloudStorage",
    pattern:
      /cloud_storage_unhealthy|cloud storage is unavailable|bucket cors does not allow/iu,
    zh: "云存储不可用，请检查 AI 接口中的存储配置",
    en: "Cloud storage is unavailable. Check storage settings on the AI interface.",
    i18nKey: "workflow.generativeErrors.cloudStorageUnavailable",
    appliesTo: ["image", "video", "audio"],
  },
  {
    id: "cloudUpload",
    pattern: /cloud upload failed|failed to fetch|browser direct upload/iu,
    zh: "云上传失败，请检查桶 CORS 配置后重试",
    en: "Cloud upload failed. Check bucket CORS settings and retry.",
    i18nKey: "workflow.generativeErrors.cloudUploadFailed",
    appliesTo: ["image", "video", "audio"],
  },
  {
    id: "timeout",
    pattern:
      /timeout|timed\s+out|etimedout|请求超时|video generation timed out|generation timed out/iu,
    zh: "请求超时，请稍后重试。",
    en: "Request timed out. Please try again later.",
    i18nKey: "workflow.generativeErrors.timedOut",
    appliesTo: "all",
  },
  {
    id: "realPersonInReference",
    pattern:
      /may contain real person|contain real person|real person|真人|真实人物/iu,
    zh: "参考[图1]包含真人图像，生成被拒绝",
    en: "Reference [Image 1] contains a real-person image. Generation was rejected.",
    appliesTo: ["video"],
  },
  {
    id: "generationFailed",
    pattern: /video generation failed|generation failed/iu,
    zh: "生成失败，请稍后重试",
    en: "Generation failed. Please try again later.",
    i18nKey: "workflow.generativeErrors.generationFailed",
    appliesTo: "all",
  },
  {
    id: "modelUnavailable",
    pattern: /model is not available|not available for this organization/iu,
    zh: "当前模型不可用，请在设置中检查 AI 接口配置",
    en: "This model is unavailable. Check AI interface settings.",
    i18nKey: "workflow.generativeErrors.modelUnavailable",
    appliesTo: "all",
  },
  {
    id: "interfaceUnavailable",
    pattern: /could not resolve ai interface|no ai interface configured/iu,
    zh: "未找到可用的 AI 接口，请先完成配置",
    en: "No AI interface is available. Finish setup first.",
    i18nKey: "workflow.generativeErrors.interfaceUnavailable",
    appliesTo: "all",
  },
  {
    id: "upstreamFailed",
    pattern:
      /submit failed|upstream returned non-json|request failed with status:\s*502/iu,
    zh: "上游服务暂时不可用，请稍后重试",
    en: "Upstream service is temporarily unavailable. Please try again later.",
    i18nKey: "workflow.generativeErrors.upstreamFailed",
    appliesTo: "all",
  },
  {
    id: "invalidParams",
    pattern: /invalid url|invalid parameter|parameter error|400/iu,
    zh: "生成参数不符合模型要求，请调整参数后重试",
    en: "Generation parameters are invalid for this model. Adjust them and retry.",
    i18nKey: "workflow.generativeErrors.invalidParams",
    appliesTo: "all",
  },
] as const;

function readNestedMessage(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const errorField = record.error;
  if (errorField && typeof errorField === "object") {
    const nested = errorField as Record<string, unknown>;
    if (typeof nested.message === "string" && nested.message.trim()) {
      return nested.message.trim();
    }
  }

  const candidates = [record.message, record.detail, record.msg];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
    if (candidate && typeof candidate === "object") {
      const nested = readNestedMessage(candidate);
      if (nested) {
        return nested;
      }
    }
  }

  return undefined;
}

/** Pull a human-readable message from API / thrown error text. */
export function extractGenerativeErrorMessage(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }

  const withoutPrefix = trimmed.replace(UPSTREAM_HTTP_ERROR_PREFIX, "").trim();
  const candidate = withoutPrefix || trimmed;

  if (candidate.startsWith("{") || candidate.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      const nested = readNestedMessage(parsed);
      if (nested) {
        return nested;
      }
    } catch {
      // fall through
    }
  }

  return candidate.replace(/^Error:\s*/iu, "").trim();
}

export function ruleAppliesToModelKind(
  appliesTo: GenerativeErrorAppliesTo,
  modelKind: GenerativeModelKind
): boolean {
  return appliesTo === "all" || appliesTo.includes(modelKind);
}

export function buildGenerativeErrorHaystack(raw: string): string {
  const extracted = extractGenerativeErrorMessage(raw);
  return `${raw}\n${extracted}`.trim();
}

/** Parse upstream `content[N]` indices cited in real-person video rejections. */
export function readRealPersonReferenceContentIndices(
  raw: string
): readonly number[] {
  const haystack = buildGenerativeErrorHaystack(raw);
  const indices = new Set<number>();
  for (const match of haystack.matchAll(/content\[(\d+)\]/giu)) {
    const index = Number.parseInt(match[1]!, 10);
    if (Number.isFinite(index) && index >= 0) {
      indices.add(index);
    }
  }
  if (indices.size === 0) {
    return [1];
  }
  return [...indices].sort((a, b) => a - b);
}

export type RealPersonReferenceMediaKind = "image" | "video" | "audio";

export function readRealPersonReferenceMediaKind(
  raw: string
): RealPersonReferenceMediaKind {
  const haystack = buildGenerativeErrorHaystack(raw);
  if (/input\s+video/iu.test(haystack)) {
    return "video";
  }
  if (/input\s+audio/iu.test(haystack)) {
    return "audio";
  }
  return "image";
}

function contentIndexToDisplayNumber(
  index: number,
  indices: readonly number[]
): number {
  const minIndex = indices[0] ?? index;
  // content[0] is usually prompt text; refs start at 1. When min is 0, refs start at 0.
  if (minIndex === 0) {
    return index + 1;
  }
  return index;
}

function formatRealPersonReferenceLabel(
  displayNumber: number,
  kind: RealPersonReferenceMediaKind,
  locale: GenerativeErrorLocale
): string {
  if (locale === "zh") {
    switch (kind) {
      case "video":
        return `视频${displayNumber}`;
      case "audio":
        return `音频${displayNumber}`;
      default:
        return `图${displayNumber}`;
    }
  }
  switch (kind) {
    case "video":
      return `Video ${displayNumber}`;
    case "audio":
      return `Audio ${displayNumber}`;
    default:
      return `Image ${displayNumber}`;
  }
}

/** User-facing reference labels, e.g. `图1、图2` or `Image 1, Image 2`. */
export function readRealPersonReferenceLabels(
  raw: string,
  locale: GenerativeErrorLocale = "zh"
): string {
  const kind = readRealPersonReferenceMediaKind(raw);
  const indices = readRealPersonReferenceContentIndices(raw);
  const labels = indices.map((index) =>
    formatRealPersonReferenceLabel(
      contentIndexToDisplayNumber(index, indices),
      kind,
      locale
    )
  );
  return locale === "zh" ? labels.join("、") : labels.join(", ");
}

/** @deprecated Prefer readRealPersonReferenceLabels for multi-ref errors. */
export function readRealPersonReferenceImageIndex(raw: string): number {
  const indices = readRealPersonReferenceContentIndices(raw);
  return contentIndexToDisplayNumber(indices[0] ?? 1, indices);
}

/** @deprecated Prefer readRealPersonReferenceLabels for multi-ref errors. */
export function readRealPersonReferenceImageLabel(
  raw: string,
  locale: GenerativeErrorLocale = "zh"
): string {
  return readRealPersonReferenceLabels(raw, locale);
}

export function buildRealPersonInReferenceCardLines(
  raw: string,
  locale: GenerativeErrorLocale = "zh"
): readonly string[] {
  const label = readRealPersonReferenceLabels(raw, locale);
  const kind = readRealPersonReferenceMediaKind(raw);
  if (locale === "zh") {
    return [
      `参考[${label}]包含真人图像，生成被拒绝`,
      kind === "image"
        ? "可将图片转为 彩绘、手绘 尝试生成"
        : "请更换参考后重试",
    ];
  }
  return [
    `Reference [${label}] contains a real-person image. Generation was rejected.`,
    kind === "image"
      ? "Try converting the image to a painted or hand-drawn style before generating."
      : "Replace the reference and try again.",
  ];
}

export function matchGenerativeErrorRule(params: {
  readonly raw: string;
  readonly modelKind: GenerativeModelKind;
  readonly locale?: GenerativeErrorLocale;
}): MatchedGenerativeErrorRule | undefined {
  const haystack = buildGenerativeErrorHaystack(params.raw);
  if (!haystack) {
    return undefined;
  }

  const locale = params.locale ?? "zh";

  for (const rule of GENERATIVE_ERROR_RULES) {
    if (!ruleAppliesToModelKind(rule.appliesTo, params.modelKind)) {
      continue;
    }
    if (!rule.pattern.test(haystack)) {
      continue;
    }

    if (rule.id === "realPersonInReference") {
      const cardLines = buildRealPersonInReferenceCardLines(params.raw, locale);
      return {
        id: rule.id,
        message: cardLines[0] ?? (locale === "zh" ? rule.zh : rule.en),
        cardLines,
      };
    }

    return {
      id: rule.id,
      message: locale === "zh" ? rule.zh : rule.en,
      i18nKey: rule.i18nKey,
    };
  }

  return undefined;
}

export function generativeModelKindFromNodeType(
  nodeType: string | undefined
): GenerativeModelKind {
  switch (nodeType) {
    case AI_IMAGE_NODE_TYPE:
      return "image";
    case AI_VIDEO_NODE_TYPE:
      return "video";
    case AI_AUDIO_NODE_TYPE:
      return "audio";
    case AI_TEXT_NODE_TYPE:
    default:
      return "text";
  }
}
