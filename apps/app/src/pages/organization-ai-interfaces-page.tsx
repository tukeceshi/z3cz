import type { OrganizationAiInterface } from "@dafthunk/types";
import {
  isSingleModelAiInterface,
  isVolcanoAiInterfaceProvider,
} from "@dafthunk/types";
import { useState } from "react";
import { useParams } from "react-router";

import { InsetError } from "@/components/inset-error";
import { InsetLoading } from "@/components/inset-loading";
import { InsetLayout } from "@/components/layouts/inset-layout";
import { OrgPermissionGate } from "@/components/org-permission-gate";
import { useTranslation } from "@/components/locale-provider";
import { useOrgPermissions } from "@/hooks/use-org-permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAppToast } from "@/hooks/use-app-toast";
import { usePageBreadcrumbs } from "@/hooks/use-page";
import {
  updateOrganizationAiInterface,
  useOrganizationAiInterfaces,
} from "@/services/organization-ai-interface-service";

import { DeleteAiInterfaceDialog } from "./organization-ai-interfaces/delete-ai-interface-dialog";
import { ModelInterfacePriorityDialog } from "./organization-ai-interfaces/model-interface-priority-dialog";
import { AddInterfaceWizardDialog } from "./organization-ai-interfaces/add-interface-wizard-dialog";
import { SingleModelProviderPanel } from "./organization-ai-interfaces/single-model-provider-panel";
import { VolcanoInterfacePanel } from "./organization-ai-interfaces/volcano-interface-panel";

interface InterfaceFormState {
  name: string;
  apiKey: string;
  baseUrl: string;
  selectedModel: string;
  enabled: boolean;
  isDefault: boolean;
}

const emptyForm = (): InterfaceFormState => ({
  name: "",
  apiKey: "",
  baseUrl: "",
  selectedModel: "",
  enabled: true,
  isDefault: false,
});

function formFromInterface(
  iface: OrganizationAiInterface
): InterfaceFormState {
  return {
    name: iface.name,
    apiKey: "",
    baseUrl: iface.baseUrl ?? "",
    selectedModel: iface.selectedModel ?? "",
    enabled: iface.enabled,
    isDefault: iface.isDefault,
  };
}

export function OrganizationAiInterfacesPage() {
  const { t } = useTranslation();
  const perms = useOrgPermissions();

  if (!perms.canAccessAiInterfaces) {
    return (
      <OrgPermissionGate allowed={false} title={t("sidebar.aiInterfaces")}>
        {null}
      </OrgPermissionGate>
    );
  }

  return <OrganizationAiInterfacesPageContent />;
}

function OrganizationAiInterfacesPageContent() {
  const { t } = useTranslation();
  const appToast = useAppToast();
  const { organizationId } = useParams<{ organizationId: string }>();
  const {
    interfaces,
    interfacesError,
    isInterfacesLoading,
    refreshInterfaces,
  } = useOrganizationAiInterfaces(organizationId);

  const [legacyDialogOpen, setLegacyDialogOpen] = useState(false);
  const [addWizardOpen, setAddWizardOpen] = useState(false);
  const [editingInterface, setEditingInterface] =
    useState<OrganizationAiInterface | null>(null);
  const [form, setForm] = useState<InterfaceFormState>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [interfaceToDelete, setInterfaceToDelete] =
    useState<OrganizationAiInterface | null>(null);

  const volcanoInterfaces = interfaces.filter((iface) =>
    isVolcanoAiInterfaceProvider(iface.provider)
  );
  const singleModelInterfaces = interfaces.filter((iface) =>
    isSingleModelAiInterface(iface)
  );
  const legacyInterfaces = interfaces.filter(
    (iface) =>
      !isVolcanoAiInterfaceProvider(iface.provider) &&
      !isSingleModelAiInterface(iface)
  );

  const cardInterfaces = [...volcanoInterfaces, ...singleModelInterfaces];

  usePageBreadcrumbs([
    {
      label: t("sidebar.aiInterfaces"),
      to: `/org/${organizationId}/ai-interfaces`,
    },
  ]);

  const handleOpenCreate = () => {
    setAddWizardOpen(true);
  };

  const handleOpenEdit = (iface: OrganizationAiInterface) => {
    setEditingInterface(iface);
    setForm(formFromInterface(iface));
    setLegacyDialogOpen(true);
  };

  const handleSave = async () => {
    if (!organizationId || !editingInterface) return;
    if (!form.name.trim()) {
      appToast.error("pages.aiInterfaces.nameTemplateRequired");
      return;
    }

    setIsSaving(true);
    try {
      await updateOrganizationAiInterface(organizationId, editingInterface.id, {
        name: form.name.trim(),
        enabled: form.enabled,
        isDefault: form.isDefault,
        baseUrl: form.baseUrl.trim() || null,
        selectedModel: form.selectedModel.trim() || null,
        ...(form.apiKey.trim() ? { apiKey: form.apiKey.trim() } : {}),
      });
      appToast.success("pages.aiInterfaces.updated");
      setLegacyDialogOpen(false);
      await refreshInterfaces();
    } catch (error) {
      appToast.errorRaw(
        error instanceof Error
          ? error.message
          : t("pages.aiInterfaces.saveFailed")
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleRequestDelete = (iface: OrganizationAiInterface) => {
    setInterfaceToDelete(iface);
  };

  if (isInterfacesLoading) {
    return <InsetLoading title={t("pages.aiInterfaces.title")} />;
  }

  if (interfacesError) {
    return (
      <InsetError
        title={t("pages.aiInterfaces.title")}
        errorMessage={t("pages.aiInterfaces.loadFailed")}
      />
    );
  }

  return (
    <InsetLayout
      title={t("pages.aiInterfaces.title")}
      titleRight={
        <div className="flex items-center gap-2">
          <ModelInterfacePriorityDialog orgId={organizationId!} />
          <Button onClick={handleOpenCreate}>
            {t("pages.aiInterfaces.addButton")}
          </Button>
        </div>
      }
    >
      <p className="text-muted-foreground mb-4 text-sm">
        {t("pages.aiInterfaces.description")}
      </p>

      {cardInterfaces.length > 0 ? (
        <div className="mb-6 space-y-3">
          {volcanoInterfaces.map((iface) => (
            <VolcanoInterfacePanel
              key={iface.id}
              organizationId={organizationId!}
              iface={iface}
              onUpdated={refreshInterfaces}
              onDelete={() => handleRequestDelete(iface)}
            />
          ))}
          {singleModelInterfaces.map((iface) => (
            <SingleModelProviderPanel
              key={iface.id}
              organizationId={organizationId!}
              iface={iface}
              onUpdated={refreshInterfaces}
              onDelete={() => handleRequestDelete(iface)}
            />
          ))}
        </div>
      ) : null}

      {legacyInterfaces.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.name")}</TableHead>
              <TableHead>{t("pages.aiInterfaces.provider")}</TableHead>
              <TableHead>{t("pages.aiInterfaces.status")}</TableHead>
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {legacyInterfaces.map((iface) => (
              <TableRow key={iface.id}>
                <TableCell className="font-medium">{iface.name}</TableCell>
                <TableCell>{iface.provider}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {iface.enabled ? (
                      <Badge variant="secondary">
                        {t("pages.aiInterfaces.enabled")}
                      </Badge>
                    ) : (
                      <Badge variant="outline">
                        {t("adminWorkflowSchemes.disabledBadge")}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="space-x-2 text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenEdit(iface)}
                  >
                    {t("common.edit")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRequestDelete(iface)}
                  >
                    {t("common.delete")}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : cardInterfaces.length === 0 && legacyInterfaces.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {t("pages.aiInterfaces.empty")}
        </p>
      ) : null}

      {organizationId ? (
        <DeleteAiInterfaceDialog
          organizationId={organizationId}
          iface={interfaceToDelete}
          open={interfaceToDelete !== null}
          onOpenChange={(open) => {
            if (!open) setInterfaceToDelete(null);
          }}
          onDeleted={refreshInterfaces}
        />
      ) : null}

      {organizationId ? (
        <AddInterfaceWizardDialog
          open={addWizardOpen}
          organizationId={organizationId}
          onOpenChange={setAddWizardOpen}
          onCreated={refreshInterfaces}
        />
      ) : null}

      <Dialog open={legacyDialogOpen} onOpenChange={setLegacyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("pages.aiInterfaces.editTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="iface-name">{t("common.name")}</Label>
              <Input
                id="iface-name"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="iface-api-key">
                {t("pages.aiInterfaces.apiKeyKeepHint")}
              </Label>
              <Input
                id="iface-api-key"
                type="password"
                value={form.apiKey}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    apiKey: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="iface-base-url">
                {t("pages.aiInterfaces.baseUrl")}
              </Label>
              <Input
                id="iface-base-url"
                value={form.baseUrl}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    baseUrl: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="iface-model">{t("pages.aiInterfaces.model")}</Label>
              <Input
                id="iface-model"
                value={form.selectedModel}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    selectedModel: event.target.value,
                  }))
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="iface-enabled">
                {t("pages.aiInterfaces.enabled")}
              </Label>
              <Switch
                id="iface-enabled"
                checked={form.enabled}
                onCheckedChange={(checked) =>
                  setForm((current) => ({ ...current, enabled: checked }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setLegacyDialogOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </InsetLayout>
  );
}
