import {
  getGenerativeCardLines,
  normalizeGenerativeCardError,
  type GenerativeCardError,
  parseTextModelFailureMessageToCardError,
} from "@dafthunk/types";

import type { TranslateFn } from "@/i18n";

import {
  extractGenerativeApiErrorMessage,
  formatGenerativeApiError,
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
  t?: TranslateFn
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
    const formatted = formatGenerativeApiError(message, t);
    if (formatted && formatted !== message) {
      return {
        summary: formatted,
        cardLines: message.trim() ? [formatted, message.trim()] : [formatted],
        detail: message.trim() ? `${formatted}\n${message.trim()}` : formatted,
      };
    }
  }

  return withCardLines(normalized);
}
