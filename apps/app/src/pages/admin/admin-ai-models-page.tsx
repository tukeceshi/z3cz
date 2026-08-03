import {
  DEFAULT_IMAGE_MODEL_PARAMETER_RULES,
  DEFAULT_TEXT_MODEL_PARAMETER_RULES,
  DEFAULT_VIDEO_MODEL_PARAMETER_RULES,
  isImageModelParameterRules,
  isTextModelParameterRules,
  isVideoModelParameterRules,
  normalizeImageModelParameterRules,
  normalizeTextModelParameterRules,
  normalizeVideoModelParameterRules,
} from "@dafthunk/types";
import type {
  GenerationCountPolicy,
  GenerationSizePolicy,
  ImageModelParameterRules,
  PlatformAiModel,
  PlatformAiModelGroup,
  TextModelParameterRules,
  UpstreamParamProfileField,
  VideoModelParameterRules,
} from "@dafthunk/types";
import ChevronDownIcon from "lucide-react/icons/chevron-down";
import ChevronUpIcon from "lucide-react/icons/chevron-up";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { InsetLayout } from "@/components/layouts/inset-layout";
import { useTranslation } from "@/components/locale-provider";
import {
  GROUP_ICON_OPTIONS,
  ModelBrandIcon,
} from "@/components/model-brand-icon";
import { useBreadcrumbsSetter } from "@/components/page-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  createAdminPlatformAiModelGroup,
  deleteAdminPlatformAiModelGroup,
  reorderAdminPlatformAiModelGroups,
  updateAdminPlatformAiModel,
  updateAdminPlatformAiModelGroup,
  useAdminPlatformAiModels,
} from "@/services/admin-ai-model-service";
import { cn } from "@/utils/utils";

import {
  GenerationFeaturesEditor,
  ImageCountEditor,
  SizePolicyEditor,
  useGenerationOptionLabels,
} from "./admin-generation-field-editors";
import {
  ADMIN_CONTROL_CLASS,
  ADMIN_CONTROL_WIDTH_CLASS,
  ADMIN_NO_GROUP_VALUE,
  AdminModelList,
  CollapsibleSettingsSection,
  ImageModelBasicFields,
  MbField,
  ModelBasicFields,
  ModelSettingsDialogShell,
  NumberField,
  SettingsSection,
  useAdminParamApiNameAddon,
} from "./admin-ai-models-ui";
const BYTES_PER_MB = 1024 * 1024;

type AdminModelModality = "text" | "image" | "video";

function bytesToMbInput(bytes: number): string {
  const mb = bytes / BYTES_PER_MB;
  return String(Math.round(mb * 100) / 100);
}

function mbInputToBytes(mb: string, fallbackBytes: number): number {
  const value = Number(mb);
  if (!Number.isFinite(value) || value <= 0) {
    return fallbackBytes;
  }
  return Math.round(value * BYTES_PER_MB);
}

export function AdminAiModelsPage() {
  const { t } = useTranslation();
  const setBreadcrumbs = useBreadcrumbsSetter();
  const [modality, setModality] = useState<AdminModelModality>("text");
  const { models, groups, isLoading, refreshModels } =
    useAdminPlatformAiModels(modality);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [reorderingGroups, setReorderingGroups] = useState(false);
  const [settingsModel, setSettingsModel] = useState<PlatformAiModel | null>(
    null
  );
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [groupFormOpen, setGroupFormOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupDraft, setGroupDraft] = useState<{
    id: string;
    name: string;
    description: string;
    icon: string;
  }>({ id: "", name: "", description: "", icon: "sparkles" });
  const [savingGroup, setSavingGroup] = useState(false);

  const orderedGroups = useMemo(
    () =>
      [...groups].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)
      ),
    [groups]
  );

  useEffect(() => {
    setBreadcrumbs([
      { label: t("sidebar.admin"), to: "/admin" },
      { label: t("pages.adminAiModels.title") },
    ]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs, t]);

  const handleToggle = async (model: PlatformAiModel, enabled: boolean) => {
    setSavingId(model.canonicalId);
    try {
      await updateAdminPlatformAiModel(model.canonicalId, {
        platformEnabled: enabled,
      });
      await refreshModels();
      toast.success(t("pages.adminAiModels.saved"));
    } catch {
      toast.error(t("pages.adminAiModels.saveFailed"));
    } finally {
      setSavingId(null);
    }
  };

  const handleSaveModel = async (
    model: PlatformAiModel,
    patch: {
      readonly displayName?: string;
      readonly rules:
        | TextModelParameterRules
        | ImageModelParameterRules
        | VideoModelParameterRules;
      readonly groupId: string | null;
      readonly description: string;
    }
  ) => {
    setSavingId(model.canonicalId);
    try {
      await updateAdminPlatformAiModel(model.canonicalId, {
        ...(patch.displayName !== undefined
          ? { displayName: patch.displayName }
          : {}),
        parameterRules: patch.rules,
        groupId: patch.groupId,
        description: patch.description,
      });
      await refreshModels();
      toast.success(t("pages.adminAiModels.saved"));
      setSettingsModel(null);
    } catch {
      toast.error(t("pages.adminAiModels.saveFailed"));
    } finally {
      setSavingId(null);
    }
  };

  const resetGroupForm = () => {
    setGroupDraft({ id: "", name: "", description: "", icon: "sparkles" });
    setEditingGroupId(null);
    setGroupFormOpen(false);
  };

  const handleOpenCreateGroup = () => {
    setEditingGroupId(null);
    setGroupDraft({ id: "", name: "", description: "", icon: "sparkles" });
    setGroupFormOpen(true);
  };

  const handleOpenEditGroup = (group: PlatformAiModelGroup) => {
    setEditingGroupId(group.id);
    setGroupDraft({
      id: group.id,
      name: group.name,
      description: group.description,
      icon: group.icon,
    });
    setGroupFormOpen(true);
  };

  const handleSaveGroup = async () => {
    if (!groupDraft.name.trim()) return;
    if (!editingGroupId && !groupDraft.id.trim()) return;

    setSavingGroup(true);
    try {
      if (editingGroupId) {
        await updateAdminPlatformAiModelGroup(editingGroupId, {
          name: groupDraft.name.trim(),
          description: groupDraft.description.trim(),
          icon: groupDraft.icon.trim() || "sparkles",
        });
        toast.success(t("pages.adminAiModels.groupUpdated"));
      } else {
        await createAdminPlatformAiModelGroup({
          id: groupDraft.id.trim(),
          name: groupDraft.name.trim(),
          description: groupDraft.description.trim(),
          icon: groupDraft.icon.trim() || "sparkles",
          modality,
          sortOrder: (orderedGroups.length + 1) * 10,
        });
        toast.success(t("pages.adminAiModels.groupSaved"));
      }
      await refreshModels();
      resetGroupForm();
    } catch {
      toast.error(
        editingGroupId
          ? t("pages.adminAiModels.groupUpdateFailed")
          : t("pages.adminAiModels.groupSaveFailed")
      );
    } finally {
      setSavingGroup(false);
    }
  };

  const handleDeleteGroup = async (group: PlatformAiModelGroup) => {
    setSavingGroup(true);
    try {
      await deleteAdminPlatformAiModelGroup(group.id);
      await refreshModels();
      if (editingGroupId === group.id) {
        resetGroupForm();
      }
      toast.success(t("pages.adminAiModels.groupDeleted"));
    } catch {
      toast.error(t("pages.adminAiModels.groupDeleteFailed"));
    } finally {
      setSavingGroup(false);
    }
  };

  const handleMoveGroup = async (groupId: string, direction: -1 | 1) => {
    const index = orderedGroups.findIndex((group) => group.id === groupId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= orderedGroups.length) {
      return;
    }

    const nextOrder = [...orderedGroups];
    const [removed] = nextOrder.splice(index, 1);
    if (!removed) return;
    nextOrder.splice(nextIndex, 0, removed);

    setReorderingGroups(true);
    try {
      await reorderAdminPlatformAiModelGroups(
        nextOrder.map((group) => group.id)
      );
      await refreshModels();
      toast.success(t("pages.adminAiModels.reorderSaved"));
    } catch {
      toast.error(t("pages.adminAiModels.reorderFailed"));
    } finally {
      setReorderingGroups(false);
    }
  };

  const textTabDescription = t("pages.adminAiModels.description");
  const imageTabDescription = t("pages.adminAiModels.imageDescription");
  const videoTabDescription = t("pages.adminAiModels.videoDescription");

  const modalityTitle =
    modality === "image"
      ? t("pages.adminAiModels.imageModels")
      : modality === "video"
        ? t("pages.adminAiModels.videoModels")
        : t("pages.adminAiModels.textModels");

  const groupIconLabels = {
    defaultLabel: t("pages.adminAiModels.groupIconDefault"),
    doubaoLabel: t("pages.adminAiModels.groupIconDoubao"),
  };

  const renderModelPanel = (emptyLabel: string, description: string) => (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{description}</p>
      <div className="overflow-hidden rounded-lg border bg-card">
        <AdminModelList
          models={models}
          groups={orderedGroups}
          emptyLabel={emptyLabel}
          isLoading={isLoading}
          savingId={savingId}
          onToggle={handleToggle}
          onOpenSettings={setSettingsModel}
        />
      </div>
    </div>
  );

  return (
    <InsetLayout title={t("pages.adminAiModels.title")}>
      <Tabs
        value={modality}
        onValueChange={(value) => setModality(value as AdminModelModality)}
        className="space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="text">
              {t("pages.adminAiModels.textModels")}
            </TabsTrigger>
            <TabsTrigger value="image">
              {t("pages.adminAiModels.imageModels")}
            </TabsTrigger>
            <TabsTrigger value="video">
              {t("pages.adminAiModels.videoModels")}
            </TabsTrigger>
          </TabsList>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setGroupsOpen(true)}
          >
            {t("pages.adminAiModels.manageGroups")}
          </Button>
        </div>

        <TabsContent value="text" className="mt-0">
          {renderModelPanel(t("pages.adminAiModels.empty"), textTabDescription)}
        </TabsContent>
        <TabsContent value="image" className="mt-0">
          {renderModelPanel(
            t("pages.adminAiModels.imageEmpty"),
            imageTabDescription
          )}
        </TabsContent>
        <TabsContent value="video" className="mt-0">
          {renderModelPanel(
            t("pages.adminAiModels.videoEmpty"),
            videoTabDescription
          )}
        </TabsContent>
      </Tabs>

      <Dialog
        open={groupsOpen}
        onOpenChange={(open) => {
          setGroupsOpen(open);
          if (!open) resetGroupForm();
        }}
      >
        <DialogContent className="thin-scrollbar max-h-[85vh] overflow-y-auto pr-1 sm:max-w-lg">
          <DialogHeader className="space-y-1.5 text-left">
            <DialogTitle>
              {t("pages.adminAiModels.groupsTitleFor", {
                type: modalityTitle,
              })}
            </DialogTitle>
            <DialogDescription>
              {t("pages.adminAiModels.groupsDescriptionScoped")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {orderedGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("pages.adminAiModels.groupsEmpty")}
              </p>
            ) : (
              orderedGroups.map((group, index) => (
                <div
                  key={group.id}
                  className="flex items-start gap-3 rounded-md border px-3 py-2.5"
                >
                  <div className="flex flex-col gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={
                        reorderingGroups || savingGroup || index === 0
                      }
                      onClick={() => {
                        void handleMoveGroup(group.id, -1);
                      }}
                      title={t("pages.adminAiModels.moveUp")}
                    >
                      <ChevronUpIcon className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={
                        reorderingGroups ||
                        savingGroup ||
                        index === orderedGroups.length - 1
                      }
                      onClick={() => {
                        void handleMoveGroup(group.id, 1);
                      }}
                      title={t("pages.adminAiModels.moveDown")}
                    >
                      <ChevronDownIcon className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <ModelBrandIcon
                    icon={group.icon}
                    groupId={group.id}
                    className="mt-0.5 size-5"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{group.name}</p>
                    {group.description ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {group.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={savingGroup || reorderingGroups}
                      onClick={() => handleOpenEditGroup(group)}
                    >
                      {t("common.edit")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={savingGroup || reorderingGroups}
                      onClick={() => {
                        void handleDeleteGroup(group);
                      }}
                    >
                      {t("common.delete")}
                    </Button>
                  </div>
                </div>
              ))
            )}

            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  if (groupFormOpen) {
                    resetGroupForm();
                    return;
                  }
                  handleOpenCreateGroup();
                }}
              >
                {groupFormOpen
                  ? t("pages.adminAiModels.hideCreateGroup")
                  : t("pages.adminAiModels.showCreateGroup")}
              </Button>
            </div>

            {groupFormOpen ? (
              <div className="grid gap-2 rounded-md border border-dashed p-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">
                    {t("pages.adminAiModels.groupId")}
                  </Label>
                  <Input
                    className="h-8 text-xs"
                    value={groupDraft.id}
                    disabled={Boolean(editingGroupId)}
                    onChange={(event) =>
                      setGroupDraft((current) => ({
                        ...current,
                        id: event.target.value,
                      }))
                    }
                    placeholder="deepseek"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">
                    {t("pages.adminAiModels.groupName")}
                  </Label>
                  <Input
                    className="h-8 text-xs"
                    value={groupDraft.name}
                    onChange={(event) =>
                      setGroupDraft((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">
                    {t("pages.adminAiModels.groupDescription")}
                  </Label>
                  <Textarea
                    className="min-h-16 text-xs"
                    value={groupDraft.description}
                    onChange={(event) =>
                      setGroupDraft((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label className="text-xs">
                    {t("pages.adminAiModels.groupIcon")}
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={savingGroup}
                        className={cn(
                          ADMIN_CONTROL_CLASS,
                          "justify-start gap-2 px-2"
                        )}
                      >
                        <ModelBrandIcon
                          icon={groupDraft.icon}
                          className="size-5"
                        />
                        <span className="truncate text-xs">
                          {formatGroupIconLabel(
                            groupDraft.icon,
                            groupIconLabels
                          )}
                        </span>
                        <ChevronDownIcon className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      className={cn(
                        "thin-scrollbar max-h-64 overflow-y-auto p-2 pr-3",
                        ADMIN_CONTROL_WIDTH_CLASS
                      )}
                    >
                      <div className="grid gap-0.5">
                        {GROUP_ICON_OPTIONS.map((option) => {
                          const selected = groupDraft.icon === option;
                          return (
                            <button
                              key={option}
                              type="button"
                              className={cn(
                                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                                selected
                                  ? "bg-primary/10 text-foreground"
                                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                              )}
                              onClick={() =>
                                setGroupDraft((current) => ({
                                  ...current,
                                  icon: option,
                                }))
                              }
                            >
                              <ModelBrandIcon
                                icon={option}
                                className="size-4"
                              />
                              <span className="truncate">
                                {formatGroupIconLabel(option, groupIconLabels)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex items-end sm:col-span-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={
                      savingGroup ||
                      !groupDraft.name.trim() ||
                      (!editingGroupId && !groupDraft.id.trim())
                    }
                    onClick={() => {
                      void handleSaveGroup();
                    }}
                  >
                    {editingGroupId
                      ? t("common.save")
                      : t("pages.adminAiModels.createGroup")}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {settingsModel && isTextModelParameterRules(settingsModel.parameterRules) ? (
        <TextModelSettingsDialog
          model={settingsModel}
          groups={orderedGroups}
          saving={savingId === settingsModel.canonicalId}
          onClose={() => setSettingsModel(null)}
          onSave={(patch) => handleSaveModel(settingsModel, patch)}
        />
      ) : null}
      {settingsModel && isImageModelParameterRules(settingsModel.parameterRules) ? (
        <ImageModelSettingsDialog
          model={settingsModel}
          groups={orderedGroups}
          saving={savingId === settingsModel.canonicalId}
          onClose={() => setSettingsModel(null)}
          onSave={(patch) => handleSaveModel(settingsModel, patch)}
        />
      ) : null}
      {settingsModel && isVideoModelParameterRules(settingsModel.parameterRules) ? (
        <VideoModelSettingsDialog
          model={settingsModel}
          groups={orderedGroups}
          saving={savingId === settingsModel.canonicalId}
          onClose={() => setSettingsModel(null)}
          onSave={(patch) => handleSaveModel(settingsModel, patch)}
        />
      ) : null}
    </InsetLayout>
  );
}

function TextModelSettingsDialog({
  model,
  groups,
  saving,
  onClose,
  onSave,
}: {
  readonly model: PlatformAiModel;
  readonly groups: readonly PlatformAiModelGroup[];
  readonly saving: boolean;
  readonly onClose: () => void;
  readonly onSave: (patch: {
    readonly displayName: string;
    readonly rules: TextModelParameterRules;
    readonly groupId: string | null;
    readonly description: string;
  }) => void;
}) {
  const { t } = useTranslation();
  const baseRules = isTextModelParameterRules(model.parameterRules)
    ? normalizeTextModelParameterRules(model.parameterRules)
    : DEFAULT_TEXT_MODEL_PARAMETER_RULES;

  const [displayName, setDisplayName] = useState(model.displayName);
  const [description, setDescription] = useState(model.description ?? "");
  const [groupId, setGroupId] = useState(model.groupId ?? ADMIN_NO_GROUP_VALUE);
  const [promptMaxChars, setPromptMaxChars] = useState(
    String(baseRules.promptMaxChars)
  );
  const [keywordsMaxChars, setKeywordsMaxChars] = useState(
    String(baseRules.keywordsMaxChars)
  );
  const [outputMaxTokens, setOutputMaxTokens] = useState(
    String(baseRules.outputMaxTokens)
  );
  const [outputMaxTokensLimit, setOutputMaxTokensLimit] = useState(
    String(baseRules.outputMaxTokensLimit)
  );
  const [outputMaxChars, setOutputMaxChars] = useState(
    String(baseRules.outputMaxChars)
  );
  const [contextWindowTokens, setContextWindowTokens] = useState(
    String(baseRules.contextWindowTokens)
  );
  const [maxTextReferences, setMaxTextReferences] = useState(
    String(baseRules.maxTextReferences)
  );
  const [maxTextReferenceChars, setMaxTextReferenceChars] = useState(
    String(baseRules.maxTextReferenceChars)
  );
  const [maxImageReferences, setMaxImageReferences] = useState(
    String(baseRules.maxImageReferences)
  );
  const [maxImageReferenceBytes, setMaxImageReferenceBytes] = useState(
    bytesToMbInput(baseRules.maxImageReferenceBytes)
  );
  const [maxVideoReferences, setMaxVideoReferences] = useState(
    String(baseRules.maxVideoReferences)
  );
  const [maxVideoReferenceBytes, setMaxVideoReferenceBytes] = useState(
    bytesToMbInput(baseRules.maxVideoReferenceBytes)
  );
  const [maxVideoReferenceSeconds, setMaxVideoReferenceSeconds] = useState(
    String(baseRules.maxVideoReferenceSeconds)
  );

  const handleSave = () => {
    const nextText = Number(maxTextReferences) || 0;
    const nextImage = Number(maxImageReferences) || 0;
    const nextVideo = Number(maxVideoReferences) || 0;
    const totalRefs = Math.max(1, nextText + nextImage + nextVideo);

    onSave({
      displayName: displayName.trim() || model.displayName,
      groupId: groupId === ADMIN_NO_GROUP_VALUE ? null : groupId,
      description: description.trim(),
      rules: {
        ...baseRules,
        promptMaxChars:
          Number(promptMaxChars) || baseRules.promptMaxChars,
        keywordsMaxChars:
          Number(keywordsMaxChars) || baseRules.keywordsMaxChars,
        outputMaxTokens:
          Number(outputMaxTokens) || baseRules.outputMaxTokens,
        outputMaxTokensLimit:
          Number(outputMaxTokensLimit) || baseRules.outputMaxTokensLimit,
        outputMaxChars: Math.min(
          Number(outputMaxChars) || baseRules.outputMaxChars,
          32_000
        ),
        contextWindowTokens:
          Number(contextWindowTokens) || baseRules.contextWindowTokens,
        maxTextReferences: nextText,
        maxTextReferenceChars:
          Number(maxTextReferenceChars) || baseRules.maxTextReferenceChars,
        maxImageReferences: nextImage,
        maxImageReferenceBytes: mbInputToBytes(
          maxImageReferenceBytes,
          baseRules.maxImageReferenceBytes
        ),
        maxVideoReferences: nextVideo,
        maxVideoReferenceBytes: mbInputToBytes(
          maxVideoReferenceBytes,
          baseRules.maxVideoReferenceBytes
        ),
        maxVideoReferenceSeconds:
          Number(maxVideoReferenceSeconds) ||
          baseRules.maxVideoReferenceSeconds,
        referenceInputs: [
          {
            type: "any",
            field: "keywords",
            maxCount: totalRefs,
          },
        ],
      },
    });
  };

  return (
    <ModelSettingsDialogShell
      title={t("pages.adminAiModels.settingsTitle", {
        name: model.displayName,
      })}
      description={t("pages.adminAiModels.settingsDescription")}
      saving={saving}
      onClose={onClose}
      onSave={handleSave}
    >
      <SettingsSection title={t("pages.adminAiModels.sectionBasic")}>
        <ModelBasicFields
          displayName={displayName}
          onDisplayNameChange={setDisplayName}
          description={description}
          onDescriptionChange={setDescription}
          groupId={groupId}
          onGroupIdChange={setGroupId}
          groups={groups}
        />
      </SettingsSection>

      <SettingsSection title={t("pages.adminAiModels.sectionPrompt")}>
        <NumberField
          label={t("pages.adminAiModels.promptMaxChars")}
          value={promptMaxChars}
          onChange={setPromptMaxChars}
        />
        <NumberField
          label={t("pages.adminAiModels.keywordsMaxChars")}
          value={keywordsMaxChars}
          onChange={setKeywordsMaxChars}
        />
      </SettingsSection>

      <CollapsibleSettingsSection title={t("pages.adminAiModels.sectionOutput")}>
        <NumberField
          label={t("pages.adminAiModels.outputMaxTokens")}
          value={outputMaxTokens}
          onChange={setOutputMaxTokens}
        />
        <NumberField
          label={t("pages.adminAiModels.outputMaxTokensLimit")}
          value={outputMaxTokensLimit}
          onChange={setOutputMaxTokensLimit}
        />
        <NumberField
          label={t("pages.adminAiModels.outputMaxChars")}
          value={outputMaxChars}
          onChange={(value) => {
            const next = Number(value);
            if (Number.isFinite(next) && next > 32_000) {
              setOutputMaxChars("32000");
              return;
            }
            setOutputMaxChars(value);
          }}
        />
        <p className="col-span-full text-xs text-muted-foreground">
          {t("pages.adminAiModels.outputMaxCharsHint")}
        </p>
        <NumberField
          label={t("pages.adminAiModels.contextWindowTokens")}
          value={contextWindowTokens}
          onChange={setContextWindowTokens}
        />
      </CollapsibleSettingsSection>

      <CollapsibleSettingsSection
        title={t("pages.adminAiModels.sectionReferences")}
      >
        <NumberField
          label={t("pages.adminAiModels.maxTextReferences")}
          value={maxTextReferences}
          onChange={setMaxTextReferences}
        />
        <NumberField
          label={t("pages.adminAiModels.maxTextReferenceChars")}
          value={maxTextReferenceChars}
          onChange={setMaxTextReferenceChars}
        />
        <NumberField
          label={t("pages.adminAiModels.maxImageReferences")}
          value={maxImageReferences}
          onChange={setMaxImageReferences}
        />
        <MbField
          label={t("pages.adminAiModels.maxImageReferenceBytes")}
          value={maxImageReferenceBytes}
          onChange={setMaxImageReferenceBytes}
        />
        <NumberField
          label={t("pages.adminAiModels.maxVideoReferences")}
          value={maxVideoReferences}
          onChange={setMaxVideoReferences}
        />
        <MbField
          label={t("pages.adminAiModels.maxVideoReferenceBytes")}
          value={maxVideoReferenceBytes}
          onChange={setMaxVideoReferenceBytes}
        />
        <NumberField
          label={t("pages.adminAiModels.maxVideoReferenceSeconds")}
          value={maxVideoReferenceSeconds}
          onChange={setMaxVideoReferenceSeconds}
        />
      </CollapsibleSettingsSection>
    </ModelSettingsDialogShell>
  );
}

function ImageModelSettingsDialog({
  model,
  groups,
  saving,
  onClose,
  onSave,
}: {
  readonly model: PlatformAiModel;
  readonly groups: readonly PlatformAiModelGroup[];
  readonly saving: boolean;
  readonly onClose: () => void;
  readonly onSave: (patch: {
    readonly displayName: string;
    readonly rules: ImageModelParameterRules;
    readonly groupId: string | null;
    readonly description: string;
  }) => void;
}) {
  const { t } = useTranslation();
  const optionLabels = useGenerationOptionLabels();
  const baseRules = isImageModelParameterRules(model.parameterRules)
    ? normalizeImageModelParameterRules(model.parameterRules)
    : DEFAULT_IMAGE_MODEL_PARAMETER_RULES;

  const [displayName, setDisplayName] = useState(model.displayName);
  const [groupId, setGroupId] = useState(model.groupId ?? ADMIN_NO_GROUP_VALUE);
  const [maxReferenceImages, setMaxReferenceImages] = useState(
    String(baseRules.maxReferenceImages)
  );
  const [maxImageReferenceBytes, setMaxImageReferenceBytes] = useState(
    bytesToMbInput(baseRules.maxImageReferenceBytes)
  );
  const [promptMaxChars, setPromptMaxChars] = useState(
    String(baseRules.promptMaxChars)
  );
  const [sizePolicy, setSizePolicy] = useState<GenerationSizePolicy>(
    baseRules.sizePolicy ?? { enabled: false, effectMode: "legacy" }
  );
  const [countPolicy, setCountPolicy] = useState<GenerationCountPolicy>(
    baseRules.countPolicy ?? {
      enabled: false,
      effectMode: "sequential_image_generation",
    }
  );
  const [generationFields, setGenerationFields] = useState<
    UpstreamParamProfileField[]
  >(baseRules.generationFields.map((field) => ({ ...field })));

  const sizeFieldApiName =
    generationFields.find((field) => field.name === "size")?.apiName ?? "size";
  const sizeApiNameHeader = useAdminParamApiNameAddon(
    sizeFieldApiName,
    (next) => {
      setGenerationFields((fields) =>
        fields.map((field) =>
          field.name === "size" ? { ...field, apiName: next } : field
        )
      );
    }
  );

  const countFieldApiName =
    generationFields.find((field) => field.name === "generate_count")
      ?.apiName ?? "max_images";
  const countApiNameHeader = useAdminParamApiNameAddon(
    countFieldApiName,
    (next) => {
      setGenerationFields((fields) =>
        fields.map((field) =>
          field.name === "generate_count"
            ? { ...field, apiName: next }
            : field
        )
      );
    }
  );

  const handleSave = () => {
    onSave({
      displayName: displayName.trim() || model.displayName,
      groupId: groupId === ADMIN_NO_GROUP_VALUE ? null : groupId,
      description: model.description ?? "",
      rules: {
        ...baseRules,
        sizePolicy,
        countPolicy,
        maxReferenceImages:
          Number(maxReferenceImages) ||
          DEFAULT_IMAGE_MODEL_PARAMETER_RULES.maxReferenceImages,
        maxImageReferenceBytes: mbInputToBytes(
          maxImageReferenceBytes,
          DEFAULT_IMAGE_MODEL_PARAMETER_RULES.maxImageReferenceBytes
        ),
        promptMaxChars:
          Number(promptMaxChars) ||
          DEFAULT_IMAGE_MODEL_PARAMETER_RULES.promptMaxChars,
        generationFields,
      },
    });
  };

  return (
    <ModelSettingsDialogShell
      dialogWidth="800"
      title={t("pages.adminAiModels.settingsTitle", { name: model.displayName })}
      description={t("pages.adminAiModels.imageSettingsDescription")}
      saving={saving}
      onClose={onClose}
      onSave={handleSave}
    >
      <SettingsSection
        compact
        columns={3}
        title={t("pages.adminAiModels.sectionBasic")}
      >
        <ImageModelBasicFields
          canonicalId={model.canonicalId}
          displayName={displayName}
          onDisplayNameChange={setDisplayName}
          groupId={groupId}
          onGroupIdChange={setGroupId}
          groups={groups}
        />
      </SettingsSection>

      <SettingsSection
        compact
        columns={3}
        title={t("pages.adminAiModels.sectionApplication")}
      >
        <NumberField
          paramLabel
          label={t("pages.adminAiModels.promptMaxChars")}
          value={promptMaxChars}
          onChange={setPromptMaxChars}
        />
        <NumberField
          paramLabel
          label={t("pages.adminAiModels.maxImageReferences")}
          value={maxReferenceImages}
          onChange={setMaxReferenceImages}
        />
        <MbField
          paramLabel
          label={t("pages.adminAiModels.maxImageReferenceBytes")}
          value={maxImageReferenceBytes}
          onChange={setMaxImageReferenceBytes}
        />
      </SettingsSection>

      <SettingsSection
        compact
        stacked
        title={t("pages.adminAiModels.sizePolicyLabel")}
        titleAddon={sizeApiNameHeader.titleAddon}
        action={
          <Switch
            checked={sizePolicy.enabled}
            onCheckedChange={(enabled) =>
              setSizePolicy({ ...sizePolicy, enabled })
            }
          />
        }
      >
        <SizePolicyEditor
          policy={sizePolicy}
          fields={generationFields}
          optionLabels={optionLabels}
          onChange={setSizePolicy}
          onFieldsChange={setGenerationFields}
        />
      </SettingsSection>

      <SettingsSection
        compact
        stacked
        title={t("pages.adminAiModels.imageCountLabel")}
        titleAddon={countApiNameHeader.titleAddon}
        action={
          <Switch
            checked={countPolicy.enabled}
            onCheckedChange={(enabled) =>
              setCountPolicy({ ...countPolicy, enabled })
            }
          />
        }
      >
        <ImageCountEditor
          policy={countPolicy}
          fields={generationFields}
          onPolicyChange={setCountPolicy}
          onFieldsChange={setGenerationFields}
        />
      </SettingsSection>

      <GenerationFeaturesEditor
        fields={generationFields}
        modality="image"
        layout="flat"
        optionLabels={optionLabels}
        onChange={setGenerationFields}
      />
    </ModelSettingsDialogShell>
  );
}

function VideoModelSettingsDialog({
  model,
  groups,
  saving,
  onClose,
  onSave,
}: {
  readonly model: PlatformAiModel;
  readonly groups: readonly PlatformAiModelGroup[];
  readonly saving: boolean;
  readonly onClose: () => void;
  readonly onSave: (patch: {
    readonly displayName: string;
    readonly rules: VideoModelParameterRules;
    readonly groupId: string | null;
    readonly description: string;
  }) => void;
}) {
  const { t } = useTranslation();
  const optionLabels = useGenerationOptionLabels();
  const baseRules = isVideoModelParameterRules(model.parameterRules)
    ? normalizeVideoModelParameterRules(model.parameterRules)
    : DEFAULT_VIDEO_MODEL_PARAMETER_RULES;

  const [displayName, setDisplayName] = useState(model.displayName);
  const [description, setDescription] = useState(model.description ?? "");
  const [groupId, setGroupId] = useState(model.groupId ?? ADMIN_NO_GROUP_VALUE);
  const [maxReferenceImages, setMaxReferenceImages] = useState(
    String(baseRules.maxReferenceImages)
  );
  const [maxImageReferenceBytes, setMaxImageReferenceBytes] = useState(
    bytesToMbInput(baseRules.maxImageReferenceBytes)
  );
  const [maxReferenceVideos, setMaxReferenceVideos] = useState(
    String(baseRules.maxReferenceVideos)
  );
  const [maxVideoReferenceBytes, setMaxVideoReferenceBytes] = useState(
    bytesToMbInput(baseRules.maxVideoReferenceBytes)
  );
  const [maxVideoReferenceSeconds, setMaxVideoReferenceSeconds] = useState(
    String(baseRules.maxVideoReferenceSeconds)
  );
  const [promptMaxChars, setPromptMaxChars] = useState(
    String(baseRules.promptMaxChars)
  );
  const [generationFields, setGenerationFields] = useState<
    UpstreamParamProfileField[]
  >(baseRules.generationFields.map((field) => ({ ...field })));

  const handleSave = () => {
    onSave({
      displayName: displayName.trim() || model.displayName,
      groupId: groupId === ADMIN_NO_GROUP_VALUE ? null : groupId,
      description: description.trim(),
      rules: {
        ...baseRules,
        maxReferenceImages:
          Number(maxReferenceImages) ||
          DEFAULT_VIDEO_MODEL_PARAMETER_RULES.maxReferenceImages,
        maxImageReferenceBytes: mbInputToBytes(
          maxImageReferenceBytes,
          DEFAULT_VIDEO_MODEL_PARAMETER_RULES.maxImageReferenceBytes
        ),
        maxReferenceVideos:
          Number(maxReferenceVideos) ||
          DEFAULT_VIDEO_MODEL_PARAMETER_RULES.maxReferenceVideos,
        maxVideoReferenceBytes: mbInputToBytes(
          maxVideoReferenceBytes,
          DEFAULT_VIDEO_MODEL_PARAMETER_RULES.maxVideoReferenceBytes
        ),
        maxVideoReferenceSeconds:
          Number(maxVideoReferenceSeconds) ||
          DEFAULT_VIDEO_MODEL_PARAMETER_RULES.maxVideoReferenceSeconds,
        promptMaxChars:
          Number(promptMaxChars) ||
          DEFAULT_VIDEO_MODEL_PARAMETER_RULES.promptMaxChars,
        generationFields,
      },
    });
  };

  return (
    <ModelSettingsDialogShell
      title={t("pages.adminAiModels.settingsTitle", { name: model.displayName })}
      description={t("pages.adminAiModels.videoSettingsDescription")}
      saving={saving}
      onClose={onClose}
      onSave={handleSave}
    >
      <SettingsSection title={t("pages.adminAiModels.sectionBasic")}>
        <ModelBasicFields
          displayName={displayName}
          onDisplayNameChange={setDisplayName}
          description={description}
          onDescriptionChange={setDescription}
          groupId={groupId}
          onGroupIdChange={setGroupId}
          groups={groups}
          promptMaxChars={promptMaxChars}
          onPromptMaxCharsChange={setPromptMaxChars}
        />
      </SettingsSection>

      <SettingsSection title={t("pages.adminAiModels.sectionReferences")}>
        <NumberField
          label={t("pages.adminAiModels.maxImageReferences")}
          value={maxReferenceImages}
          onChange={setMaxReferenceImages}
        />
        <MbField
          label={t("pages.adminAiModels.maxImageReferenceBytes")}
          value={maxImageReferenceBytes}
          onChange={setMaxImageReferenceBytes}
        />
        <NumberField
          label={t("pages.adminAiModels.maxVideoReferences")}
          value={maxReferenceVideos}
          onChange={setMaxReferenceVideos}
        />
        <MbField
          label={t("pages.adminAiModels.maxVideoReferenceBytes")}
          value={maxVideoReferenceBytes}
          onChange={setMaxVideoReferenceBytes}
        />
        <NumberField
          label={t("pages.adminAiModels.maxVideoReferenceSeconds")}
          value={maxVideoReferenceSeconds}
          onChange={setMaxVideoReferenceSeconds}
        />
      </SettingsSection>

      <SettingsSection title={t("pages.adminAiModels.sectionFeatures")}>
        <div className="col-span-full rounded-lg border border-border/60 bg-background p-3">
          <GenerationFeaturesEditor
            fields={generationFields}
            modality="video"
            optionLabels={optionLabels}
            onChange={setGenerationFields}
          />
        </div>
      </SettingsSection>
    </ModelSettingsDialogShell>
  );
}

function formatGroupIconLabel(
  icon: string,
  labels: { readonly defaultLabel: string; readonly doubaoLabel: string }
): string {
  if (icon === "sparkles") {
    return labels.defaultLabel;
  }
  if (icon === "doubao") {
    return labels.doubaoLabel;
  }
  return icon;
}
