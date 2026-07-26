import { formatPlatformModelLabel } from "./format-platform-model-label";
import type { GenerativeCardError } from "./generative-card-error";
import type { AiModelModality } from "./ai-model-catalog";
import { buildTextModelInvocationErrorParts } from "./interpret-upstream-text-model-error";

export type TextModelChannelKind = "aggregate" | "api";

const MODALITY_LABEL_ZH: Record<AiModelModality, string> = {
  text: "文字",
  image: "图片",
  video: "视频",
  audio: "音频",
};

const MODALITY_LABEL_EN: Record<AiModelModality, string> = {
  text: "Text",
  image: "Image",
  video: "Video",
  audio: "Audio",
};

function channelTag(
  channelKind: TextModelChannelKind,
  locale: "zh" | "en"
): string {
  if (channelKind === "aggregate") {
    return locale === "zh" ? "聚合" : "Aggregate";
  }
  return "API";
}

export function buildTextModelDisplayLabel(params: {
  readonly displayName: string;
  readonly modality: AiModelModality;
  readonly locale?: "zh" | "en";
}): string {
  const locale = params.locale ?? "zh";
  const labels = locale === "zh" ? MODALITY_LABEL_ZH : MODALITY_LABEL_EN;
  return formatPlatformModelLabel({
    alias: params.displayName,
    modalityLabel: labels[params.modality],
  });
}

export interface TextModelFailureMessageParams {
  readonly failedInterfaceName: string;
  readonly channelKind: TextModelChannelKind;
  readonly modelDisplayLabel: string;
  readonly upstreamError?: string;
  readonly nextInterfaceName?: string;
  readonly nextChannelKind?: TextModelChannelKind;
  readonly locale?: "zh" | "en";
}

function buildTextModelFailureCardLines(
  params: TextModelFailureMessageParams
): readonly string[] {
  const locale = params.locale ?? "zh";
  const failedTag = channelTag(params.channelKind, locale);

  if (locale === "zh") {
    const lines = [
      `${params.modelDisplayLabel}调用失败`,
      `已自动关闭错误接口 「${failedTag}」${params.failedInterfaceName}。`,
      "请检查配置，可在「AI/资源 接口」重新启用接口。",
    ];
    if (params.nextInterfaceName && params.nextChannelKind) {
      const nextTag = channelTag(params.nextChannelKind, locale);
      lines.push(
        `重试将使用接口「${nextTag}」${params.nextInterfaceName}。`
      );
    } else {
      lines.push("已无其他可用接口。");
    }
    return lines;
  }

  const lines = [
    `${params.modelDisplayLabel} request failed`,
    `Disabled interface "${failedTag}" ${params.failedInterfaceName}.`,
    "Check settings and re-enable the interface under AI / Resource Interfaces.",
  ];
  if (params.nextInterfaceName && params.nextChannelKind) {
    const nextTag = channelTag(params.nextChannelKind, locale);
    lines.push(`Retry will use interface "${nextTag}" ${params.nextInterfaceName}.`);
  } else {
    lines.push("No other interfaces are available.");
  }
  return lines;
}

export function buildTextModelFailureCardParts(
  params: TextModelFailureMessageParams
): GenerativeCardError {
  const locale = params.locale ?? "zh";
  const cardLines = [
    ...buildTextModelFailureCardLines(params),
    ...buildTextModelInvocationErrorParts({
      upstreamError: params.upstreamError,
      locale,
    }),
  ];

  return {
    summary: cardLines[0] ?? "生成失败",
    cardLines,
    detail: cardLines.join("\n"),
  };
}

export function buildTextModelInvocationErrorFromFailure(
  params: Pick<TextModelFailureMessageParams, "upstreamError" | "locale">
): string {
  return (
    buildTextModelInvocationErrorParts({
      upstreamError: params.upstreamError,
      locale: params.locale,
    }).join("\n") || params.upstreamError?.trim() || "生成失败"
  );
}

export function formatTextModelFailureMessage(
  params: TextModelFailureMessageParams
): string {
  return buildTextModelFailureCardParts(params).detail ?? "";
}
