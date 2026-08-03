import HardDrive from "lucide-react/icons/hard-drive";
import SparklesIcon from "lucide-react/icons/sparkles";
import type { ReactNode } from "react";

import claudeIcon from "@/assets/model-brand-icons/claude.svg?raw";
import deepseekIcon from "@/assets/model-brand-icons/deepseek.svg?raw";
import doubaoIcon from "@/assets/model-brand-icons/doubao.svg?raw";
import geminiIcon from "@/assets/model-brand-icons/gemini.svg?raw";
import glmIcon from "@/assets/model-brand-icons/glm.svg?raw";
import grokIcon from "@/assets/model-brand-icons/grok.svg?raw";
import kimiIcon from "@/assets/model-brand-icons/kimi.svg?raw";
import minimaxIcon from "@/assets/model-brand-icons/minimax.svg?raw";
import openaiIcon from "@/assets/model-brand-icons/openai.svg?raw";
import { cn } from "@/utils/utils";

export type ModelBrandKey =
  | "claude"
  | "deepseek"
  | "doubao"
  | "gemini"
  | "glm"
  | "grok"
  | "kimi"
  | "minimax"
  | "openai"
  | "volcano"
  | "tos";

const BRAND_ICON_SVGS = {
  claude: claudeIcon,
  deepseek: deepseekIcon,
  doubao: doubaoIcon,
  gemini: geminiIcon,
  glm: glmIcon,
  grok: grokIcon,
  kimi: kimiIcon,
  minimax: minimaxIcon,
  openai: openaiIcon,
} as const satisfies Record<
  Exclude<ModelBrandKey, "volcano" | "tos">,
  string
>;

/** Icons available when configuring a model group logo. */
export const GROUP_ICON_OPTIONS = [
  "sparkles",
  "claude",
  "deepseek",
  "doubao",
  "gemini",
  "glm",
  "grok",
  "kimi",
  "minimax",
  "openai",
] as const;

export type GroupIconOption = (typeof GROUP_ICON_OPTIONS)[number];

const GROUP_ID_BRAND_KEYS: Partial<Record<string, ModelBrandKey>> = {
  claude: "claude",
  deepseek: "deepseek",
  doubao: "doubao",
  "doubao-text": "doubao",
  seed: "doubao",
  seedance: "doubao",
  seedream: "doubao",
  gemini: "gemini",
  glm: "glm",
  grok: "grok",
  "grok-text": "grok",
  "grok-video": "grok",
  kimi: "kimi",
  openai: "openai",
  "openai-image": "openai",
  minimax: "minimax",
  veo: "gemini",
  "nano-banana": "gemini",
};

export function isSelectableBrandIcon(
  value: string
): value is Exclude<ModelBrandKey, "volcano" | "tos"> {
  return Object.prototype.hasOwnProperty.call(BRAND_ICON_SVGS, value);
}

function brandFromGroupId(
  groupId: string | null | undefined
): ModelBrandKey | undefined {
  if (!groupId) return undefined;
  const direct = GROUP_ID_BRAND_KEYS[groupId];
  if (direct) return direct;

  const base = groupId.replace(/-(text|image|video|audio)$/, "");
  if (base !== groupId) {
    return GROUP_ID_BRAND_KEYS[base];
  }
  return undefined;
}

export function resolveModelBrandKey(params: {
  readonly canonicalId?: string;
  readonly presetId?: string;
  readonly groupId?: string | null;
  readonly icon?: string | null;
}): ModelBrandKey {
  const { canonicalId, presetId, groupId, icon } = params;

  if (icon && isSelectableBrandIcon(icon)) {
    return icon;
  }

  const fromGroup = brandFromGroupId(groupId);
  if (fromGroup) {
    return fromGroup;
  }

  if (presetId === "provider:deepseek") {
    return "deepseek";
  }
  if (presetId === "provider:seed") {
    return "doubao";
  }
  if (presetId === "provider:glm") {
    return "glm";
  }
  if (presetId === "provider:kimi") {
    return "kimi";
  }
  if (presetId === "provider:openai") {
    return "openai";
  }
  if (presetId === "provider:openai-image") {
    return "openai";
  }
  if (presetId === "provider:nano-banana") {
    return "gemini";
  }
  if (presetId === "provider:veo") {
    return "gemini";
  }
  if (presetId === "provider:gemini") {
    return "gemini";
  }
  if (
    presetId === "provider:grok" ||
    presetId === "provider:grok-imagine-image" ||
    presetId === "provider:grok-imagine-video"
  ) {
    return "grok";
  }
  if (presetId === "provider:claude") {
    return "claude";
  }
  if (presetId === "provider:minimax-speech") {
    return "minimax";
  }
  if (presetId === "provider:seedance") {
    return "doubao";
  }
  if (presetId === "provider:seedream") {
    return "doubao";
  }

  const id = canonicalId ?? "";
  if (id.startsWith("deepseek-")) {
    return "deepseek";
  }
  if (id.startsWith("glm-")) {
    return "glm";
  }
  if (id.startsWith("kimi-")) {
    return "kimi";
  }
  if (id.startsWith("gpt-5-6-")) {
    return "openai";
  }
  if (id.startsWith("gpt-image-")) {
    return "openai";
  }
  if (id.startsWith("gemini-")) {
    return "gemini";
  }
  if (id.startsWith("veo-")) {
    return "gemini";
  }
  if (id.startsWith("grok-")) {
    return "grok";
  }
  if (id.startsWith("claude-")) {
    return "claude";
  }
  if (id.startsWith("minimax-speech-") || id.startsWith("minimax-")) {
    return "minimax";
  }
  if (
    id.startsWith("doubao-") ||
    id.includes("seedream") ||
    id.includes("seedance")
  ) {
    return "doubao";
  }

  return "volcano";
}

function brandIconSvg(brandKey: ModelBrandKey): string | undefined {
  if (brandKey === "volcano") {
    return BRAND_ICON_SVGS.doubao;
  }
  if (brandKey === "tos") {
    return undefined;
  }
  return BRAND_ICON_SVGS[brandKey];
}

function SparklesFallback({
  className,
}: {
  readonly className?: string;
}): ReactNode {
  return (
    <span
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded bg-muted/80 text-muted-foreground",
        className
      )}
    >
      <SparklesIcon className="size-3" />
    </span>
  );
}

interface ModelBrandIconProps {
  readonly canonicalId?: string;
  readonly presetId?: string;
  readonly groupId?: string | null;
  /** Group logo key (`sparkles` or a brand id). Takes priority when set. */
  readonly icon?: string | null;
  readonly className?: string;
}

export function ModelBrandIcon({
  canonicalId,
  presetId,
  groupId,
  icon,
  className,
}: ModelBrandIconProps): ReactNode {
  const brandKey = resolveModelBrandKey({
    canonicalId,
    presetId,
    groupId,
    icon: icon === "sparkles" ? null : icon,
  });

  // Explicit default logo with no other brand signal.
  if (
    icon === "sparkles" &&
    !brandFromGroupId(groupId) &&
    !canonicalId &&
    !presetId
  ) {
    return <SparklesFallback className={className} />;
  }

  if (brandKey === "tos") {
    return (
      <span
        className={cn(
          "inline-flex size-5 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground",
          className
        )}
      >
        <HardDrive className="size-3" />
      </span>
    );
  }

  const iconSvg = brandIconSvg(brandKey);
  if (!iconSvg) {
    return <SparklesFallback className={className} />;
  }

  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-5 shrink-0 text-foreground [&_svg]:block [&_svg]:size-full",
        className
      )}
      dangerouslySetInnerHTML={{
        __html: iconSvg.replaceAll('fill="#000000"', 'fill="currentColor"'),
      }}
    />
  );
}
