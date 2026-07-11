import type {
  AiInterfaceSourceSpec,
  AiInterfaceTemplateIndex,
} from "@dafthunk/types";
import { useEffect, useState } from "react";

import { InsetError } from "@/components/inset-error";
import { InsetLoading } from "@/components/inset-loading";
import { InsetLayout } from "@/components/layouts/inset-layout";
import { useTranslation } from "@/components/locale-provider";
import { useBreadcrumbsSetter } from "@/components/page-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAppToast } from "@/hooks/use-app-toast";
import {
  deleteAdminAiInterfaceTemplate,
  fetchAdminAiInterfaceTemplate,
  saveAdminAiInterfaceTemplate,
  useAdminAiInterfaceTemplates,
} from "@/services/ai-interface-template-service";

export function AdminAiInterfaceTemplatesPage() {
  const { templates, templatesError, isTemplatesLoading, refreshTemplates } =
    useAdminAiInterfaceTemplates();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] =
    useState<AiInterfaceTemplateIndex | null>(null);
  const [specJson, setSpecJson] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const setBreadcrumbs = useBreadcrumbsSetter();
  const { t } = useTranslation();
  const appToast = useAppToast();

  useEffect(() => {
    setBreadcrumbs([
      { label: t("sidebar.admin"), to: "/admin" },
      { label: t("sidebar.aiInterfaceTemplates") },
    ]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs, t]);

  const handleOpenEdit = async (template: AiInterfaceTemplateIndex) => {
    try {
      const detail = await fetchAdminAiInterfaceTemplate(template.id);
      setEditingTemplate(template);
      setSpecJson(JSON.stringify(detail.sourceSpec, null, 2));
      setDialogOpen(true);
    } catch {
      appToast.error("admin.aiTemplates.loadTemplateFailed");
    }
  };

  const handleSave = async () => {
    if (!editingTemplate) return;

    let sourceSpec: AiInterfaceSourceSpec;
    try {
      sourceSpec = JSON.parse(specJson) as AiInterfaceSourceSpec;
    } catch {
      appToast.error("admin.aiTemplates.invalidJson");
      return;
    }

    if (sourceSpec.meta.id !== editingTemplate.id) {
      appToast.error("admin.aiTemplates.idMismatch");
      return;
    }

    setIsSaving(true);
    try {
      await saveAdminAiInterfaceTemplate(editingTemplate.id, { sourceSpec });
      appToast.success("admin.aiTemplates.saved");
      setDialogOpen(false);
      await refreshTemplates();
    } catch (error) {
      appToast.errorRaw(
        error instanceof Error ? error.message : t("admin.aiTemplates.saveFailed")
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (template: AiInterfaceTemplateIndex) => {
    if (template.isSystem) {
      appToast.error("admin.aiTemplates.systemDeleteError");
      return;
    }
    if (!window.confirm(t("admin.aiTemplates.deleteConfirm", { name: template.name }))) {
      return;
    }

    try {
      await deleteAdminAiInterfaceTemplate(template.id);
      appToast.success("admin.aiTemplates.deleted");
      await refreshTemplates();
    } catch (error) {
      appToast.errorRaw(
        error instanceof Error ? error.message : t("admin.aiTemplates.deleteFailed")
      );
    }
  };

  if (isTemplatesLoading) {
    return <InsetLoading title={t("admin.aiTemplates.title")} />;
  }

  if (templatesError) {
    return (
      <InsetError
        title={t("admin.aiTemplates.title")}
        errorMessage={t("admin.aiTemplates.loadFailed")}
      />
    );
  }

  return (
    <InsetLayout
      title={t("admin.aiTemplates.title")}
      titleRight={
        <span className="text-muted-foreground text-sm">
          {t("admin.aiTemplates.saveHint")}
        </span>
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("admin.aiTemplates.columns.name")}</TableHead>
            <TableHead>{t("admin.aiTemplates.columns.provider")}</TableHead>
            <TableHead>{t("admin.aiTemplates.columns.version")}</TableHead>
            <TableHead>{t("admin.aiTemplates.columns.status")}</TableHead>
            <TableHead className="text-right">
              {t("admin.aiTemplates.columns.actions")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {templates.map((template) => (
            <TableRow key={template.id}>
              <TableCell>
                <div className="font-medium">{template.name}</div>
                <div className="text-muted-foreground text-xs">{template.id}</div>
              </TableCell>
              <TableCell>{template.provider}</TableCell>
              <TableCell>v{template.specVersion}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {template.enabled ? (
                    <Badge variant="secondary">
                      {t("admin.aiTemplates.enabled")}
                    </Badge>
                  ) : (
                    <Badge variant="outline">
                      {t("admin.aiTemplates.disabled")}
                    </Badge>
                  )}
                  {template.isSystem ? (
                    <Badge variant="outline">
                      {t("admin.aiTemplates.system")}
                    </Badge>
                  ) : null}
                  {template.isDefault ? (
                    <Badge variant="outline">
                      {t("admin.aiTemplates.default")}
                    </Badge>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="text-right space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenEdit(template)}
                >
                  {t("admin.aiTemplates.editSpec")}
                </Button>
                {!template.isSystem ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(template)}
                  >
                    {t("common.delete")}
                  </Button>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate?.name ?? t("admin.aiTemplates.title")} —{" "}
              {t("admin.aiTemplates.sourceSpec")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="source-spec">
              {t("admin.aiTemplates.sourceSpecLabel")}
            </Label>
            <Textarea
              id="source-spec"
              value={specJson}
              onChange={(event) => setSpecJson(event.target.value)}
              className="min-h-[420px] font-mono text-xs"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? t("common.saving") : t("admin.aiTemplates.saveCompile")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </InsetLayout>
  );
}
