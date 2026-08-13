import type {
  ForwardingParamMapping,
  ForwardingUpstreamParam,
} from "@dafthunk/types";
import { isTransformMappingConfigComplete } from "@dafthunk/types";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { FormatTemplateApplyBar } from "@/components/admin/format-template-apply-bar";
import { ForwardingMappingEditor } from "@/components/admin/forwarding-mapping-editor";
import { InsetError } from "@/components/inset-error";
import { InsetLoading } from "@/components/inset-loading";
import { InsetLayout } from "@/components/layouts/inset-layout";
import { useTranslation } from "@/components/locale-provider";
import { useBreadcrumbsSetter } from "@/components/page-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  updateAdminFormatTransformTemplate,
  useAdminFormatTransformTemplate,
  useAdminFormatTransformTemplates,
} from "@/services/admin-format-transform-service";

export function AdminApiForwardingDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { template, templateError, isTemplateLoading, refreshTemplate } =
    useAdminFormatTransformTemplate(id);
  const { templates, isTemplatesLoading } = useAdminFormatTransformTemplates();

  const [name, setName] = useState("");
  const [upstreamParams, setUpstreamParams] = useState<
    readonly ForwardingUpstreamParam[]
  >([]);
  const [paramMappings, setParamMappings] = useState<
    readonly ForwardingParamMapping[]
  >([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!template) {
      return;
    }
    setName(template.name);
    setUpstreamParams(template.upstreamParams);
    setParamMappings(template.paramMappings);
  }, [template]);

  const setBreadcrumbs = useBreadcrumbsSetter();

  useEffect(() => {
    setBreadcrumbs([
      {
        label: t("adminApiForwarding.title"),
        to: "/admin/format-templates",
      },
      { label: template?.name ?? t("common.loading") },
    ]);
    return () => setBreadcrumbs([]);
  }, [template?.name, setBreadcrumbs, t]);

  const handleSave = async () => {
    if (!id) {
      return;
    }

    if (!name.trim()) {
      toast.error(t("adminApiForwarding.createValidation"));
      return;
    }

    if (
      !isTransformMappingConfigComplete(upstreamParams, paramMappings)
    ) {
      toast.error(t("adminApiForwarding.createWizard.mappingValidation"));
      return;
    }

    setIsSaving(true);
    try {
      await updateAdminFormatTransformTemplate(id, {
        name: name.trim(),
        upstreamParams,
        paramMappings,
      });
      toast.success(t("adminApiForwarding.saveSuccess"));
      await refreshTemplate();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("adminApiForwarding.saveError")
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isTemplateLoading) {
    return <InsetLoading />;
  }

  if (templateError || !template) {
    return <InsetError errorMessage={t("adminApiForwarding.loadError")} />;
  }

  return (
    <InsetLayout
      title={template.name}
      titleRight={
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => navigate("/admin/format-templates")}
          >
            {t("common.back")}
          </Button>
          <Button onClick={() => void handleSave()} disabled={isSaving}>
            {isSaving ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      }
    >
      <p className="mb-6 text-sm text-muted-foreground">
        {t("adminApiForwarding.detailDescription")}
      </p>
      <div className="space-y-6">
        <div className="grid gap-4 rounded-lg border bg-background p-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="template_detail_name">{t("common.name")}</Label>
            <Input
              id="template_detail_name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>{t("adminApiForwarding.provider")}</Label>
            <p className="text-sm text-muted-foreground">{template.provider}</p>
          </div>
        </div>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-medium">
              {t("adminApiForwarding.createWizard.mappingSection")}
            </h3>
            <FormatTemplateApplyBar
              templates={templates}
              excludeId={template.id}
              isLoading={isTemplatesLoading}
              onApply={(source) => {
                setUpstreamParams(source.upstreamParams);
                setParamMappings(source.paramMappings);
              }}
            />
          </div>
          <ForwardingMappingEditor
            provider={template.provider}
            upstreamParams={upstreamParams}
            paramMappings={paramMappings}
            onUpstreamParamsChange={setUpstreamParams}
            onParamMappingsChange={setParamMappings}
          />
        </section>
      </div>
    </InsetLayout>
  );
}
