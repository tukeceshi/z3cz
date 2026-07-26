import type {
  OrgTextModelOption,
  PlatformAiModelGroup,
} from "@dafthunk/types";
import CheckIcon from "lucide-react/icons/check";
import ChevronDownIcon from "lucide-react/icons/chevron-down";
import ChevronRightIcon from "lucide-react/icons/chevron-right";
import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";

import { useTranslation } from "@/components/locale-provider";
import { ModelBrandIcon } from "@/components/model-brand-icon";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { TranslationKey } from "@/i18n";
import { cn } from "@/utils/utils";

const RECENT_STORAGE_PREFIX = "dafthunk.ai-text.recent-models.";
const MAX_RECENT = 1;
const UNGROUPED_SECTION_ID = "__ungrouped";
const LIST_MAX_HEIGHT_PX = 500;
const FLYOUT_GAP_PX = 6;

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

export interface ModelBrandSection {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly icon: string;
  readonly models: readonly OrgTextModelOption[];
}

export function buildModelBrandSections(params: {
  readonly models: readonly OrgTextModelOption[];
  readonly groups: readonly PlatformAiModelGroup[];
  readonly otherGroupLabel: string;
}): readonly ModelBrandSection[] {
  const orderedGroups = [...params.groups].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)
  );
  const seen = new Set<string>();
  const sections: ModelBrandSection[] = [];

  for (const group of orderedGroups) {
    const groupModels = params.models.filter(
      (model) => model.groupId === group.id
    );
    if (groupModels.length === 0) continue;
    for (const model of groupModels) seen.add(model.canonicalId);
    sections.push({
      id: group.id,
      name: group.name,
      description: group.description,
      icon: group.icon,
      models: groupModels,
    });
  }

  const ungrouped = params.models.filter((model) => !seen.has(model.canonicalId));
  if (ungrouped.length > 0) {
    sections.push({
      id: UNGROUPED_SECTION_ID,
      name: params.otherGroupLabel,
      description: "",
      icon: "sparkles",
      models: ungrouped,
    });
  }

  return sections;
}

export function resolveActiveBrandId(params: {
  readonly selectedModel: OrgTextModelOption | undefined;
  readonly sections: readonly ModelBrandSection[];
}): string | null {
  if (!params.selectedModel) return null;
  if (params.selectedModel.groupId) {
    return params.selectedModel.groupId;
  }

  const ungrouped = params.sections.find(
    (section) => section.id === UNGROUPED_SECTION_ID
  );
  if (
    ungrouped?.models.some(
      (model) => model.canonicalId === params.selectedModel?.canonicalId
    )
  ) {
    return UNGROUPED_SECTION_ID;
  }

  return null;
}

export function resolveBrandFlyoutPlacement(params: {
  readonly spaceAbove: number;
  readonly spaceBelow: number;
  readonly flyoutHeight: number;
  readonly gap?: number;
}): "above" | "below" {
  const gap = params.gap ?? FLYOUT_GAP_PX;
  if (params.spaceAbove >= params.flyoutHeight + gap) {
    return "above";
  }
  return "below";
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
  const [flyoutBrandId, setFlyoutBrandId] = useState<string | null>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

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

  const brandSections = useMemo(
    () =>
      buildModelBrandSections({
        models,
        groups,
        otherGroupLabel: t("workflow.aiTextPanel.modelGroupOther"),
      }),
    [groups, models, t]
  );

  const activeBrandId = useMemo(
    () =>
      resolveActiveBrandId({
        selectedModel: selected,
        sections: brandSections,
      }),
    [brandSections, selected]
  );

  const handleSelect = (model: OrgTextModelOption) => {
    if (!model.selectable || !modelFitsCurrentRefs(model)) return;
    onSelect(model.canonicalId);
    setFlyoutBrandId(null);
    setOpen(false);
  };

  const handleBrandClick = (
    section: ModelBrandSection,
    singleModel: OrgTextModelOption | undefined
  ) => {
    if (
      singleModel &&
      singleModel.selectable &&
      modelFitsCurrentRefs(singleModel)
    ) {
      handleSelect(singleModel);
      return;
    }

    setFlyoutBrandId((current) =>
      current === section.id ? null : section.id
    );
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setFlyoutBrandId(null);
        }
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
            "nodrag inline-flex h-8 max-w-[240px] items-center gap-1.5 rounded-full px-3 text-left text-xs transition",
            "bg-muted/45 text-muted-foreground hover:bg-muted/65",
            open && "bg-muted/75 text-foreground",
            "disabled:pointer-events-none disabled:opacity-50"
          )}
        >
          <ModelBrandIcon
            canonicalId={selected?.canonicalId}
            groupId={selected?.groupId}
            className="size-4"
          />
          <span className="truncate">
            {selected?.displayName ?? t("workflow.aiTextPanel.selectModel")}
          </span>
          <ChevronDownIcon className="ml-0.5 h-3.5 w-3.5 shrink-0 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className="nodrag nowheel w-[320px] p-0"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className="border-b border-border/60 px-3 py-2 text-xs font-medium text-foreground">
          {t("workflow.aiTextPanel.modelPickerTitle")}
        </div>
        <div
          ref={listContainerRef}
          className="relative overflow-y-auto p-2"
          style={{ maxHeight: LIST_MAX_HEIGHT_PX }}
        >
          {recentModels.length > 0 ? (
            <div className="mb-2 last:mb-0">
              <div className="mb-1 px-2 pt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t("workflow.aiTextPanel.modelRecent")}
              </div>
              <div className="space-y-0.5">
                {recentModels.map((model) => (
                  <ModelOptionRow
                    key={`recent-${model.canonicalId}`}
                    model={model}
                    selected={model.canonicalId === selectedModelId}
                    fitsReferences={modelFitsCurrentRefs(model)}
                    onSelect={handleSelect}
                  />
                ))}
              </div>
            </div>
          ) : null}

          <div className="space-y-1">
            {brandSections.map((section) => (
              <BrandSectionBlock
                key={section.id}
                section={section}
                isActiveBrand={activeBrandId === section.id}
                isFlyoutOpen={flyoutBrandId === section.id}
                selectedModelId={selectedModelId}
                listContainerRef={listContainerRef}
                modelFitsCurrentRefs={modelFitsCurrentRefs}
                onBrandClick={() =>
                  handleBrandClick(
                    section,
                    section.models.length === 1 ? section.models[0] : undefined
                  )
                }
                onSelectModel={handleSelect}
              />
            ))}
          </div>

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

function BrandSectionBlock({
  section,
  isActiveBrand,
  isFlyoutOpen,
  selectedModelId,
  listContainerRef,
  modelFitsCurrentRefs,
  onBrandClick,
  onSelectModel,
}: {
  readonly section: ModelBrandSection;
  readonly isActiveBrand: boolean;
  readonly isFlyoutOpen: boolean;
  readonly selectedModelId: string;
  readonly listContainerRef: RefObject<HTMLDivElement | null>;
  readonly modelFitsCurrentRefs: (model: OrgTextModelOption) => boolean;
  readonly onBrandClick: () => void;
  readonly onSelectModel: (model: OrgTextModelOption) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);
  const [flyoutPlacement, setFlyoutPlacement] = useState<"above" | "below">(
    "above"
  );

  const hasMultipleModels = section.models.length > 1;
  const representativeCanonicalId = section.models[0]?.canonicalId;

  useLayoutEffect(() => {
    if (!isFlyoutOpen || !rowRef.current || !listContainerRef.current) {
      return;
    }

    const container = listContainerRef.current;
    const row = rowRef.current;
    const flyout = flyoutRef.current;
    const containerRect = container.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    const flyoutHeight = flyout?.offsetHeight ?? section.models.length * 34 + 12;

    setFlyoutPlacement(
      resolveBrandFlyoutPlacement({
        spaceAbove: rowRect.top - containerRect.top,
        spaceBelow: containerRect.bottom - rowRect.bottom,
        flyoutHeight,
      })
    );
  }, [isFlyoutOpen, listContainerRef, section.models.length]);

  return (
    <div ref={rowRef} className="relative">
      <BrandRow
        section={section}
        representativeCanonicalId={representativeCanonicalId}
        isActiveBrand={isActiveBrand}
        isFlyoutOpen={isFlyoutOpen}
        hasMultipleModels={hasMultipleModels}
        onClick={onBrandClick}
      />

      {isFlyoutOpen && hasMultipleModels ? (
        <div
          ref={flyoutRef}
          className={cn(
            "absolute inset-x-0 z-50 overflow-y-auto rounded-lg border border-border/90 bg-popover p-1 shadow-lg",
            flyoutPlacement === "above"
              ? "bottom-full mb-1.5"
              : "top-full mt-1.5"
          )}
          style={{ maxHeight: Math.min(280, LIST_MAX_HEIGHT_PX - 48) }}
        >
          {section.models.map((model) => (
            <ModelOptionRow
              key={model.canonicalId}
              model={model}
              selected={model.canonicalId === selectedModelId}
              fitsReferences={modelFitsCurrentRefs(model)}
              onSelect={onSelectModel}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function BrandRow({
  section,
  representativeCanonicalId,
  isActiveBrand,
  isFlyoutOpen,
  hasMultipleModels,
  onClick,
}: {
  readonly section: ModelBrandSection;
  readonly representativeCanonicalId: string | undefined;
  readonly isActiveBrand: boolean;
  readonly isFlyoutOpen: boolean;
  readonly hasMultipleModels: boolean;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-start gap-2.5 rounded-lg px-2 py-2.5 text-left transition",
        "hover:bg-muted/80",
        isActiveBrand && "bg-muted/70 ring-1 ring-border/70",
        isFlyoutOpen && "bg-muted/90 ring-1 ring-border"
      )}
      onClick={onClick}
    >
      <span className="mt-0.5">
        <ModelBrandIcon
          groupId={section.id === UNGROUPED_SECTION_ID ? null : section.id}
          canonicalId={representativeCanonicalId}
          className="size-5"
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">
          {section.name}
        </span>
        {section.description ? (
          <span className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
            {section.description}
          </span>
        ) : null}
      </span>
      {hasMultipleModels ? (
        <span className="mt-0.5 shrink-0 text-muted-foreground">
          {isFlyoutOpen ? (
            <ChevronDownIcon className="h-3.5 w-3.5" />
          ) : (
            <ChevronRightIcon className="h-3.5 w-3.5" />
          )}
        </span>
      ) : null}
    </button>
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
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition",
        available ? "hover:bg-muted/80" : "opacity-50",
        selected && "bg-muted/90"
      )}
      onClick={() => onSelect(model)}
    >
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
        {model.displayName}
        {suffix}
      </span>
      {selected ? (
        <CheckIcon className="h-3 w-3 shrink-0 text-emerald-500" />
      ) : null}
    </button>
  );
}
