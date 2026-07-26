import type { LegalDocumentType, PublicLegalDocumentResponse } from "@dafthunk/types";
import Markdown from "react-markdown";

import { useTranslation } from "@/components/locale-provider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePublicLegalDocument } from "@/services/legal-documents-service";

interface LegalDocumentDialogProps {
  type: LegalDocumentType | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function LegalDocumentBody({
  document,
  isLoading,
}: {
  document: PublicLegalDocumentResponse | undefined;
  isLoading: boolean;
}) {
  const { t } = useTranslation();

  if (isLoading || !document) {
    return (
      <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
    );
  }

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <Markdown>{document.document.body}</Markdown>
    </div>
  );
}

export function LegalDocumentDialog({
  type,
  open,
  onOpenChange,
}: LegalDocumentDialogProps) {
  const { locale, t } = useTranslation();
  const { document, isDocumentLoading } = usePublicLegalDocument(
    open ? type : null,
    locale
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] max-w-2xl flex-col gap-4">
        <DialogHeader>
          <DialogTitle>
            {document?.document.title ??
              (type === "terms"
                ? t("auth.termsOfService")
                : t("auth.privacyPolicy"))}
          </DialogTitle>
          {document?.document.effectiveDate ? (
            <DialogDescription>
              {document.document.effectiveDate}
            </DialogDescription>
          ) : null}
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <LegalDocumentBody document={document} isLoading={isDocumentLoading} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
