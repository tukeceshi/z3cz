import type {
  LegalDocumentsConfig,
  UpdateLegalDocumentsRequest,
} from "@dafthunk/types";
import type { AppLocale, LegalDocumentType } from "@dafthunk/types";
import FileText from "lucide-react/icons/file-text";
import { useEffect, useMemo, useState } from "react";

import { InsetError } from "@/components/inset-error";
import { InsetLoading } from "@/components/inset-loading";
import { InsetLayout } from "@/components/layouts/inset-layout";
import { useTranslation } from "@/components/locale-provider";
import { useBreadcrumbsSetter } from "@/components/page-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAppToast } from "@/hooks/use-app-toast";
import {
  updateAdminLegalDocuments,
  useAdminLegalDocuments,
} from "@/services/legal-documents-service";

function cloneLegalConfig(config: LegalDocumentsConfig): LegalDocumentsConfig {
  return {
    terms: {
      en: { ...config.terms.en },
      zh: { ...config.terms.zh },
    },
    privacy: {
      en: { ...config.privacy.en },
      zh: { ...config.privacy.zh },
    },
  };
}

export function AdminLegalDocumentsPage() {
  const { t } = useTranslation();
  const appToast = useAppToast();
  const setBreadcrumbs = useBreadcrumbsSetter();
  const { legalDocuments, legalDocumentsError, isLegalDocumentsLoading, refreshLegalDocuments } =
    useAdminLegalDocuments();

  const [form, setForm] = useState<LegalDocumentsConfig | null>(null);
  const [activeDocument, setActiveDocument] = useState<LegalDocumentType>("terms");
  const [activeLocale, setActiveLocale] = useState<AppLocale>("zh");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setBreadcrumbs([{ label: t("legalDocuments.title") }]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs, t]);

  useEffect(() => {
    if (!legalDocuments) {
      return;
    }
    setForm(cloneLegalConfig(legalDocuments));
  }, [legalDocuments]);

  const currentDocument = useMemo(() => {
    if (!form) {
      return null;
    }
    return form[activeDocument][activeLocale];
  }, [form, activeDocument, activeLocale]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form) {
      return;
    }

    setIsSaving(true);
    const payload: UpdateLegalDocumentsRequest = { legalConfig: form };

    try {
      await updateAdminLegalDocuments(payload);
      await refreshLegalDocuments();
      appToast.success(t("legalDocuments.saveSuccess"));
    } catch {
      appToast.error(t("legalDocuments.saveError"));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLegalDocumentsLoading || !form || !currentDocument) {
    return <InsetLoading title={t("legalDocuments.title")} />;
  }

  if (legalDocumentsError) {
    return (
      <InsetError
        title={t("legalDocuments.title")}
        errorMessage={legalDocumentsError.message}
      />
    );
  }

  const idPrefix = `${activeDocument}-${activeLocale}`;

  return (
    <InsetLayout title={t("legalDocuments.title")}>
      <form className="flex max-w-3xl flex-col gap-6" onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-4" />
              {t("legalDocuments.title")}
            </CardTitle>
            <CardDescription>{t("legalDocuments.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Tabs
              value={activeDocument}
              onValueChange={(value) =>
                setActiveDocument(value as LegalDocumentType)
              }
            >
              <TabsList>
                <TabsTrigger value="terms">
                  {t("legalDocuments.tabs.terms")}
                </TabsTrigger>
                <TabsTrigger value="privacy">
                  {t("legalDocuments.tabs.privacy")}
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <Tabs
              value={activeLocale}
              onValueChange={(value) => setActiveLocale(value as AppLocale)}
            >
              <TabsList>
                <TabsTrigger value="zh">{t("legalDocuments.locales.zh")}</TabsTrigger>
                <TabsTrigger value="en">{t("legalDocuments.locales.en")}</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor={`${idPrefix}-title`}>
                  {t("legalDocuments.fields.title")}
                </Label>
                <Input
                  id={`${idPrefix}-title`}
                  value={currentDocument.title}
                  onChange={(event) =>
                    setForm((current) =>
                      current
                        ? {
                            ...current,
                            [activeDocument]: {
                              ...current[activeDocument],
                              [activeLocale]: {
                                ...current[activeDocument][activeLocale],
                                title: event.target.value,
                              },
                            },
                          }
                        : current
                    )
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`${idPrefix}-effective-date`}>
                  {t("legalDocuments.fields.effectiveDate")}
                </Label>
                <Input
                  id={`${idPrefix}-effective-date`}
                  value={currentDocument.effectiveDate}
                  onChange={(event) =>
                    setForm((current) =>
                      current
                        ? {
                            ...current,
                            [activeDocument]: {
                              ...current[activeDocument],
                              [activeLocale]: {
                                ...current[activeDocument][activeLocale],
                                effectiveDate: event.target.value,
                              },
                            },
                          }
                        : current
                    )
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`${idPrefix}-body`}>
                  {t("legalDocuments.fields.body")}
                </Label>
                <Textarea
                  id={`${idPrefix}-body`}
                  value={currentDocument.body}
                  onChange={(event) =>
                    setForm((current) =>
                      current
                        ? {
                            ...current,
                            [activeDocument]: {
                              ...current[activeDocument],
                              [activeLocale]: {
                                ...current[activeDocument][activeLocale],
                                body: event.target.value,
                              },
                            },
                          }
                        : current
                    )
                  }
                  rows={18}
                  className="font-mono text-sm"
                />
                <p className="text-sm text-muted-foreground">
                  {t("legalDocuments.fields.bodyHelp")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Button type="submit" disabled={isSaving}>
          {isSaving ? t("legalDocuments.saving") : t("legalDocuments.save")}
        </Button>
      </form>
    </InsetLayout>
  );
}
