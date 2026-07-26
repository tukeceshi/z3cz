import type {
  AdminLegalDocumentsConfig,
  AppLocale,
  LegalDocumentContent,
  LegalDocumentType,
  LegalDocumentsConfig,
} from "@dafthunk/types";
import {
  APP_LOCALES,
  DEFAULT_LEGAL_DOCUMENTS,
  mergeLegalDocumentsConfig,
} from "@dafthunk/types";

export function parseLegalConfig(value: string | null): LegalDocumentsConfig {
  if (!value) {
    return mergeLegalDocumentsConfig(null);
  }

  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") {
      return mergeLegalDocumentsConfig(null);
    }
    return mergeLegalDocumentsConfig(parsed as Partial<LegalDocumentsConfig>);
  } catch {
    return mergeLegalDocumentsConfig(null);
  }
}

export function serializeLegalConfig(config: LegalDocumentsConfig): string {
  return JSON.stringify(mergeLegalDocumentsConfig(config));
}

export function getLegalDocument(
  config: LegalDocumentsConfig,
  type: LegalDocumentType,
  locale: AppLocale
): LegalDocumentContent {
  return config[type][locale];
}

export function isLegalDocumentType(value: string): value is LegalDocumentType {
  return value === "terms" || value === "privacy";
}

export function isAppLocale(value: string): value is AppLocale {
  return (APP_LOCALES as readonly string[]).includes(value);
}

export function toAdminLegalDocumentsConfig(
  config: LegalDocumentsConfig,
  updatedAt: string,
  updatedBy: string | null
): AdminLegalDocumentsConfig {
  return {
    ...mergeLegalDocumentsConfig(config),
    updatedAt,
    updatedBy,
  };
}

export { DEFAULT_LEGAL_DOCUMENTS, mergeLegalDocumentsConfig };
