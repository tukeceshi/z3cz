import type { PlatformAiModel, PlatformAiModelGroup } from "@dafthunk/types";
import PencilIcon from "lucide-react/icons/pencil";
import { useMemo, useState, type ReactNode } from "react";

import { useTranslation } from "@/components/locale-provider";
import { PAGE_SCROLL_CLASS } from "@/components/list-scroll";
import { Button } from "@/components/ui/button";
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
import {
  SURFACE_BORDER,
  SURFACE_MUTED_INSET,
  SURFACE_ROW_HOVER,
} from "@/components/ui/surface";
import { cn } from "@/utils/utils";

export const ADMIN_NO_GROUP_VALUE = "__none__";

/** Param field labels inside a settings section (not section titles). */
export const ADMIN_PARAM_LABEL_CLASS = "text-[11px] text-muted-foreground";

/** Hint text below parameter blocks. */
export const ADMIN_PARAM_HINT_CLASS = "text-[10px] text-muted-foreground";

/** API parameter name shown beside section titles. */
export const ADMIN_PARAM_API_NAME_CLASS = "text-[11px] text-muted-foreground";

/** Fixed width for popovers aligned to compact controls (224px). */
export const ADMIN_CONTROL_WIDTH_CLASS = "w-56";

/** Standard height + full-width for settings inputs, selects, and triggers. */
export const ADMIN_CONTROL_CLASS = "h-9 w-full";

/** Read-only settings control (e.g. model ID). */
export const ADMIN_READONLY_CONTROL_CLASS = cn(
  ADMIN_CONTROL_CLASS,
  "cursor-default border-dashed bg-muted/40 text-muted-foreground focus-visible:ring-0"
);

/** Three-column settings grid (matches application / count policy sections). */
export const ADMIN_SETTINGS_GRID_CLASS = "grid grid-cols-1 gap-3 sm:grid-cols-3";

const ADMIN_SETTINGS_GRID_2_CLASS = "grid gap-3 sm:grid-cols-2";

const ADMIN_MODEL_SETTINGS_DIALOG_BASE_CLASS =
  "flex max-h-[90vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg";

/** Shared width for text / video model settings dialogs. */
export const ADMIN_MODEL_SETTINGS_DIALOG_CLASS =
  ADMIN_MODEL_SETTINGS_DIALOG_BASE_CLASS;

const ADMIN_MODEL_SETTINGS_DIALOG_800_CLASS =
  "flex max-h-[90vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[800px]";

export function AdminModelList({
  models,
  groups,
  emptyLabel,
  isLoading,
  savingId,
  onToggle,
  onOpenSettings,
}: {
  readonly models: readonly PlatformAiModel[];
  readonly groups: readonly PlatformAiModelGroup[];
  readonly emptyLabel: string;
  readonly isLoading: boolean;
  readonly savingId: string | null;
  readonly onToggle: (model: PlatformAiModel, enabled: boolean) => void;
  readonly onOpenSettings: (model: PlatformAiModel) => void;
}) {
  const { t } = useTranslation();

  const groupNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const group of groups) {
      map.set(group.id, group.name);
    }
    return map;
  }, [groups]);

  const ungroupedLabel = t("pages.adminAiModels.ungroupedModels");

  if (isLoading) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {t("common.loading")}
      </p>
    );
  }

  if (models.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {models.map((model) => (
        <AdminModelListRow
          key={model.canonicalId}
          model={model}
          groupLabel={
            model.groupId
              ? (groupNameById.get(model.groupId) ?? ungroupedLabel)
              : ungroupedLabel
          }
          saving={savingId === model.canonicalId}
          onToggle={onToggle}
          onOpenSettings={onOpenSettings}
        />
      ))}
    </div>
  );
}

function AdminModelListRow({
  model,
  groupLabel,
  saving,
  onToggle,
  onOpenSettings,
}: {
  readonly model: PlatformAiModel;
  readonly groupLabel: string;
  readonly saving: boolean;
  readonly onToggle: (model: PlatformAiModel, enabled: boolean) => void;
  readonly onOpenSettings: (model: PlatformAiModel) => void;
}) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border px-2 py-2 sm:gap-3 sm:px-3",
        SURFACE_BORDER,
        SURFACE_ROW_HOVER,
        !model.platformEnabled && "opacity-60"
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{model.displayName}</p>
        <p
          className="truncate text-xs text-muted-foreground"
          title={`${groupLabel} · ${model.canonicalId}`}
        >
          {groupLabel} · {model.canonicalId}
        </p>
      </div>

      <Switch
        id={`enable-${model.canonicalId}`}
        checked={model.platformEnabled}
        disabled={saving}
        onCheckedChange={(enabled) => onToggle(model, enabled)}
        aria-label={t("pages.adminAiModels.platformEnabled")}
      />

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={saving}
        onClick={() => onOpenSettings(model)}
      >
        {t("pages.adminAiModels.settings")}
      </Button>
    </div>
  );
}

export function ModelSettingsDialogShell({
  title,
  description,
  dialogWidth = "default",
  saving,
  onClose,
  onSave,
  children,
}: {
  readonly title: string;
  readonly description: string;
  readonly dialogWidth?: "default" | "800";
  readonly saving: boolean;
  readonly onClose: () => void;
  readonly onSave: () => void;
  readonly children: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={
          dialogWidth === "800"
            ? ADMIN_MODEL_SETTINGS_DIALOG_800_CLASS
            : ADMIN_MODEL_SETTINGS_DIALOG_CLASS
        }
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader className="space-y-1.5 px-6 pt-6 text-left">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className={cn(PAGE_SCROLL_CLASS, "flex-1 space-y-3 px-6 py-4 pr-5")}>
          {children}
        </div>

        <DialogFooter className="border-t bg-background px-6 py-4">
          <Button type="button" variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="button" disabled={saving} onClick={onSave}>
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function useAdminParamApiNameAddon(
  apiName: string,
  onChange: (value: string) => void
): {
  readonly titleAddon: ReactNode;
} {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const trimmed = apiName.trim();

  const titleAddon = !trimmed ? null : editing ? (
    <Input
      autoFocus
      className="h-4 w-24 min-w-16 px-1 py-0 text-[11px] leading-none shadow-none focus-visible:ring-1"
      value={apiName}
      onBlur={() => setEditing(false)}
      onChange={(event) => onChange(event.target.value)}
    />
  ) : (
    <span className="inline-flex items-center gap-0.5">
      <span className={ADMIN_PARAM_API_NAME_CLASS}>{apiName}</span>
      <button
        type="button"
        aria-label={t("common.edit")}
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        onClick={() => setEditing(true)}
      >
        <PencilIcon width={10} height={10} strokeWidth={1.5} aria-hidden />
      </button>
    </span>
  );

  return { titleAddon };
}

export function SettingsSection({
  title,
  titleAddon,
  action,
  children,
  stacked = false,
  compact = false,
  columns = 2,
}: {
  readonly title: string;
  readonly titleAddon?: ReactNode;
  readonly action?: ReactNode;
  readonly children: ReactNode;
  readonly stacked?: boolean;
  readonly compact?: boolean;
  readonly columns?: 2 | 3;
}) {
  const gridClass =
    columns === 3 ? ADMIN_SETTINGS_GRID_CLASS : ADMIN_SETTINGS_GRID_2_CLASS;

  if (compact) {
    return (
      <div className={cn("rounded-lg border p-3", SURFACE_BORDER, SURFACE_MUTED_INSET)}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="text-xs font-medium text-foreground">{title}</p>
            {titleAddon}
          </div>
          {action}
        </div>
        <div
          className={cn(
            stacked ? "flex flex-col gap-3" : gridClass
          )}
        >
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border", SURFACE_BORDER, SURFACE_MUTED_INSET)}>
      <div className={cn("border-b px-3 py-2", SURFACE_BORDER)}>
        <p className="text-sm font-semibold">{title}</p>
      </div>
      <div
        className={cn(
          "p-3",
          stacked ? "flex flex-col gap-3" : gridClass
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function AdminFieldRow({
  label,
  children,
  className,
}: {
  readonly label: string;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className={ADMIN_PARAM_LABEL_CLASS}>{label}</Label>
      {children}
    </div>
  );
}

export function ImageModelBasicFields({
  canonicalId,
  displayName,
  onDisplayNameChange,
  groupId,
  onGroupIdChange,
  groups,
}: {
  readonly canonicalId: string;
  readonly displayName: string;
  readonly onDisplayNameChange: (value: string) => void;
  readonly groupId: string;
  readonly onGroupIdChange: (value: string) => void;
  readonly groups: readonly PlatformAiModelGroup[];
}) {
  const { t } = useTranslation();

  return (
    <>
      <AdminFieldRow label={t("pages.adminAiModels.modelCanonicalId")}>
        <Input
          readOnly
          tabIndex={-1}
          aria-readonly
          className={cn(ADMIN_READONLY_CONTROL_CLASS, "font-mono text-xs")}
          value={canonicalId}
        />
      </AdminFieldRow>
      <AdminFieldRow label={t("pages.adminAiModels.modelDisplayName")}>
        <Input
          className={ADMIN_CONTROL_CLASS}
          value={displayName}
          onChange={(event) => onDisplayNameChange(event.target.value)}
        />
      </AdminFieldRow>
      <AdminFieldRow label={t("pages.adminAiModels.modelGroup")}>
        <Select value={groupId} onValueChange={onGroupIdChange}>
          <SelectTrigger className={ADMIN_CONTROL_CLASS}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ADMIN_NO_GROUP_VALUE}>
              {t("pages.adminAiModels.noGroup")}
            </SelectItem>
            {groups.map((group) => (
              <SelectItem key={group.id} value={group.id}>
                {group.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </AdminFieldRow>
    </>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  className,
  controlClassName,
  paramLabel = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly className?: string;
  readonly controlClassName?: string;
  readonly paramLabel?: boolean;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className={paramLabel ? ADMIN_PARAM_LABEL_CLASS : "text-sm"}>
        {label}
      </Label>
      <Input
        className={cn(ADMIN_CONTROL_CLASS, controlClassName)}
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

export function MbField({
  label,
  value,
  onChange,
  className,
  controlClassName,
  paramLabel = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly className?: string;
  readonly controlClassName?: string;
  readonly paramLabel?: boolean;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className={paramLabel ? ADMIN_PARAM_LABEL_CLASS : "text-sm"}>
        {label}
      </Label>
      <Input
        className={cn(ADMIN_CONTROL_CLASS, controlClassName)}
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
