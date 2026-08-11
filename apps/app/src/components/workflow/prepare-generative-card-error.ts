import {
  getGenerativeCardLines,
  matchGenerativeErrorRule,
  normalizeGenerativeCardError,
  type GenerativeCardError,
  type GenerativeErrorLocale,
  type GenerativeModelKind,
  parseTextModelFailureMessageToCardError,
} from "@dafthunk/types";

import type { TranslateFn } from "@/i18n";

import {
  extractGenerativeApiErrorMessage,
  formatGenerativeApiError,
  formatGenerativeApiErrorCardLines,
} from "./format-generative-api-error";

function withCardLines(error: GenerativeCardError): GenerativeCardError {
  const cardLines = getGenerativeCardLines(error);
  return {
    ...error,
    cardLines,
    summary: cardLines[0] ?? error.summary,
  };
}

export function prepareGenerativeCardError(
  raw: string,
  t?: TranslateFn,
  modelKind: GenerativeModelKind = "text",
  locale: GenerativeErrorLocale = "zh"
): GenerativeCardError {
  const trimmed = raw.trim();
  if (!trimmed) {
    const summary = t?.("workflow.generativeErrors.generationFailed") ?? "生成失败";
    return {
      summary,
      cardLines: [summary],
    };
  }

  const textModel = parseTextModelFailureMessageToCardError(trimmed);
  if (textModel) {
    return withCardLines(textModel);
  }

  const normalized = normalizeGenerativeCardError(trimmed);
  if (normalized.summary !== trimmed || trimmed.includes("\n")) {
    return withCardLines(normalized);
  }

  if (t) {
    const message = extractGenerativeApiErrorMessage(trimmed);
    const formattedCardLines = formatGenerativeApiErrorCardLines(
      trimmed,
      t,
      modelKind,
      locale
    );
    if (formattedCardLines?.length) {
      const cardLines = message.trim()
        ? [...formattedCardLines, message.trim()]
        : formattedCardLines;
      return withCardLines({
        summary: formattedCardLines[0] ?? message,
        cardLines,
        detail: cardLines.join("\n"),
      });
    }

    const formatted = formatGenerativeApiError(message, t, modelKind, locale);
    if (formatted && formatted !== message) {
      return {
        summary: formatted,
        cardLines: message.trim() ? [formatted, message.trim()] : [formatted],
        detail: message.trim() ? `${formatted}\n${message.trim()}` : formatted,
      };
    }
  }

  const matched = matchGenerativeErrorRule({ raw: trimmed, modelKind, locale });
  if (matched?.cardLines?.length) {
    const message = extractGenerativeApiErrorMessage(trimmed).trim();
    const cardLines = message ? [...matched.cardLines, message] : matched.cardLines;
    return withCardLines({
      summary: matched.cardLines[0] ?? matched.message,
      cardLines,
      detail: cardLines.join("\n"),
    });
  }

  return withCardLines(normalized);
}
