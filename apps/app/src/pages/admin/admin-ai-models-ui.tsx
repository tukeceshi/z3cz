import type { PlatformAiModel } from "@dafthunk/types";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import GripVerticalIcon from "lucide-react/icons/grip-vertical";
import PencilIcon from "lucide-react/icons/pencil";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { useTranslation } from "@/components/locale-provider";
import { ModelBrandIcon } from "@/components/model-brand-icon";
import { ModelBrandIconPicker, DEFAULT_BRAND_ICON } from "@/components/model-brand-icon-picker";
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
import { Switch } from "@/components/ui/switch";
import {
  SURFACE_BORDER,
  SURFACE_MUTED_INSET,
  SURFACE_ROW_HOVER,
} from "@/components/ui/surface";
import { cn } from "@/utils/utils";

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
  emptyLabel,
  isLoading,
  savingId,
  reordering,
  onToggle,
  onOpenSettings,
  onReorderModels,
}: {
  readonly models: readonly PlatformAiModel[];
  readonly emptyLabel: string;
  readonly isLoading: boolean;
  readonly savingId: string | null;
  readonly reordering: boolean;
  readonly onToggle: (model: PlatformAiModel, enabled: boolean) => void;
  readonly onOpenSettings: (model: PlatformAiModel) => void;
  readonly onReorderModels: (orderedIds: readonly string[]) => void;
}) {
  const { t } = useTranslation();

  const orderedModels = useMemo(
    () =>
      [...models].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.displayName.localeCompare(b.displayName)
      ),
    [models]
  );

  const [items, setItems] = useState(orderedModels);

  useEffect(() => {
    setItems(orderedModels);
  }, [orderedModels]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = items.findIndex((model) => model.canonicalId === active.id);
    const newIndex = items.findIndex((model) => model.canonicalId === over.id);
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);
    onReorderModels(next.map((model) => model.canonicalId));
  };

  if (isLoading) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {t("common.loading")}
      </p>
    );
  }

  if (orderedModels.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </p>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map((model) => model.canonicalId)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2">
          {items.map((model) => (
            <SortableAdminModelListRow
              key={model.canonicalId}
              model={model}
              saving={savingId === model.canonicalId}
              reordering={reordering}
              onToggle={onToggle}
              onOpenSettings={onOpenSettings}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableAdminModelListRow({
  model,
  saving,
  reordering,
  onToggle,
  onOpenSettings,
}: {
  readonly model: PlatformAiModel;
  readonly saving: boolean;
  readonly reordering: boolean;
  readonly onToggle: (model: PlatformAiModel, enabled: boolean) => void;
  readonly onOpenSettings: (model: PlatformAiModel) => void;
}) {
  const { t } = useTranslation();

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: model.canonicalId,
    disabled: reordering || saving,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded-lg border px-2 py-2 sm:gap-3 sm:px-3",
        SURFACE_BORDER,
        SURFACE_ROW_HOVER,
        !model.platformEnabled && "opacity-60",
        isDragging && "z-10 shadow-md"
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        className={cn(
          "flex h-8 w-6 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60 active:cursor-grabbing",
          (reordering || saving) && "cursor-not-allowed opacity-50"
        )}
        disabled={reordering || saving}
        title={t("pages.adminAiModels.dragToReorder")}
        aria-label={t("pages.adminAiModels.dragToReorder")}
        {...attributes}
        {...listeners}
      >
        <GripVerticalIcon className="h-4 w-4" />
      </button>

      <ModelBrandIcon
        icon={model.brandIcon ?? DEFAULT_BRAND_ICON}
        className="size-5 shrink-0"
      />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{model.displayName}</p>
        <p
          className="truncate text-xs text-muted-foreground"
          title={model.canonicalId}
        >
          {model.canonicalId}
        </p>
      </div>

      <Switch
        id={`enable-${model.canonicalId}`}
        checked={model.platformEnabled}
        disabled={saving || reordering}
        onCheckedChange={(enabled) => onToggle(model, enabled)}
        aria-label={t("pages.adminAiModels.platformEnabled")}
      />

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={saving || reordering}
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

export function AdminModelBasicFields({
  canonicalId,
  displayName,
  onDisplayNameChange,
  brandIcon,
  onBrandIconChange,
}: {
  readonly canonicalId: string;
  readonly displayName: string;
  readonly onDisplayNameChange: (value: string) => void;
  readonly brandIcon: string;
  readonly onBrandIconChange: (value: string) => void;
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
      <ModelBrandIconPicker
        label={t("pages.adminAiModels.brandIcon")}
        value={brandIcon}
        onChange={onBrandIconChange}
        controlClassName={ADMIN_CONTROL_CLASS}
        popoverWidthClassName={ADMIN_CONTROL_WIDTH_CLASS}
      />
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
