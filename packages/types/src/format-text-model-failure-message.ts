import type { GenerativeCardError } from "./generative-card-error";
import { buildTextModelInvocationErrorParts } from "./interpret-upstream-text-model-error";

export type TextModelChannelKind = "aggregate" | "api";

function channelTag(
  channelKind: TextModelChannelKind,
  locale: "zh" | "en"
): string {
  if (channelKind === "aggregate") {
    return locale === "zh" ? "聚合" : "Aggregate";
  }
  return "API";
}

export interface TextModelFailureMessageParams {
  readonly failedInterfaceName: string;
  readonly channelKind: TextModelChannelKind;
  readonly modelDisplayLabel: string;
  readonly upstreamError?: string;
  readonly locale?: "zh" | "en";
}

function buildTextModelFailureCardLines(
  params: TextModelFailureMessageParams
): readonly string[] {
  const locale = params.locale ?? "zh";
  const failedTag = channelTag(params.channelKind, locale);

  if (locale === "zh") {
    return [
      `${params.modelDisplayLabel}调用失败`,
      `接口 「${failedTag}」${params.failedInterfaceName} 请求失败，请检查配置或稍后重试。`,
    ];
  }

  return [
    `${params.modelDisplayLabel} request failed`,
    `Interface "${failedTag}" ${params.failedInterfaceName} request failed. Check settings or try again later.`,
  ];
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
