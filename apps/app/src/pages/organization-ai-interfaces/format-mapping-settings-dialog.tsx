import type {
  FormatTransformTemplate,
  SingleModelFormatTransform,
} from "@dafthunk/types";
import {
  isTransformMappingConfigComplete,
  singleModelFormatTransformFromTemplate,
} from "@dafthunk/types";
import { useEffect, useState } from "react";

import { ForwardingMappingEditor } from "@/components/admin/forwarding-mapping-editor";
import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppToast } from "@/hooks/use-app-toast";

interface FormatMappingSettingsDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly value: SingleModelFormatTransform | null;
  readonly onChange: (value: SingleModelFormatTransform | null) => void;
  readonly formatTemplates: readonly FormatTransformTemplate[];
  readonly isFormatTemplatesLoading?: boolean;
}

export function FormatMappingSettingsDialog({
  open,
  onOpenChange,
  value,
  onChange,
  formatTemplates,
  isFormatTemplatesLoading = false,
}: FormatMappingSettingsDialogProps) {
  const { t } = useTranslation();
  const appToast = useAppToast();
  const [sourceTemplateId, setSourceTemplateId] = useState("");
  const [mappingTemplateId, setMappingTemplateId] = useState<string | null>(
    null
  );
  const [upstreamParams, setUpstreamParams] = useState<
    SingleModelFormatTransform["upstreamParams"]
  >([]);
  const [paramMappings, setParamMappings] = useState<
    SingleModelFormatTransform["paramMappings"]
  >([]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const templateId = value?.sourceTemplateId ?? "";
    setSourceTemplateId(templateId);
    setMappingTemplateId(templateId || null);
    setUpstreamParams(value?.upstreamParams ?? []);
    setParamMappings(value?.paramMappings ?? []);
  }, [open, value]);

  const appliedTemplate =
    formatTemplates.find((template) => template.id === mappingTemplateId) ??
    null;

  const mappingProvider =
    formatTemplates.find((template) => template.id === sourceTemplateId)
      ?.provider ??
    appliedTemplate?.provider ??
    formatTemplates[0]?.provider ??
    "seedance";

  const handleApplyTemplate = () => {
    if (!sourceTemplateId.trim()) {
      appToast.error("pages.aiInterfaces.singleModel.formatTemplateRequired");
      return;
    }

    const template = formatTemplates.find(
      (entry) => entry.id === sourceTemplateId
    );
    if (!template) {
      return;
    }

    const snapshot = singleModelFormatTransformFromTemplate(template);
    setUpstreamParams(snapshot.upstreamParams);
    setParamMappings(snapshot.paramMappings);
    setMappingTemplateId(sourceTemplateId);
  };

  const handleSave = () => {
    if (!sourceTemplateId.trim()) {
      appToast.error("pages.aiInterfaces.singleModel.formatTemplateRequired");
      return;
    }

    if (mappingTemplateId !== sourceTemplateId) {
      appToast.error("pages.aiInterfaces.singleModel.applyFormatTemplateRequired");
      return;
    }

    if (!isTransformMappingConfigComplete(upstreamParams, paramMappings)) {
      appToast.error("pages.aiInterfaces.singleModel.formatTransformIncomplete");
      return;
    }

    onChange({
      sourceTemplateId: sourceTemplateId.trim(),
      upstreamParams,
      paramMappings,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-5xl flex-col overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {t("pages.aiInterfaces.singleModel.formatMappingSettingsTitle")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 rounded-lg border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium">
              {t("pages.aiInterfaces.singleModel.formatMappingTitle")}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={sourceTemplateId}
                onValueChange={setSourceTemplateId}
                disabled={isFormatTemplatesLoading}
              >
                <SelectTrigger
                  id="format-mapping-source-template"
                  className="h-9 w-[11rem] max-w-full sm:w-52"
                >
                  <SelectValue
                    placeholder={t(
                      "pages.aiInterfaces.singleModel.formatTemplatePlaceholder"
                    )}
                  />
                </SelectTrigger>
                <SelectContent>
                  {formatTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleApplyTemplate}
              >
                {t("pages.aiInterfaces.singleModel.applyFormatTemplate")}
              </Button>
            </div>
          </div>

          <ForwardingMappingEditor
            provider={mappingProvider}
            upstreamParams={upstreamParams}
            paramMappings={paramMappings}
            onUpstreamParamsChange={setUpstreamParams}
            onParamMappingsChange={setParamMappings}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSave}>{t("common.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
