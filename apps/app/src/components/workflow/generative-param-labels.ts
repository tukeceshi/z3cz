import type { UpstreamParamProfileField } from "@dafthunk/types";

import type { TranslateFn, TranslationKey } from "@/i18n";

export function resolveGenerationFieldLabel(
  field: UpstreamParamProfileField,
  t: TranslateFn
): string {
  const key = `workflow.generativeParams.fields.${field.name}` as TranslationKey;
  const translated = t(key);
  return translated !== key ? translated : field.description || field.name;
}

export function resolveGenerationOptionLabel(
  fieldName: string,
  option: string,
  t: TranslateFn,
  fallback?: string
): string {
  const key =
    `workflow.generativeParams.options.${fieldName}.${option}` as TranslationKey;
  const translated = t(key);
  return translated !== key ? translated : (fallback ?? option);
}

export function formatGenerationDurationLabel(
  seconds: number | string,
  t: TranslateFn
): string {
  const numeric = typeof seconds === "number" ? seconds : Number(seconds);
  if (!Number.isFinite(numeric)) {
    return String(seconds);
  }
  return t("workflow.generativeParams.summary.duration", { n: numeric });
}
