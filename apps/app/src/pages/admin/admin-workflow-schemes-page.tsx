import type {
  CreateWorkflowSchemeRequest,
  UpdateWorkflowSchemeRequest,
  WorkflowRuntime,
  WorkflowScheme,
  WorkflowTrigger,
} from "@dafthunk/types";
import { WORKFLOW_SCHEME_OMNIPOTENT_ID } from "@dafthunk/types";
import {
  ALL_WORKFLOW_RUNTIMES,
  ALL_WORKFLOW_TRIGGERS,
} from "@dafthunk/types";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  SchemeNodeCatalogEditor,
  summarizeSchemeNodes,
  type SchemeNodeCatalogValue,
} from "@/components/admin/scheme-node-catalog-editor";
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
import { Textarea } from "@/components/ui/textarea";
import { useNodeTypes } from "@/services/type-service";
import {
  createAdminWorkflowScheme,
  deleteAdminWorkflowScheme,
  updateAdminWorkflowScheme,
  useAdminWorkflowSchemes,
} from "@/services/workflow-scheme-service";
import { cn } from "@/utils/utils";

interface SchemeFormState {
  id: string;
  name: string;
  description: string;
  icon: string;
  allowedTriggers: WorkflowTrigger[];
  allowedRuntimes: WorkflowRuntime[];
  nodeCatalog: SchemeNodeCatalogValue;
  enabled: boolean;
  isDefault: boolean;
}

const emptyNodeCatalog = (): SchemeNodeCatalogValue => ({
  unrestricted: true,
  includeTags: [],
  includeNodeTypes: [],
  excludeNodeTypes: "",
});

const emptyForm = (): SchemeFormState => ({
  id: "",
  name: "",
  description: "",
  icon: "layers",
  allowedTriggers: [...ALL_WORKFLOW_TRIGGERS],
  allowedRuntimes: [...ALL_WORKFLOW_RUNTIMES],
  nodeCatalog: emptyNodeCatalog(),
  enabled: true,
  isDefault: false,
});

function schemeToForm(scheme: WorkflowScheme): SchemeFormState {
  const hasIncludes =
    (scheme.nodeRules.includeTags?.length ?? 0) > 0 ||
    (scheme.nodeRules.includeNodeTypes?.length ?? 0) > 0;

  return {
    id: scheme.id,
    name: scheme.name,
    description: scheme.description ?? "",
    icon: scheme.icon ?? "layers",
    allowedTriggers: [...scheme.allowedTriggers],
    allowedRuntimes: [...scheme.allowedRuntimes],
    nodeCatalog: {
      unrestricted: !hasIncludes,
      includeTags: scheme.nodeRules.includeTags
        ? [...scheme.nodeRules.includeTags]
        : [],
      includeNodeTypes: scheme.nodeRules.includeNodeTypes
        ? [...scheme.nodeRules.includeNodeTypes]
        : [],
      excludeNodeTypes: scheme.nodeRules.excludeNodeTypes?.join("\n") ?? "",
    },
    enabled: scheme.enabled,
    isDefault: scheme.isDefault,
  };
}

function buildNodeRules(nodeCatalog: SchemeNodeCatalogValue) {
  const excludeNodeTypes = nodeCatalog.excludeNodeTypes
    .split(/[\n,]+/)
    .map((value) => value.trim())
    .filter(Boolean);

  if (nodeCatalog.unrestricted) {
    return {
      includeTags: [] as string[],
      includeNodeTypes: [] as string[],
      excludeNodeTypes,
    };
  }

  return {
    includeTags: nodeCatalog.includeTags,
    includeNodeTypes: nodeCatalog.includeNodeTypes,
    excludeNodeTypes,
  };
}

export function AdminWorkflowSchemesPage() {
  const { t } = useTranslation();
  const setBreadcrumbs = useBreadcrumbsSetter();
  const { schemes, schemesError, isSchemesLoading, refreshSchemes } =
    useAdminWorkflowSchemes();
  const { nodeTypes } = useNodeTypes(undefined, { revalidateOnFocus: false });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingScheme, setEditingScheme] = useState<WorkflowScheme | null>(
    null
  );
  const [form, setForm] = useState<SchemeFormState>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  const visibleSchemes = useMemo(
    () => schemes.filter((scheme) => scheme.id !== WORKFLOW_SCHEME_OMNIPOTENT_ID),
    [schemes]
  );

  useEffect(() => {
    setBreadcrumbs([{ label: t("adminWorkflowSchemes.title") }]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs, t]);

  const openCreateDialog = () => {
    setEditingScheme(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEditDialog = (scheme: WorkflowScheme) => {
    setEditingScheme(scheme);
    setForm(schemeToForm(scheme));
    setDialogOpen(true);
  };

  const toggleTrigger = (trigger: WorkflowTrigger) => {
    setForm((current) => {
      const selected = new Set(current.allowedTriggers);
      if (selected.has(trigger)) {
        selected.delete(trigger);
      } else {
        selected.add(trigger);
      }
      return {
        ...current,
        allowedTriggers: [...selected],
      };
    });
  };

  const toggleRuntime = (runtime: WorkflowRuntime) => {
    setForm((current) => {
      const selected = new Set(current.allowedRuntimes);
      if (selected.has(runtime)) {
        selected.delete(runtime);
      } else {
        selected.add(runtime);
      }
      return {
        ...current,
        allowedRuntimes: [...selected],
      };
    });
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);

    const nodeRules = buildNodeRules(form.nodeCatalog);

    if (
      !form.nodeCatalog.unrestricted &&
      nodeRules.includeTags.length === 0 &&
      nodeRules.includeNodeTypes.length === 0
    ) {
      toast.error(t("adminWorkflowSchemes.nodeSelectionRequired"));
      setIsSaving(false);
      return;
    }

    try {
      if (editingScheme) {
        const payload: UpdateWorkflowSchemeRequest = {
          name: form.name.trim(),
          description: form.description.trim() || null,
          icon: form.icon.trim() || null,
          allowedTriggers: form.allowedTriggers,
          allowedRuntimes: form.allowedRuntimes,
          nodeRules,
          enabled: form.enabled,
          isDefault: form.isDefault,
        };
        await updateAdminWorkflowScheme(editingScheme.id, payload);
      } else {
        const payload: CreateWorkflowSchemeRequest = {
          id: form.id.trim(),
          name: form.name.trim(),
          description: form.description.trim() || null,
          icon: form.icon.trim() || null,
          allowedTriggers: form.allowedTriggers,
          allowedRuntimes: form.allowedRuntimes,
          nodeRules,
          enabled: form.enabled,
        };
        await createAdminWorkflowScheme(payload);
      }

      await refreshSchemes();
      setDialogOpen(false);
      toast.success(t("adminWorkflowSchemes.saveSuccess"));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("adminWorkflowSchemes.saveError")
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (scheme: WorkflowScheme) => {
    if (scheme.isSystem) {
      return;
    }
    if (!window.confirm(t("adminWorkflowSchemes.deleteConfirm"))) {
      return;
    }

    try {
      await deleteAdminWorkflowScheme(scheme.id);
      await refreshSchemes();
      toast.success(t("adminWorkflowSchemes.deleteSuccess"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("adminWorkflowSchemes.deleteError")
      );
    }
  };

  if (isSchemesLoading) {
    return <InsetLoading title={t("adminWorkflowSchemes.title")} />;
  }

  if (schemesError) {
    return (
      <InsetError
        title={t("adminWorkflowSchemes.title")}
        errorMessage={schemesError.message}
      />
    );
  }

  return (
    <InsetLayout
      title={t("adminWorkflowSchemes.title")}
      titleRight={
        <Button onClick={openCreateDialog}>
          {t("adminWorkflowSchemes.create")}
        </Button>
      }
    >
      <p className="mb-6 text-sm text-muted-foreground">
        {t("adminWorkflowSchemes.description")}
      </p>
      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("adminWorkflowSchemes.columns.name")}</TableHead>
              <TableHead>{t("adminWorkflowSchemes.columns.triggers")}</TableHead>
              <TableHead>{t("adminWorkflowSchemes.columns.runtimes")}</TableHead>
              <TableHead>{t("adminWorkflowSchemes.columns.nodes")}</TableHead>
              <TableHead>{t("adminWorkflowSchemes.columns.status")}</TableHead>
              <TableHead className="text-right">
                {t("adminWorkflowSchemes.columns.actions")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleSchemes.map((scheme) => (
              <TableRow key={scheme.id}>
                <TableCell>
                  <div className="font-medium">{scheme.name}</div>
                  <div className="text-xs text-muted-foreground">{scheme.id}</div>
                </TableCell>
                <TableCell>{scheme.allowedTriggers.length}</TableCell>
                <TableCell>{scheme.allowedRuntimes.length}</TableCell>
                <TableCell>
                  {summarizeSchemeNodes(nodeTypes, scheme.nodeRules, t)}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    {scheme.isDefault ? (
                      <Badge variant="secondary">
                        {t("adminWorkflowSchemes.defaultBadge")}
                      </Badge>
                    ) : null}
                    {scheme.isSystem ? (
                      <Badge variant="outline">
                        {t("adminWorkflowSchemes.systemBadge")}
                      </Badge>
                    ) : null}
                    {!scheme.enabled ? (
                      <Badge variant="destructive">
                        {t("adminWorkflowSchemes.disabledBadge")}
                      </Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(scheme)}
                    >
                      {t("adminWorkflowSchemes.edit")}
                    </Button>
                    {!scheme.isSystem ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(scheme)}
                      >
                        {t("adminWorkflowSchemes.delete")}
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingScheme
                ? t("adminWorkflowSchemes.editTitle")
                : t("adminWorkflowSchemes.createTitle")}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-6">
            {!editingScheme ? (
              <div>
                <Label htmlFor="scheme-id">{t("adminWorkflowSchemes.id")}</Label>
                <Input
                  id="scheme-id"
                  value={form.id}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, id: event.target.value }))
                  }
                  placeholder="ai-content"
                  className="mt-2"
                  required
                  pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
                />
              </div>
            ) : null}

            <div>
              <Label htmlFor="scheme-name">{t("adminWorkflowSchemes.name")}</Label>
              <Input
                id="scheme-name"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                className="mt-2"
                required
              />
            </div>

            <div>
              <Label htmlFor="scheme-description">
                {t("adminWorkflowSchemes.schemeDescription")}
              </Label>
              <Textarea
                id="scheme-description"
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                className="mt-2"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="scheme-icon">{t("adminWorkflowSchemes.icon")}</Label>
              <Input
                id="scheme-icon"
                value={form.icon}
                onChange={(event) =>
                  setForm((current) => ({ ...current, icon: event.target.value }))
                }
                className="mt-2"
                placeholder="layers"
              />
            </div>

            <div>
              <Label>{t("adminWorkflowSchemes.allowedTriggers")}</Label>
              <div className="mt-3 flex flex-wrap gap-2">
                {ALL_WORKFLOW_TRIGGERS.map((trigger) => (
                  <button
                    key={trigger}
                    type="button"
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs transition-colors",
                      form.allowedTriggers.includes(trigger)
                        ? "border-primary bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted/50"
                    )}
                    onClick={() => toggleTrigger(trigger)}
                  >
                    {trigger}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label>{t("adminWorkflowSchemes.allowedRuntimes")}</Label>
              <div className="mt-3 flex flex-wrap gap-2">
                {ALL_WORKFLOW_RUNTIMES.map((runtime) => (
                  <button
                    key={runtime}
                    type="button"
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs transition-colors",
                      form.allowedRuntimes.includes(runtime)
                        ? "border-primary bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted/50"
                    )}
                    onClick={() => toggleRuntime(runtime)}
                  >
                    {runtime}
                  </button>
                ))}
              </div>
            </div>

            <SchemeNodeCatalogEditor
              nodeTypes={nodeTypes}
              allowedTriggers={form.allowedTriggers}
              value={form.nodeCatalog}
              onChange={(nodeCatalog) =>
                setForm((current) => ({ ...current, nodeCatalog }))
              }
            />

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label htmlFor="scheme-enabled">
                  {t("adminWorkflowSchemes.enabled")}
                </Label>
              </div>
              <Switch
                id="scheme-enabled"
                checked={form.enabled}
                onCheckedChange={(checked) =>
                  setForm((current) => ({ ...current, enabled: checked }))
                }
              />
            </div>

            {editingScheme ? (
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label htmlFor="scheme-default">
                    {t("adminWorkflowSchemes.defaultScheme")}
                  </Label>
                </div>
                <Switch
                  id="scheme-default"
                  checked={form.isDefault}
                  onCheckedChange={(checked) =>
                    setForm((current) => ({ ...current, isDefault: checked }))
                  }
                />
              </div>
            ) : null}

            <Button
              type="submit"
              className="w-full"
              disabled={
                isSaving ||
                !form.name.trim() ||
                form.allowedTriggers.length === 0 ||
                form.allowedRuntimes.length === 0 ||
                (!editingScheme && !form.id.trim())
              }
            >
              {isSaving ? t("common.saving") : t("common.save")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </InsetLayout>
  );
}
