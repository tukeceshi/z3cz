import type {
  OrgTextModelOption,
  PlatformAiModelGroup,
} from "@dafthunk/types";
import CheckIcon from "lucide-react/icons/check";
import ChevronDownIcon from "lucide-react/icons/chevron-down";
import SparklesIcon from "lucide-react/icons/sparkles";
import ZapIcon from "lucide-react/icons/zap";
import { useMemo, useState, type ReactNode } from "react";

import { useTranslation } from "@/components/locale-provider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { TranslationKey } from "@/i18n";
import { cn } from "@/utils/utils";

const RECENT_STORAGE_PREFIX = "dafthunk.ai-text.recent-models.";
const MAX_RECENT = 1;

function readRecentIds(orgId: string | undefined): readonly string[] {
  if (!orgId || typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(`${RECENT_STORAGE_PREFIX}${orgId}`);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is string => typeof entry === "string");
  } catch {
    return [];
  }
}

function writeRecentId(orgId: string | undefined, canonicalId: string): void {
  if (!orgId || typeof window === "undefined") return;
  const next = [
    canonicalId,
    ...readRecentIds(orgId).filter((id) => id !== canonicalId),
  ].slice(0, MAX_RECENT);
  window.localStorage.setItem(
    `${RECENT_STORAGE_PREFIX}${orgId}`,
    JSON.stringify(next)
  );
}

/** Persist a model as recently used after a successful generate. */
export function rememberAiTextRecentModel(
  orgId: string | undefined,
  canonicalId: string
): void {
  writeRecentId(orgId, canonicalId);
}

function groupIcon(icon: string | null | undefined): ReactNode {
  switch (icon) {
    case "zap":
      return <ZapIcon className="h-4 w-4 shrink-0" />;
    default:
      return <SparklesIcon className="h-4 w-4 shrink-0" />;
  }
}

function unavailableReasonKey(
  reason: OrgTextModelOption["unavailableReason"]
): TranslationKey {
  switch (reason) {
    case "model_disabled_on_interface":
      return "workflow.aiTextPanel.modelDisabledOnInterface";
    case "model_missing_on_interface":
      return "workflow.aiTextPanel.modelMissingOnInterface";
    case "no_org_interface":
      return "workflow.aiTextPanel.modelNoOrgInterface";
    default:
      return "workflow.aiTextPanel.modelNoInterface";
  }
}

export interface AiTextModelPickerProps {
  readonly orgId: string | undefined;
  readonly models: readonly OrgTextModelOption[];
  readonly groups: readonly PlatformAiModelGroup[];
  readonly selectedModelId: string;
  readonly disabled?: boolean;
  readonly modelFitsCurrentRefs: (model: OrgTextModelOption) => boolean;
  readonly onSelect: (canonicalId: string) => void;
}

export function AiTextModelPicker({
  orgId,
  models,
  groups,
  selectedModelId,
  disabled = false,
  modelFitsCurrentRefs,
  onSelect,
}: AiTextModelPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [recentTick, setRecentTick] = useState(0);

  const selected = models.find((entry) => entry.canonicalId === selectedModelId);

  const recentIds = useMemo(() => {
    void recentTick;
    return readRecentIds(orgId);
  }, [orgId, recentTick]);

  const recentModels = useMemo(() => {
    const byId = new Map(models.map((model) => [model.canonicalId, model]));
    return recentIds
      .map((id) => byId.get(id))
      .filter((entry): entry is OrgTextModelOption => Boolean(entry))
      .slice(0, MAX_RECENT);
  }, [models, recentIds]);

  const groupedSections = useMemo(() => {
    const orderedGroups = [...groups].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)
    );
    const seen = new Set<string>();
    const sections: {
      readonly id: string;
      readonly name: string;
      readonly icon: string;
      readonly models: OrgTextModelOption[];
    }[] = [];

    for (const group of orderedGroups) {
      const groupModels = models.filter(
        (model) => model.groupId === group.id
      );
      if (groupModels.length === 0) continue;
      for (const model of groupModels) seen.add(model.canonicalId);
      sections.push({
        id: group.id,
        name: group.name,
        icon: group.icon,
        models: groupModels,
      });
    }

    const ungrouped = models.filter((model) => !seen.has(model.canonicalId));
    if (ungrouped.length > 0) {
      sections.push({
        id: "__ungrouped",
        name: t("workflow.aiTextPanel.modelGroupOther"),
        icon: "sparkles",
        models: ungrouped,
      });
    }

    return sections;
  }, [groups, models, t]);

  const handleSelect = (model: OrgTextModelOption) => {
    if (!model.selectable || !modelFitsCurrentRefs(model)) return;
    onSelect(model.canonicalId);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setRecentTick((value) => value + 1);
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled || models.length === 0}
          className={cn(
            "nodrag inline-flex h-9 max-w-[220px] items-center gap-1.5 rounded-lg border border-border/80",
            "bg-background px-2.5 text-left text-xs shadow-sm transition hover:bg-muted/40",
            "disabled:pointer-events-none disabled:opacity-50"
          )}
        >
          {groupIcon(selected?.groupIcon)}
          <span className="truncate font-medium">
            {selected?.displayName ?? t("workflow.aiTextPanel.selectModel")}
          </span>
          <ChevronDownIcon className="ml-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className="nodrag nowheel w-[480px] p-0"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className="max-h-[360px] overflow-y-auto p-2">
          {recentModels.length > 0 ? (
            <ModelSection title={t("workflow.aiTextPanel.modelRecent")}>
              {recentModels.map((model) => (
                <ModelOptionRow
                  key={`recent-${model.canonicalId}`}
                  model={model}
                  selected={model.canonicalId === selectedModelId}
                  fitsReferences={modelFitsCurrentRefs(model)}
                  onSelect={handleSelect}
                />
              ))}
            </ModelSection>
          ) : null}

          {groupedSections.map((section) => (
            <ModelSection
              key={section.id}
              title={section.name}
              icon={groupIcon(section.icon)}
            >
              {section.models.map((model) => (
                <ModelOptionRow
                  key={model.canonicalId}
                  model={model}
                  selected={model.canonicalId === selectedModelId}
                  fitsReferences={modelFitsCurrentRefs(model)}
                  onSelect={handleSelect}
                />
              ))}
            </ModelSection>
          ))}

          {models.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">
              {t("workflow.aiTextPanel.selectModel")}
            </p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ModelSection({
  title,
  icon,
  children,
}: {
  readonly title: string;
  readonly icon?: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <div className="mb-2 last:mb-0">
      <div className="mb-1 flex items-center gap-1.5 px-2 pt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        <span>{title}</span>
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function ModelOptionRow({
  model,
  selected,
  fitsReferences,
  onSelect,
}: {
  readonly model: OrgTextModelOption;
  readonly selected: boolean;
  readonly fitsReferences: boolean;
  readonly onSelect: (model: OrgTextModelOption) => void;
}) {
  const { t } = useTranslation();
  const available = model.selectable && fitsReferences;

  let suffix = "";
  if (!model.selectable) {
    suffix = ` (${t(unavailableReasonKey(model.unavailableReason))})`;
  } else if (!fitsReferences) {
    suffix = ` (${t("workflow.aiTextPanel.modelExceedsReferences")})`;
  }

  return (
    <button
      type="button"
      disabled={!available}
      className={cn(
        "flex w-full items-start gap-2 rounded-md px-2 py-2 text-left transition",
        available ? "hover:bg-muted/60" : "opacity-50",
        selected && "bg-muted/40"
      )}
      onClick={() => onSelect(model)}
    >
      <span className="mt-0.5 text-muted-foreground">
        {groupIcon(model.groupIcon)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          <span className="truncate">
            {model.displayName}
            {suffix}
          </span>
          {selected ? (
            <CheckIcon className="h-3 w-3 shrink-0 text-emerald-500" />
          ) : null}
        </span>
        {model.description || model.groupDescription ? (
          <span className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
            {model.description || model.groupDescription}
          </span>
        ) : null}
      </span>
    </button>
  );
}
