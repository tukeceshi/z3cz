import {
  extractGenerativeErrorMessage,
  matchGenerativeErrorRule,
  readRealPersonReferenceLabels,
  type GenerativeErrorLocale,
  type GenerativeModelKind,
} from "@dafthunk/types";

import type { TranslateFn, TranslationKey } from "@/i18n";

export { extractGenerativeErrorMessage as extractGenerativeApiErrorMessage };

function simplifyFallbackDetail(message: string): string {
  const withoutJson = message
    .replace(/^\{[\s\S]*\}$/u, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!withoutJson) return message.slice(0, 160);
  if (withoutJson.length <= 160) return withoutJson;
  return `${withoutJson.slice(0, 157)}…`;
}

function resolveMatchedRuleMessage(
  matched: NonNullable<ReturnType<typeof matchGenerativeErrorRule>>,
  t: TranslateFn,
  raw: string,
  locale: GenerativeErrorLocale
): string {
  if (matched.id === "realPersonInReference") {
    const label = readRealPersonReferenceLabels(raw, locale);
    return t("workflow.generativeErrors.realPersonInReferenceRejected", {
      label,
    });
  }
  if (matched.i18nKey) {
    return t(matched.i18nKey as TranslationKey);
  }
  return matched.message;
}

function resolveMatchedRuleCardLines(
  matched: NonNullable<ReturnType<typeof matchGenerativeErrorRule>>,
  t: TranslateFn,
  raw: string,
  locale: GenerativeErrorLocale
): readonly string[] | undefined {
  if (matched.id === "realPersonInReference") {
    const label = readRealPersonReferenceLabels(raw, locale);
    return [
      t("workflow.generativeErrors.realPersonInReferenceRejected", { label }),
      t("workflow.generativeErrors.realPersonInReferenceHint"),
    ];
  }
  return matched.cardLines;
}

/** Format API errors for card display with locale-aware copy. */
export function formatGenerativeApiError(
  raw: string,
  t: TranslateFn,
  modelKind: GenerativeModelKind = "image",
  locale: GenerativeErrorLocale = "zh"
): string {
  const message = extractGenerativeErrorMessage(raw);
  if (!message) {
    return t("workflow.generativeErrors.generationFailed");
  }

  const matched = matchGenerativeErrorRule({ raw, modelKind, locale });
  if (matched) {
    return resolveMatchedRuleMessage(matched, t, raw, locale);
  }

  return t("workflow.generativeErrors.generic", {
    detail: simplifyFallbackDetail(message),
  });
}

export function formatGenerativeApiErrorCardLines(
  raw: string,
  t: TranslateFn,
  modelKind: GenerativeModelKind = "image",
  locale: GenerativeErrorLocale = "zh"
): readonly string[] | undefined {
  const message = extractGenerativeErrorMessage(raw);
  if (!message) {
    return undefined;
  }

  const matched = matchGenerativeErrorRule({ raw, modelKind, locale });
  if (!matched) {
    return undefined;
  }

  const cardLines = resolveMatchedRuleCardLines(matched, t, raw, locale);
  if (cardLines?.length) {
    return cardLines;
  }

  const summary = resolveMatchedRuleMessage(matched, t, raw, locale);
  return summary !== message ? [summary] : undefined;
}
