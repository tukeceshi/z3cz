import type { LegalDocumentsConfig } from "./legal-documents";
import { DEFAULT_LEGAL_DOCUMENTS } from "./default-legal-documents";

export type {
  AdminLegalDocumentsConfig,
  LegalDocumentContent,
  LegalDocumentType,
  LegalDocumentsConfig,
  LocalizedLegalDocument,
  PublicLegalDocumentResponse,
  UpdateLegalDocumentsRequest,
} from "./legal-documents";

export { DEFAULT_LEGAL_DOCUMENTS };

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
