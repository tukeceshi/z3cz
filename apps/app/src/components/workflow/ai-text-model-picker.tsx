import type { OrgTextModelOption } from "@dafthunk/types";
import CheckIcon from "lucide-react/icons/check";
import { useMemo, useState } from "react";
import { Link } from "react-router";

import { useTranslation } from "@/components/locale-provider";
import { ModelBrandIcon } from "@/components/model-brand-icon";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { TranslationKey } from "@/i18n";
import { useOrgUrl } from "@/hooks/use-org-url";
import { cn } from "@/utils/utils";

import { LIST_SCROLL_CLASS } from "@/components/list-scroll";

import {
  AI_BOTTOM_CHIP_CLASS,
  AI_BOTTOM_CHIP_OPEN_CLASS,
} from "./ai-bottom-chip";
import { DEFAULT_BRAND_ICON } from "@/components/model-brand-icon-picker";

export function sortModelsForPicker(
  models: readonly OrgTextModelOption[]
): readonly OrgTextModelOption[] {
  return [...models].sort(
    (a, b) =>
      a.sortOrder - b.sortOrder ||
      a.displayName.localeCompare(b.displayName)
  );
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
  readonly selectedOptionId: string;
  readonly chipModel?: OrgTextModelOption;
  readonly disabled?: boolean;
  readonly isLoading?: boolean;
  readonly loadError?: boolean;
  readonly onRetryLoad?: () => void;
  readonly onOpenChange?: (open: boolean) => void;
  readonly modelFitsCurrentRefs: (model: OrgTextModelOption) => boolean;
  readonly onSelect: (optionId: string) => void;
}

export function AiTextModelPicker({
  models,
  selectedOptionId,
  chipModel,
  disabled = false,
  isLoading = false,
  loadError = false,
  onRetryLoad,
  onOpenChange,
  modelFitsCurrentRefs,
  onSelect,
}: AiTextModelPickerProps) {
  const { t } = useTranslation();
  const { getOrgUrl } = useOrgUrl();
  const [open, setOpen] = useState(false);

  const selected =
    models.find((entry) => entry.optionId === selectedOptionId) ?? chipModel;

  const availableModels = useMemo(
    () => models.filter((model) => model.selectable),
    [models]
  );

  const sortedModels = useMemo(
    () => sortModelsForPicker(availableModels),
    [availableModels]
  );

  const handleSelect = (model: OrgTextModelOption) => {
    if (!model.selectable || !modelFitsCurrentRefs(model)) return;
    onSelect(model.optionId);
    setOpen(false);
  };

  if (loadError && availableModels.length === 0 && models.length === 0) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => onRetryLoad?.()}
        className={cn(
          "nodrag inline-flex h-8 max-w-[240px] items-center gap-1.5 rounded-full px-3 text-left text-xs transition",
          "bg-muted/45 text-amber-700 hover:bg-muted/65 dark:text-amber-400",
          "disabled:pointer-events-none disabled:opacity-50"
        )}
      >
        <span className="truncate">
          {t("workflow.aiTextPanel.modelsLoadFailed")}
        </span>
        <span className="shrink-0 underline underline-offset-2">
          {t("workflow.aiTextPanel.retryLoadModels")}
        </span>
      </button>
    );
  }

  if (!isLoading && !loadError && models.length === 0) {
    return (
      <div
        className={cn(
          "nodrag inline-flex h-8 max-w-[280px] items-center gap-1.5 rounded-full px-3 text-xs",
          "bg-muted/45 text-muted-foreground"
        )}
      >
        <span className="truncate">
          {t("workflow.aiTextPanel.noModelsAvailable")}
        </span>
        <Link
          to={getOrgUrl("/ai-interfaces")}
          className="shrink-0 underline underline-offset-2 hover:text-foreground"
        >
          {t("workflow.aiTextPanel.openAiInterfaces")}
        </Link>
      </div>
    );
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        onOpenChange?.(nextOpen);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled || availableModels.length === 0}
          className={cn(
            "nodrag",
            AI_BOTTOM_CHIP_CLASS,
            open && AI_BOTTOM_CHIP_OPEN_CLASS
          )}
        >
          <ModelBrandIcon
            icon={selected?.brandIcon ?? DEFAULT_BRAND_ICON}
            className="size-4"
          />
          <span className="truncate">
            {selected?.displayName ?? t("workflow.aiTextPanel.selectModel")}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className="nodrag nowheel w-[320px] border-border bg-card p-0 dark:border-neutral-700 dark:bg-neutral-800"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className={cn("max-h-[500px] p-1", LIST_SCROLL_CLASS)}>
          <div className="space-y-0.5">
            {sortedModels.map((model) => (
              <ModelOptionRow
                key={model.optionId}
                model={model}
                selected={model.optionId === selectedOptionId}
                fitsReferences={modelFitsCurrentRefs(model)}
                onSelect={handleSelect}
              />
            ))}
          </div>

          {availableModels.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">
              {t("workflow.aiTextPanel.noModelsAvailable")}
            </p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
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
        "flex h-[42px] w-full items-center gap-2 rounded-lg px-2 text-left transition",
        available
          ? "hover:bg-muted/30 dark:hover:bg-neutral-700/40"
          : "opacity-50",
        selected && "bg-muted/30 dark:bg-neutral-700/40"
      )}
      onClick={() => onSelect(model)}
    >
      <span className="flex size-[30px] shrink-0 items-center justify-center rounded-lg bg-muted dark:bg-neutral-700">
        <ModelBrandIcon
          icon={model.brandIcon ?? DEFAULT_BRAND_ICON}
          className="size-4 bg-transparent"
        />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
        {model.displayName}
        {suffix}
      </span>
      {selected ? (
        <CheckIcon className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
      ) : null}
    </button>
  );
}
