import HardDrive from "lucide-react/icons/hard-drive";
import SparklesIcon from "lucide-react/icons/sparkles";
import type { ReactNode } from "react";

import claudeIcon from "@/assets/model-brand-icons/claude.png";
import deepseekIcon from "@/assets/model-brand-icons/deepseek.png";
import doubaoIcon from "@/assets/model-brand-icons/doubao.png";
import geminiIcon from "@/assets/model-brand-icons/gemini.svg";
import glmIcon from "@/assets/model-brand-icons/glm.avif";
import grokIcon from "@/assets/model-brand-icons/grok.png";
import kimiIcon from "@/assets/model-brand-icons/kimi.png";
import openaiIcon from "@/assets/model-brand-icons/openai.svg";
import { cn } from "@/utils/utils";

export type ModelBrandKey =
  | "claude"
  | "deepseek"
  | "doubao"
  | "gemini"
  | "glm"
  | "grok"
  | "kimi"
  | "openai"
  | "volcano"
  | "tos";

const BRAND_ICON_SOURCES = {
  claude: claudeIcon,
  deepseek: deepseekIcon,
  doubao: doubaoIcon,
  gemini: geminiIcon,
  glm: glmIcon,
  grok: grokIcon,
  kimi: kimiIcon,
  openai: openaiIcon,
} as const satisfies Record<Exclude<ModelBrandKey, "volcano" | "tos">, string>;

const GROUP_ID_BRAND_KEYS: Partial<Record<string, ModelBrandKey>> = {
  claude: "claude",
  deepseek: "deepseek",
  doubao: "doubao",
  gemini: "gemini",
  glm: "glm",
  grok: "grok",
  kimi: "kimi",
  openai: "openai",
  minimax: "volcano",
  veo: "gemini",
  "nano-banana": "gemini",
  seed: "doubao",
};

export function resolveModelBrandKey(params: {
  readonly canonicalId?: string;
  readonly presetId?: string;
  readonly groupId?: string | null;
}): ModelBrandKey {
  const { canonicalId, presetId, groupId } = params;

  if (groupId && GROUP_ID_BRAND_KEYS[groupId]) {
    return GROUP_ID_BRAND_KEYS[groupId]!;
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
    return "volcano";
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
  if (id.startsWith("minimax-speech-")) {
    return "volcano";
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

function brandIconSource(brandKey: ModelBrandKey): string | undefined {
  if (brandKey === "volcano") {
    return BRAND_ICON_SOURCES.doubao;
  }
  if (brandKey === "tos") {
    return undefined;
  }
  return BRAND_ICON_SOURCES[brandKey];
}

interface ModelBrandIconProps {
  readonly canonicalId?: string;
  readonly presetId?: string;
  readonly groupId?: string | null;
  readonly className?: string;
}

export function ModelBrandIcon({
  canonicalId,
  presetId,
  groupId,
  className,
}: ModelBrandIconProps): ReactNode {
  const brandKey = resolveModelBrandKey({ canonicalId, presetId, groupId });

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

  const iconSource = brandIconSource(brandKey);
  if (!iconSource) {
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

  return (
    <img
      src={iconSource}
      alt=""
      loading="lazy"
      decoding="async"
      className={cn("size-5 shrink-0 rounded object-contain", className)}
    />
  );
}
