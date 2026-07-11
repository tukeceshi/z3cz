import type {

  AiInterfaceTemplateIndex,

  OrganizationAiInterface,

} from "@dafthunk/types";

import { VOLCANO_TEMPLATE_ID } from "@dafthunk/types";

import { useState } from "react";

import { useParams } from "react-router";



import { InsetError } from "@/components/inset-error";

import { InsetLoading } from "@/components/inset-loading";

import { InsetLayout } from "@/components/layouts/inset-layout";

import { useTranslation } from "@/components/locale-provider";

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

import {

  Select,

  SelectContent,

  SelectItem,

  SelectTrigger,

  SelectValue,

} from "@/components/ui/select";

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

  createOrganizationAiInterface,

  updateOrganizationAiInterface,

  useAiInterfaceCatalog,

  useOrganizationAiInterfaces,

} from "@/services/organization-ai-interface-service";



import { DeleteAiInterfaceDialog } from "./organization-ai-interfaces/delete-ai-interface-dialog";

import { VolcanoInterfacePanel } from "./organization-ai-interfaces/volcano-interface-panel";

import { VolcanoWizardDialog } from "./organization-ai-interfaces/volcano-wizard-dialog";



interface InterfaceFormState {

  templateId: string;

  name: string;

  apiKey: string;

  baseUrl: string;

  selectedModel: string;

  templateVersion: string;

  enabled: boolean;

  isDefault: boolean;

}



const emptyForm = (): InterfaceFormState => ({

  templateId: "",

  name: "",

  apiKey: "",

  baseUrl: "",

  selectedModel: "",

  templateVersion: "",

  enabled: true,

  isDefault: false,

});



function formFromInterface(

  iface: OrganizationAiInterface

): InterfaceFormState {

  return {

    templateId: iface.templateId,

    name: iface.name,

    apiKey: "",

    baseUrl: iface.baseUrl ?? "",

    selectedModel: iface.selectedModel ?? "",

    templateVersion:

      iface.templateVersion != null ? String(iface.templateVersion) : "",

    enabled: iface.enabled,

    isDefault: iface.isDefault,

  };

}



export function OrganizationAiInterfacesPage() {

  const { t } = useTranslation();

  const appToast = useAppToast();

  const { organizationId } = useParams<{ organizationId: string }>();

  const {

    interfaces,

    interfacesError,

    isInterfacesLoading,

    refreshInterfaces,

  } = useOrganizationAiInterfaces(organizationId);

  const { catalog, isCatalogLoading } = useAiInterfaceCatalog(organizationId);

  const [legacyDialogOpen, setLegacyDialogOpen] = useState(false);

  const [volcanoWizardOpen, setVolcanoWizardOpen] = useState(false);

  const [editingInterface, setEditingInterface] =

    useState<OrganizationAiInterface | null>(null);

  const [form, setForm] = useState<InterfaceFormState>(emptyForm);

  const [isSaving, setIsSaving] = useState(false);

  const [interfaceToDelete, setInterfaceToDelete] =

    useState<OrganizationAiInterface | null>(null);



  const volcanoCatalogEntry = catalog.find(

    (template) => template.id === VOLCANO_TEMPLATE_ID

  );

  const legacyCatalog = catalog.filter(

    (template) => template.id !== VOLCANO_TEMPLATE_ID

  );

  const volcanoInterfaces = interfaces.filter(

    (iface) => iface.templateId === VOLCANO_TEMPLATE_ID

  );

  const legacyInterfaces = interfaces.filter(

    (iface) => iface.templateId !== VOLCANO_TEMPLATE_ID

  );



  usePageBreadcrumbs([

    {

      label: t("sidebar.aiInterfaces"),

      to: `/org/${organizationId}/ai-interfaces`,

    },

  ]);



  const selectedTemplate = catalog.find(

    (template) => template.id === form.templateId

  );



  const handleOpenCreate = () => {

    if (volcanoCatalogEntry) {

      setVolcanoWizardOpen(true);

      return;

    }

    setEditingInterface(null);

    setForm({

      ...emptyForm(),

      templateId: legacyCatalog[0]?.id ?? "",

    });

    setLegacyDialogOpen(true);

  };



  const handleOpenEdit = (iface: OrganizationAiInterface) => {

    setEditingInterface(iface);

    setForm(formFromInterface(iface));

    setLegacyDialogOpen(true);

  };



  const handleSave = async () => {

    if (!organizationId) return;

    if (!form.name.trim() || !form.templateId) {

      appToast.error("pages.aiInterfaces.nameTemplateRequired");

      return;

    }

    if (!editingInterface && !form.apiKey.trim()) {

      appToast.error("pages.aiInterfaces.apiKeyRequired");

      return;

    }



    setIsSaving(true);

    try {

      const templateVersion =

        form.templateVersion.trim().length > 0

          ? Number.parseInt(form.templateVersion, 10)

          : null;



      if (editingInterface) {

        await updateOrganizationAiInterface(organizationId, editingInterface.id, {

          name: form.name.trim(),

          enabled: form.enabled,

          isDefault: form.isDefault,

          baseUrl: form.baseUrl.trim() || null,

          selectedModel: form.selectedModel.trim() || null,

          templateVersion,

          ...(form.apiKey.trim() ? { apiKey: form.apiKey.trim() } : {}),

        });

        appToast.success("pages.aiInterfaces.updated");

      } else {

        await createOrganizationAiInterface(organizationId, {

          templateId: form.templateId,

          name: form.name.trim(),

          apiKey: form.apiKey.trim(),

          enabled: form.enabled,

          isDefault: form.isDefault,

          baseUrl: form.baseUrl.trim() || null,

          selectedModel: form.selectedModel.trim() || null,

          templateVersion,

        });

        appToast.success("pages.aiInterfaces.created");

      }



      setLegacyDialogOpen(false);

      await refreshInterfaces();

    } catch (error) {

      appToast.errorRaw(

        error instanceof Error ? error.message : t("pages.aiInterfaces.saveFailed")

      );

    } finally {

      setIsSaving(false);

    }

  };



  const handleRequestDelete = (iface: OrganizationAiInterface) => {

    setInterfaceToDelete(iface);

  };



  if (isInterfacesLoading || isCatalogLoading) {

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

        <Button onClick={handleOpenCreate} disabled={catalog.length === 0}>

          {t("pages.aiInterfaces.addButton")}

        </Button>

      }

    >

      <p className="text-muted-foreground mb-4 text-sm">

        {t("pages.aiInterfaces.description")}

      </p>

      {catalog.length === 0 ? (

        <p className="text-muted-foreground text-sm">

          {t("pages.aiInterfaces.noTemplates")}

        </p>

      ) : null}



      {volcanoInterfaces.length > 0 ? (

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

        </div>

      ) : null}



      {legacyInterfaces.length > 0 ? (

        <Table>

          <TableHeader>

            <TableRow>

              <TableHead>{t("common.name")}</TableHead>

              <TableHead>{t("pages.aiInterfaces.template")}</TableHead>

              <TableHead>{t("pages.aiInterfaces.provider")}</TableHead>

              <TableHead>{t("pages.aiInterfaces.version")}</TableHead>

              <TableHead>{t("pages.aiInterfaces.status")}</TableHead>

              <TableHead className="text-right">{t("common.actions")}</TableHead>

            </TableRow>

          </TableHeader>

          <TableBody>

            {legacyInterfaces.map((iface) => (

              <TableRow key={iface.id}>

                <TableCell className="font-medium">{iface.name}</TableCell>

                <TableCell>{iface.templateId}</TableCell>

                <TableCell>{iface.provider}</TableCell>

                <TableCell>

                  {iface.templateVersion != null

                    ? `v${iface.templateVersion}`

                    : t("pages.aiInterfaces.versionPlaceholder")}

                </TableCell>

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

                    {iface.isDefault ? (

                      <Badge variant="outline">

                        {t("adminWorkflowSchemes.defaultBadge")}

                      </Badge>

                    ) : null}

                  </div>

                </TableCell>

                <TableCell className="text-right space-x-2">

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

      ) : volcanoInterfaces.length === 0 ? (

        <p className="text-muted-foreground text-sm">

          {t("pages.aiInterfaces.volcano.empty")}

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

        <VolcanoWizardDialog

          open={volcanoWizardOpen}

          organizationId={organizationId}

          onOpenChange={setVolcanoWizardOpen}

          onCreated={refreshInterfaces}

        />

      ) : null}



      <Dialog open={legacyDialogOpen} onOpenChange={setLegacyDialogOpen}>

        <DialogContent>

          <DialogHeader>

            <DialogTitle>

              {editingInterface

                ? t("pages.aiInterfaces.editTitle")

                : t("pages.aiInterfaces.addTitle")}

            </DialogTitle>

          </DialogHeader>

          <div className="space-y-4">

            {!editingInterface ? (

              <div className="space-y-2">

                <Label>{t("pages.aiInterfaces.template")}</Label>

                <Select

                  value={form.templateId}

                  onValueChange={(value) =>

                    setForm((current) => ({ ...current, templateId: value }))

                  }

                >

                  <SelectTrigger>

                    <SelectValue

                      placeholder={t("pages.aiInterfaces.templatePlaceholder")}

                    />

                  </SelectTrigger>

                  <SelectContent>

                    {legacyCatalog.map((template: AiInterfaceTemplateIndex) => (

                      <SelectItem key={template.id} value={template.id}>

                        {template.name}

                      </SelectItem>

                    ))}

                  </SelectContent>

                </Select>

              </div>

            ) : null}



            <div className="space-y-2">

              <Label htmlFor="iface-name">{t("common.name")}</Label>

              <Input

                id="iface-name"

                value={form.name}

                onChange={(event) =>

                  setForm((current) => ({ ...current, name: event.target.value }))

                }

              />

            </div>



            <div className="space-y-2">

              <Label htmlFor="iface-api-key">

                {editingInterface

                  ? t("pages.aiInterfaces.apiKeyKeepHint")

                  : t("pages.aiInterfaces.apiKey")}

              </Label>

              <Input

                id="iface-api-key"

                type="password"

                value={form.apiKey}

                onChange={(event) =>

                  setForm((current) => ({ ...current, apiKey: event.target.value }))

                }

              />

            </div>



            <div className="space-y-2">

              <Label htmlFor="iface-base-url">

                {t("pages.aiInterfaces.baseUrl")}

              </Label>

              <Input

                id="iface-base-url"

                placeholder={

                  selectedTemplate

                    ? t("pages.aiInterfaces.baseUrlPlaceholder")

                    : ""

                }

                value={form.baseUrl}

                onChange={(event) =>

                  setForm((current) => ({ ...current, baseUrl: event.target.value }))

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



            <div className="space-y-2">

              <Label htmlFor="iface-version">

                {t("pages.aiInterfaces.versionHint")}

              </Label>

              <Input

                id="iface-version"

                inputMode="numeric"

                placeholder={t("pages.aiInterfaces.versionPlaceholder")}

                value={form.templateVersion}

                onChange={(event) =>

                  setForm((current) => ({

                    ...current,

                    templateVersion: event.target.value,

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



            <div className="flex items-center justify-between">

              <Label htmlFor="iface-default">

                {t("pages.aiInterfaces.defaultForProvider")}

              </Label>

              <Switch

                id="iface-default"

                checked={form.isDefault}

                onCheckedChange={(checked) =>

                  setForm((current) => ({ ...current, isDefault: checked }))

                }

              />

            </div>

          </div>

          <DialogFooter>

            <Button variant="outline" onClick={() => setLegacyDialogOpen(false)}>

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


