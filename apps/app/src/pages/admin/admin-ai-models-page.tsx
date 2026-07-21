import type {
  ImageModelParameterRules,
  PlatformAiModel,
  PlatformAiModelGroup,
  TextModelParameterRules,
  VideoModelParameterRules,
} from "@dafthunk/types";
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
import ChevronDownIcon from "lucide-react/icons/chevron-down";
import ChevronUpIcon from "lucide-react/icons/chevron-up";
import SettingsIcon from "lucide-react/icons/settings";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { InsetLayout } from "@/components/layouts/inset-layout";
import { useTranslation } from "@/components/locale-provider";
import { useBreadcrumbsSetter } from "@/components/page-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Textarea } from "@/components/ui/textarea";
import {
  createAdminPlatformAiModelGroup,
  deleteAdminPlatformAiModelGroup,
  reorderAdminPlatformAiModels,
  updateAdminPlatformAiModel,
  useAdminPlatformAiModels,
} from "@/services/admin-ai-model-service";
import { cn } from "@/utils/utils";

const NO_GROUP_VALUE = "__none__";

type AdminModelModality = "text" | "image" | "video";

export function AdminAiModelsPage() {
  const { t } = useTranslation();
  const setBreadcrumbs = useBreadcrumbsSetter();
  const [modality, setModality] = useState<AdminModelModality>("text");
  const { models, groups, isLoading, refreshModels } =
    useAdminPlatformAiModels(modality);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [settingsModel, setSettingsModel] = useState<PlatformAiModel | null>(
    null
  );
  const [groupDraft, setGroupDraft] = useState<{
    id: string;
    name: string;
    description: string;
    icon: string;
  }>({ id: "", name: "", description: "", icon: "sparkles" });
  const [savingGroup, setSavingGroup] = useState(false);

  const orderedModels = useMemo(
    () =>
      [...models].sort(
        (a, b) =>
          a.sortOrder - b.sortOrder ||
          a.displayName.localeCompare(b.displayName)
      ),
    [models]
  );

  const orderedGroups = useMemo(
    () =>
      [...groups].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)
      ),
    [groups]
  );

  const groupNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const group of orderedGroups) {
      map.set(group.id, group.name);
    }
    return map;
  }, [orderedGroups]);

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

  const handleMove = async (canonicalId: string, direction: -1 | 1) => {
    const index = orderedModels.findIndex(
      (model) => model.canonicalId === canonicalId
    );
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= orderedModels.length) {
      return;
    }

    const nextOrder = [...orderedModels];
    const [removed] = nextOrder.splice(index, 1);
    if (!removed) return;
    nextOrder.splice(nextIndex, 0, removed);

    setReordering(true);
    try {
      await reorderAdminPlatformAiModels(
        nextOrder.map((model) => model.canonicalId)
      );
      await refreshModels();
      toast.success(t("pages.adminAiModels.reorderSaved"));
    } catch {
      toast.error(t("pages.adminAiModels.reorderFailed"));
    } finally {
      setReordering(false);
    }
  };

  const handleSaveModel = async (
    model: PlatformAiModel,
    patch: {
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

  const handleCreateGroup = async () => {
    if (!groupDraft.id.trim() || !groupDraft.name.trim()) return;
    setSavingGroup(true);
    try {
      await createAdminPlatformAiModelGroup({
        id: groupDraft.id.trim(),
        name: groupDraft.name.trim(),
        description: groupDraft.description.trim(),
        icon: groupDraft.icon.trim() || "sparkles",
        sortOrder: (orderedGroups.length + 1) * 10,
      });
      await refreshModels();
      setGroupDraft({ id: "", name: "", description: "", icon: "sparkles" });
      toast.success(t("pages.adminAiModels.groupSaved"));
    } catch {
      toast.error(t("pages.adminAiModels.groupSaveFailed"));
    } finally {
      setSavingGroup(false);
    }
  };

  const handleDeleteGroup = async (group: PlatformAiModelGroup) => {
    setSavingGroup(true);
    try {
      await deleteAdminPlatformAiModelGroup(group.id);
      await refreshModels();
      toast.success(t("pages.adminAiModels.groupDeleted"));
    } catch {
      toast.error(t("pages.adminAiModels.groupDeleteFailed"));
    } finally {
      setSavingGroup(false);
    }
  };

  return (
    <InsetLayout title={t("pages.adminAiModels.title")}>
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>{t("pages.adminAiModels.groupsTitle")}</CardTitle>
            <CardDescription>
              {t("pages.adminAiModels.groupsDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {orderedGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("pages.adminAiModels.groupsEmpty")}
              </p>
            ) : (
              orderedGroups.map((group) => (
                <div
                  key={group.id}
                  className="flex items-start gap-3 rounded-md border px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{group.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {group.id} · {group.icon}
                    </p>
                    {group.description ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {group.description}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={savingGroup}
                    onClick={() => {
                      void handleDeleteGroup(group);
                    }}
                  >
                    {t("common.delete")}
                  </Button>
                </div>
              ))
            )}

            <div className="grid gap-2 rounded-md border border-dashed p-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">
                  {t("pages.adminAiModels.groupId")}
                </Label>
                <Input
                  className="h-8 text-xs"
                  value={groupDraft.id}
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
              <div className="space-y-1">
                <Label className="text-xs">
                  {t("pages.adminAiModels.groupIcon")}
                </Label>
                <Input
                  className="h-8 text-xs"
                  value={groupDraft.icon}
                  onChange={(event) =>
                    setGroupDraft((current) => ({
                      ...current,
                      icon: event.target.value,
                    }))
                  }
                  placeholder="sparkles"
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  size="sm"
                  disabled={
                    savingGroup ||
                    !groupDraft.id.trim() ||
                    !groupDraft.name.trim()
                  }
                  onClick={() => {
                    void handleCreateGroup();
                  }}
                >
                  {t("pages.adminAiModels.createGroup")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={modality === "text" ? "default" : "outline"}
            onClick={() => setModality("text")}
          >
            {t("pages.adminAiModels.textModels")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={modality === "image" ? "default" : "outline"}
            onClick={() => setModality("image")}
          >
            {t("pages.adminAiModels.imageModels")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={modality === "video" ? "default" : "outline"}
            onClick={() => setModality("video")}
          >
            {t("pages.adminAiModels.videoModels")}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {modality === "text"
                ? t("pages.adminAiModels.textModels")
                : modality === "image"
                  ? t("pages.adminAiModels.imageModels")
                  : t("pages.adminAiModels.videoModels")}
            </CardTitle>
            <CardDescription>
              {t("pages.adminAiModels.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">
                {t("common.loading")}
              </p>
            ) : orderedModels.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("pages.adminAiModels.empty")}
              </p>
            ) : (
              orderedModels.map((model, index) => (
                <div
                  key={model.canonicalId}
                  className="flex items-center gap-3 rounded-md border px-3 py-2.5"
                >
                  <div className="flex flex-col gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={reordering || index === 0}
                      onClick={() => handleMove(model.canonicalId, -1)}
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
                        reordering || index === orderedModels.length - 1
                      }
                      onClick={() => handleMove(model.canonicalId, 1)}
                      title={t("pages.adminAiModels.moveDown")}
                    >
                      <ChevronDownIcon className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{model.displayName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {model.providerModelId}
                      {model.groupId
                        ? ` · ${groupNameById.get(model.groupId) ?? model.groupId}`
                        : ""}
                    </p>
                  </div>

                  <Badge variant="secondary">{model.modality}</Badge>

                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor={`enable-${model.canonicalId}`}
                      className="text-xs text-muted-foreground"
                    >
                      {t("pages.adminAiModels.platformEnabled")}
                    </Label>
                    <Switch
                      id={`enable-${model.canonicalId}`}
                      checked={model.platformEnabled}
                      disabled={savingId === model.canonicalId || reordering}
                      onCheckedChange={(enabled) => handleToggle(model, enabled)}
                    />
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={reordering}
                    onClick={() => setSettingsModel(model)}
                  >
                    <SettingsIcon className="h-3.5 w-3.5" />
                    {t("pages.adminAiModels.settings")}
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

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
    readonly rules: TextModelParameterRules;
    readonly groupId: string | null;
    readonly description: string;
  }) => void;
}) {
  const { t } = useTranslation();
  const baseRules = isTextModelParameterRules(model.parameterRules)
    ? normalizeTextModelParameterRules(model.parameterRules)
    : DEFAULT_TEXT_MODEL_PARAMETER_RULES;

  const [description, setDescription] = useState(model.description ?? "");
  const [groupId, setGroupId] = useState(model.groupId ?? NO_GROUP_VALUE);
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
    String(baseRules.maxImageReferenceBytes)
  );
  const [maxVideoReferences, setMaxVideoReferences] = useState(
    String(baseRules.maxVideoReferences)
  );
  const [maxVideoReferenceBytes, setMaxVideoReferenceBytes] = useState(
    String(baseRules.maxVideoReferenceBytes)
  );
  const [maxVideoReferenceSeconds, setMaxVideoReferenceSeconds] = useState(
    String(baseRules.maxVideoReferenceSeconds)
  );
  const [allowPromptInjectText, setAllowPromptInjectText] = useState(
    baseRules.allowPromptInjectText
  );
  const [allowPromptInjectImage, setAllowPromptInjectImage] = useState(
    baseRules.allowPromptInjectImage
  );
  const [allowPromptInjectVideo, setAllowPromptInjectVideo] = useState(
    baseRules.allowPromptInjectVideo
  );

  const handleSave = () => {
    const nextText = Number(maxTextReferences) || 0;
    const nextImage = Number(maxImageReferences) || 0;
    const nextVideo = Number(maxVideoReferences) || 0;
    const totalRefs = Math.max(1, nextText + nextImage + nextVideo);

    onSave({
      groupId: groupId === NO_GROUP_VALUE ? null : groupId,
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
        maxImageReferenceBytes:
          Number(maxImageReferenceBytes) || baseRules.maxImageReferenceBytes,
        maxVideoReferences: nextVideo,
        maxVideoReferenceBytes:
          Number(maxVideoReferenceBytes) || baseRules.maxVideoReferenceBytes,
        maxVideoReferenceSeconds:
          Number(maxVideoReferenceSeconds) ||
          baseRules.maxVideoReferenceSeconds,
        allowPromptInjectText,
        allowPromptInjectImage,
        allowPromptInjectVideo,
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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {t("pages.adminAiModels.settingsTitle", {
              name: model.displayName,
            })}
          </DialogTitle>
          <DialogDescription>
            {t("pages.adminAiModels.settingsDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <SettingsSection title={t("pages.adminAiModels.sectionGrouping")}>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">
                {t("pages.adminAiModels.modelDescription")}
              </Label>
              <Textarea
                className="min-h-16 text-xs"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">
                {t("pages.adminAiModels.modelGroup")}
              </Label>
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_GROUP_VALUE}>
                    {t("pages.adminAiModels.noGroup")}
                  </SelectItem>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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

          <SettingsSection title={t("pages.adminAiModels.sectionOutput")}>
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
            <p className="col-span-full text-[11px] text-muted-foreground">
              {t("pages.adminAiModels.outputMaxCharsHint")}
            </p>
            <NumberField
              label={t("pages.adminAiModels.contextWindowTokens")}
              value={contextWindowTokens}
              onChange={setContextWindowTokens}
            />
          </SettingsSection>

          <SettingsSection title={t("pages.adminAiModels.sectionReferences")}>
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
            <NumberField
              label={t("pages.adminAiModels.maxImageReferenceBytes")}
              value={maxImageReferenceBytes}
              onChange={setMaxImageReferenceBytes}
            />
            <NumberField
              label={t("pages.adminAiModels.maxVideoReferences")}
              value={maxVideoReferences}
              onChange={setMaxVideoReferences}
            />
            <NumberField
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

          <SettingsSection title={t("pages.adminAiModels.sectionInject")}>
            <ToggleField
              id="inject-text"
              label={t("pages.adminAiModels.allowPromptInjectText")}
              checked={allowPromptInjectText}
              onCheckedChange={setAllowPromptInjectText}
            />
            <ToggleField
              id="inject-image"
              label={t("pages.adminAiModels.allowPromptInjectImage")}
              checked={allowPromptInjectImage}
              onCheckedChange={setAllowPromptInjectImage}
            />
            <ToggleField
              id="inject-video"
              label={t("pages.adminAiModels.allowPromptInjectVideo")}
              checked={allowPromptInjectVideo}
              onCheckedChange={setAllowPromptInjectVideo}
            />
          </SettingsSection>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="button" disabled={saving} onClick={handleSave}>
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SettingsSection({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  className,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <Label className="text-xs">{label}</Label>
      <Input
        className="h-8 text-xs"
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
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
    readonly rules: ImageModelParameterRules;
    readonly groupId: string | null;
    readonly description: string;
  }) => void;
}) {
  const { t } = useTranslation();
  const baseRules = isImageModelParameterRules(model.parameterRules)
    ? normalizeImageModelParameterRules(model.parameterRules)
    : DEFAULT_IMAGE_MODEL_PARAMETER_RULES;

  const [description, setDescription] = useState(model.description ?? "");
  const [groupId, setGroupId] = useState(model.groupId ?? NO_GROUP_VALUE);
  const [maxImageReferenceBytes, setMaxImageReferenceBytes] = useState(
    String(baseRules.maxImageReferenceBytes)
  );
  const [promptMaxChars, setPromptMaxChars] = useState(
    String(baseRules.promptMaxChars)
  );
  const [generationFields, setGenerationFields] = useState(
    baseRules.generationFields.map((field) => ({ ...field }))
  );

  const handleSave = () => {
    onSave({
      groupId: groupId === NO_GROUP_VALUE ? null : groupId,
      description: description.trim(),
      rules: {
        ...baseRules,
        maxReferenceImages: baseRules.maxReferenceImages,
        maxImageReferenceBytes:
          Number(maxImageReferenceBytes) ||
          DEFAULT_IMAGE_MODEL_PARAMETER_RULES.maxImageReferenceBytes,
        promptMaxChars:
          Number(promptMaxChars) ||
          DEFAULT_IMAGE_MODEL_PARAMETER_RULES.promptMaxChars,
        generationFields,
      },
    });
  };

  const updateFieldDefault = (
    name: string,
    value: string | number | boolean
  ) => {
    setGenerationFields((current) =>
      current.map((field) =>
        field.name === name ? { ...field, default: value } : field
      )
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("pages.adminAiModels.settingsTitle", { name: model.displayName })}</DialogTitle>
          <DialogDescription>
            {t("pages.adminAiModels.imageSettingsDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">{t("pages.adminAiModels.modelDescription")}</Label>
            <Input
              className="h-8 text-xs"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">{t("pages.adminAiModels.modelGroup")}</Label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_GROUP_VALUE}>
                  {t("pages.adminAiModels.noGroup")}
                </SelectItem>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <NumberField
            label={t("pages.adminAiModels.maxImageReferenceBytes")}
            value={maxImageReferenceBytes}
            onChange={setMaxImageReferenceBytes}
          />
          <NumberField
            className="sm:col-span-2"
            label={t("pages.adminAiModels.promptMaxChars")}
            value={promptMaxChars}
            onChange={setPromptMaxChars}
          />

          {generationFields
            .filter((field) => !field.hidden)
            .map((field) => (
              <div key={field.name} className="space-y-1 sm:col-span-2">
                <Label className="text-xs">{field.description || field.name}</Label>
                {field.type === "boolean" ? (
                  <Switch
                    checked={field.default === true}
                    onCheckedChange={(checked) =>
                      updateFieldDefault(field.name, checked)
                    }
                  />
                ) : field.enumValues && field.enumValues.length > 0 ? (
                  <Select
                    value={
                      field.default === undefined ? "" : String(field.default)
                    }
                    onValueChange={(value) =>
                      updateFieldDefault(field.name, value)
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {field.enumValues.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    className="h-8 text-xs"
                    value={
                      field.default === undefined ? "" : String(field.default)
                    }
                    onChange={(e) => updateFieldDefault(field.name, e.target.value)}
                  />
                )}
              </div>
            ))}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="button" disabled={saving} onClick={handleSave}>
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
    readonly rules: VideoModelParameterRules;
    readonly groupId: string | null;
    readonly description: string;
  }) => void;
}) {
  const { t } = useTranslation();
  const baseRules = isVideoModelParameterRules(model.parameterRules)
    ? normalizeVideoModelParameterRules(model.parameterRules)
    : DEFAULT_VIDEO_MODEL_PARAMETER_RULES;

  const [description, setDescription] = useState(model.description ?? "");
  const [groupId, setGroupId] = useState(model.groupId ?? NO_GROUP_VALUE);
  const [maxReferenceImages, setMaxReferenceImages] = useState(
    String(baseRules.maxReferenceImages)
  );
  const [maxImageReferenceBytes, setMaxImageReferenceBytes] = useState(
    String(baseRules.maxImageReferenceBytes)
  );
  const [maxReferenceVideos, setMaxReferenceVideos] = useState(
    String(baseRules.maxReferenceVideos)
  );
  const [maxVideoReferenceBytes, setMaxVideoReferenceBytes] = useState(
    String(baseRules.maxVideoReferenceBytes)
  );
  const [maxVideoReferenceSeconds, setMaxVideoReferenceSeconds] = useState(
    String(baseRules.maxVideoReferenceSeconds)
  );
  const [promptMaxChars, setPromptMaxChars] = useState(
    String(baseRules.promptMaxChars)
  );
  const [generationFields, setGenerationFields] = useState(
    baseRules.generationFields.map((field) => ({ ...field }))
  );

  const handleSave = () => {
    onSave({
      groupId: groupId === NO_GROUP_VALUE ? null : groupId,
      description: description.trim(),
      rules: {
        ...baseRules,
        maxReferenceImages:
          Number(maxReferenceImages) ||
          DEFAULT_VIDEO_MODEL_PARAMETER_RULES.maxReferenceImages,
        maxImageReferenceBytes:
          Number(maxImageReferenceBytes) ||
          DEFAULT_VIDEO_MODEL_PARAMETER_RULES.maxImageReferenceBytes,
        maxReferenceVideos:
          Number(maxReferenceVideos) ||
          DEFAULT_VIDEO_MODEL_PARAMETER_RULES.maxReferenceVideos,
        maxVideoReferenceBytes:
          Number(maxVideoReferenceBytes) ||
          DEFAULT_VIDEO_MODEL_PARAMETER_RULES.maxVideoReferenceBytes,
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

  const updateFieldDefault = (
    name: string,
    value: string | number | boolean
  ) => {
    setGenerationFields((current) =>
      current.map((field) =>
        field.name === name ? { ...field, default: value } : field
      )
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("pages.adminAiModels.settingsTitle", { name: model.displayName })}</DialogTitle>
          <DialogDescription>
            {t("pages.adminAiModels.videoSettingsDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">{t("pages.adminAiModels.modelDescription")}</Label>
            <Input
              className="h-8 text-xs"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">{t("pages.adminAiModels.modelGroup")}</Label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_GROUP_VALUE}>
                  {t("pages.adminAiModels.noGroup")}
                </SelectItem>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <NumberField
            label={t("pages.adminAiModels.maxImageReferences")}
            value={maxReferenceImages}
            onChange={setMaxReferenceImages}
          />
          <NumberField
            label={t("pages.adminAiModels.maxImageReferenceBytes")}
            value={maxImageReferenceBytes}
            onChange={setMaxImageReferenceBytes}
          />
          <NumberField
            label={t("pages.adminAiModels.maxVideoReferences")}
            value={maxReferenceVideos}
            onChange={setMaxReferenceVideos}
          />
          <NumberField
            label={t("pages.adminAiModels.maxVideoReferenceBytes")}
            value={maxVideoReferenceBytes}
            onChange={setMaxVideoReferenceBytes}
          />
          <NumberField
            label={t("pages.adminAiModels.maxVideoReferenceSeconds")}
            value={maxVideoReferenceSeconds}
            onChange={setMaxVideoReferenceSeconds}
          />
          <NumberField
            className="sm:col-span-2"
            label={t("pages.adminAiModels.promptMaxChars")}
            value={promptMaxChars}
            onChange={setPromptMaxChars}
          />

          {generationFields
            .filter((field) => !field.hidden)
            .map((field) => (
              <div key={field.name} className="space-y-1 sm:col-span-2">
                <Label className="text-xs">{field.description || field.name}</Label>
                {field.type === "boolean" ? (
                  <Switch
                    checked={field.default === true}
                    onCheckedChange={(checked) =>
                      updateFieldDefault(field.name, checked)
                    }
                  />
                ) : field.enumValues && field.enumValues.length > 0 ? (
                  <Select
                    value={
                      field.default === undefined ? "" : String(field.default)
                    }
                    onValueChange={(value) =>
                      updateFieldDefault(field.name, value)
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {field.enumValues.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    className="h-8 text-xs"
                    value={
                      field.default === undefined ? "" : String(field.default)
                    }
                    onChange={(e) => updateFieldDefault(field.name, e.target.value)}
                  />
                )}
              </div>
            ))}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="button" disabled={saving} onClick={handleSave}>
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ToggleField({
  id,
  label,
  checked,
  onCheckedChange,
}: {
  readonly id: string;
  readonly label: string;
  readonly checked: boolean;
  readonly onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 sm:col-span-2">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
