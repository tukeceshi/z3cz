import type { FormatTransformProvider } from "@dafthunk/types";
import {
  FORMAT_TRANSFORM_PROVIDERS,
  isTransformMappingConfigComplete,
} from "@dafthunk/types";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormatTemplateApplyBar } from "@/components/admin/format-template-apply-bar";
import { ForwardingMappingEditor } from "@/components/admin/forwarding-mapping-editor";
import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createAdminFormatTransformTemplate,
  emptyFormatTransformCreateForm,
  useAdminFormatTransformTemplates,
  type FormatTransformCreateFormState,
} from "@/services/admin-format-transform-service";

interface AdminApiForwardingCreateDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onCreated: () => Promise<void>;
}

export function AdminApiForwardingCreateDialog(
  props: AdminApiForwardingCreateDialogProps
) {
  const { t } = useTranslation();
  const { templates, isTemplatesLoading } = useAdminFormatTransformTemplates();
  const [form, setForm] = useState<FormatTransformCreateFormState>(
    emptyFormatTransformCreateForm()
  );
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!props.open) {
      return;
    }

    setForm(emptyFormatTransformCreateForm());
  }, [props.open]);

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.error(t("adminApiForwarding.createValidation"));
      return;
    }

    if (
      !isTransformMappingConfigComplete(form.upstreamParams, form.paramMappings)
    ) {
      toast.error(t("adminApiForwarding.createWizard.mappingValidation"));
      return;
    }

    setIsCreating(true);
    try {
      await createAdminFormatTransformTemplate({
        name: form.name.trim(),
        provider: form.provider,
        upstreamParams: form.upstreamParams,
        paramMappings: form.paramMappings,
      });
      toast.success(t("adminApiForwarding.createSuccess"));
      props.onOpenChange(false);
      await props.onCreated();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("adminApiForwarding.createError")
      );
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{t("adminApiForwarding.createTitle")}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {t("adminApiForwarding.createWizard.description")}
          </p>
        </DialogHeader>

        <form
          autoComplete="off"
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            void handleCreate();
          }}
        >
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-4">
            <section className="space-y-4">
              <h3 className="font-medium">
                {t("adminApiForwarding.createWizard.basicSection")}
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="template_create_name">{t("common.name")}</Label>
                  <Input
                    id="template_create_name"
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>{t("adminApiForwarding.provider")}</Label>
                  <Select
                    value={form.provider}
                    onValueChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        provider: value as FormatTransformProvider,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FORMAT_TRANSFORM_PROVIDERS.map((provider) => (
                        <SelectItem key={provider} value={provider}>
                          {provider}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-medium">
                  {t("adminApiForwarding.createWizard.mappingSection")}
                </h3>
                <FormatTemplateApplyBar
                  templates={templates}
                  isLoading={isTemplatesLoading}
                  resetKey={props.open}
                  onApply={(template) =>
                    setForm((current) => ({
                      ...current,
                      upstreamParams: template.upstreamParams,
                      paramMappings: template.paramMappings,
                    }))
                  }
                />
              </div>
              <ForwardingMappingEditor
                provider={form.provider}
                upstreamParams={form.upstreamParams}
                paramMappings={form.paramMappings}
                onUpstreamParamsChange={(upstreamParams) =>
                  setForm((current) => ({ ...current, upstreamParams }))
                }
                onParamMappingsChange={(paramMappings) =>
                  setForm((current) => ({ ...current, paramMappings }))
                }
              />
            </section>
          </div>

          <div className="flex justify-end gap-2 border-t px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => props.onOpenChange(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? t("common.creating") : t("common.create")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
