import type {
  AdminLegalDocumentsConfig,
  AppLocale,
  LegalDocumentType,
  PublicLegalDocumentResponse,
  UpdateLegalDocumentsRequest,
} from "@dafthunk/types";
import useSWR from "swr";

import { makeRequest } from "./utils";

export const ADMIN_LEGAL_DOCUMENTS_KEY = "/admin/legal-documents";

export function useAdminLegalDocuments() {
  const { data, error, isLoading, mutate } = useSWR(
    ADMIN_LEGAL_DOCUMENTS_KEY,
    () => makeRequest<AdminLegalDocumentsConfig>("/admin/legal-documents")
  );

  return {
    legalDocuments: data,
    legalDocumentsError: error,
    isLegalDocumentsLoading: isLoading,
    refreshLegalDocuments: mutate,
  };
}

export async function updateAdminLegalDocuments(
  input: UpdateLegalDocumentsRequest
): Promise<AdminLegalDocumentsConfig> {
  return makeRequest<AdminLegalDocumentsConfig>("/admin/legal-documents", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function fetchPublicLegalDocument(
  type: LegalDocumentType,
  locale: AppLocale
): Promise<PublicLegalDocumentResponse> {
  return makeRequest<PublicLegalDocumentResponse>(
    `/legal-documents/${type}?locale=${locale}`,
    {},
    true
  );
}

export function usePublicLegalDocument(
  type: LegalDocumentType | null,
  locale: AppLocale
) {
  const { data, error, isLoading, mutate } = useSWR(
    type ? `/legal-documents/${type}?locale=${locale}` : null,
    () => fetchPublicLegalDocument(type!, locale),
    { revalidateOnFocus: false }
  );

  return {
    document: data,
    documentError: error,
    isDocumentLoading: isLoading,
    refreshDocument: mutate,
  };
}
