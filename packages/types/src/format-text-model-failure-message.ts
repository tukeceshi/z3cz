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
  /** When false, do not claim the interface was auto-disabled. Default true. */
  readonly disabledInterface?: boolean;
}

function buildTextModelFailureCardLines(
  params: TextModelFailureMessageParams
): readonly string[] {
  const locale = params.locale ?? "zh";
  const failedTag = channelTag(params.channelKind, locale);
  const disabledInterface = params.disabledInterface !== false;

  if (locale === "zh") {
    const lines = [`${params.modelDisplayLabel}调用失败`];
    if (disabledInterface) {
      lines.push(
        `已自动关闭错误接口 「${failedTag}」${params.failedInterfaceName}。`,
        "请检查配置，可在「AI/资源 接口」重新启用接口。"
      );
    } else {
      lines.push(
        `接口 「${failedTag}」${params.failedInterfaceName} 暂时失败，模型未关闭。`,
        "请稍后重试。"
      );
    }
    return lines;
  }

  const lines = [`${params.modelDisplayLabel} request failed`];
  if (disabledInterface) {
    lines.push(
      `Disabled interface "${failedTag}" ${params.failedInterfaceName}.`,
      "Check settings and re-enable the interface under AI / Resource Interfaces."
    );
  } else {
    lines.push(
      `Interface "${failedTag}" ${params.failedInterfaceName} failed temporarily; the model was not disabled.`,
      "Please try again later."
    );
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
