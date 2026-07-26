import type { AppLocale } from "./site-settings";
import { DEFAULT_LEGAL_DOCUMENTS } from "./default-legal-documents";

export { DEFAULT_LEGAL_DOCUMENTS };

export type LegalDocumentType = "terms" | "privacy";

export interface LegalDocumentContent {
  readonly title: string;
  readonly effectiveDate: string;
  readonly body: string;
}

export type LocalizedLegalDocument = Record<AppLocale, LegalDocumentContent>;

export interface LegalDocumentsConfig {
  readonly terms: LocalizedLegalDocument;
  readonly privacy: LocalizedLegalDocument;
}

export interface AdminLegalDocumentsConfig extends LegalDocumentsConfig {
  readonly updatedAt: string;
  readonly updatedBy: string | null;
}

export interface UpdateLegalDocumentsRequest {
  readonly legalConfig: LegalDocumentsConfig;
}

export interface PublicLegalDocumentResponse {
  readonly type: LegalDocumentType;
  readonly locale: AppLocale;
  readonly document: LegalDocumentContent;
}

export function mergeLegalDocumentsConfig(
  partial: Partial<LegalDocumentsConfig> | null | undefined
): LegalDocumentsConfig {
  if (!partial) {
    return structuredClone(DEFAULT_LEGAL_DOCUMENTS);
  }

  return {
    terms: {
      en: { ...DEFAULT_LEGAL_DOCUMENTS.terms.en, ...partial.terms?.en },
      zh: { ...DEFAULT_LEGAL_DOCUMENTS.terms.zh, ...partial.terms?.zh },
    },
    privacy: {
      en: { ...DEFAULT_LEGAL_DOCUMENTS.privacy.en, ...partial.privacy?.en },
      zh: { ...DEFAULT_LEGAL_DOCUMENTS.privacy.zh, ...partial.privacy?.zh },
    },
  };
}
