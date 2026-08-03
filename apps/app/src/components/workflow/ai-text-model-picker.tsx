import type {
  OrgTextModelOption,
  PlatformAiModelGroup,
} from "@dafthunk/types";
import CheckIcon from "lucide-react/icons/check";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
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

const UNGROUPED_SECTION_ID = "__ungrouped";
const FLYOUT_GAP_PX = 6;
const FLYOUT_WIDTH_PX = 240;
const FLYOUT_MAX_HEIGHT_PX = 280;
const VIEWPORT_PADDING_PX = 8;

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
    for (const model of groupModels) seen.add(model.optionId);
    sections.push({
      id: group.id,
      name: group.name,
      description: group.description,
      icon: group.icon,
      models: groupModels,
    });
  }

  const ungrouped = params.models.filter((model) => !seen.has(model.optionId));
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
  readonly selectedOptionId: string;
  readonly sections: readonly ModelBrandSection[];
}): string | null {
  if (!params.selectedOptionId) return null;

  for (const section of params.sections) {
    if (
      section.models.some(
        (model) => model.optionId === params.selectedOptionId
      )
    ) {
      return section.id;
    }
  }

  return null;
}

export interface BrandFlyoutLayout {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly maxHeight: number;
}

export function resolveBrandFlyoutLayout(params: {
  readonly rowRect: Pick<DOMRect, "top" | "left" | "right" | "width">;
  readonly gap?: number;
  readonly viewportWidth?: number;
  readonly viewportHeight?: number;
  readonly viewportPadding?: number;
  readonly flyoutWidth?: number;
  readonly maxFlyoutHeight?: number;
}): BrandFlyoutLayout {
  const gap = params.gap ?? FLYOUT_GAP_PX;
  const padding = params.viewportPadding ?? VIEWPORT_PADDING_PX;
  const viewportWidth = params.viewportWidth ?? 800;
  const viewportHeight = params.viewportHeight ?? 800;
  const flyoutWidth = params.flyoutWidth ?? FLYOUT_WIDTH_PX;
  const maxFlyoutCap = params.maxFlyoutHeight ?? FLYOUT_MAX_HEIGHT_PX;

  const rowRight = params.rowRect.right;
  const spaceRight = viewportWidth - rowRight - padding;

  const left =
    spaceRight >= flyoutWidth + gap
      ? rowRight + gap
      : Math.max(padding, params.rowRect.left - gap - flyoutWidth);

  const top = Math.max(padding, params.rowRect.top);
  const maxHeight = Math.min(
    maxFlyoutCap,
    Math.max(viewportHeight - top - padding, 0)
  );

  return {
    top,
    left,
    width: flyoutWidth,
    maxHeight,
  };
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
  readonly selectedOptionId: string;
  readonly disabled?: boolean;
  readonly isLoading?: boolean;
  readonly loadError?: boolean;
  readonly onRetryLoad?: () => void;
  readonly modelFitsCurrentRefs: (model: OrgTextModelOption) => boolean;
  readonly onSelect: (optionId: string) => void;
}

export function AiTextModelPicker({
  models,
  groups,
  selectedOptionId,
  disabled = false,
  isLoading = false,
  loadError = false,
  onRetryLoad,
  modelFitsCurrentRefs,
  onSelect,
}: AiTextModelPickerProps) {
  const { t } = useTranslation();
  const { getOrgUrl } = useOrgUrl();
  const [open, setOpen] = useState(false);
  const [flyoutBrandId, setFlyoutBrandId] = useState<string | null>(null);

  const selected = models.find((entry) => entry.optionId === selectedOptionId);

  const availableModels = useMemo(
    () => models.filter((model) => model.selectable),
    [models]
  );

  const brandSections = useMemo(
    () =>
      buildModelBrandSections({
        models: availableModels,
        groups,
        otherGroupLabel: t("workflow.aiTextPanel.modelGroupOther"),
      }),
    [availableModels, groups, t]
  );

  const activeBrandId = useMemo(
    () =>
      resolveActiveBrandId({
        selectedOptionId,
        sections: brandSections,
      }),
    [brandSections, selectedOptionId]
  );

  const handleSelect = (model: OrgTextModelOption) => {
    if (!model.selectable || !modelFitsCurrentRefs(model)) return;
    onSelect(model.optionId);
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
        if (!nextOpen) {
          setFlyoutBrandId(null);
        }
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
            canonicalId={selected?.canonicalId}
            groupId={selected?.groupId}
            icon={
              selected?.groupId
                ? groups.find((group) => group.id === selected.groupId)?.icon
                : undefined
            }
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
        data-ai-model-picker-popover=""
        className="nodrag nowheel w-[320px] border-border bg-card p-0 dark:border-neutral-700 dark:bg-neutral-800"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className={cn("max-h-[500px] p-1", LIST_SCROLL_CLASS)}>
          <div className="space-y-0.5">
            {brandSections.map((section) => (
              <BrandSectionBlock
                key={section.id}
                section={section}
                isActiveBrand={activeBrandId === section.id}
                isFlyoutOpen={flyoutBrandId === section.id}
                selectedOptionId={selectedOptionId}
                selectedModelName={
                  activeBrandId === section.id
                    ? (selected?.displayName ?? null)
                    : null
                }
                modelFitsCurrentRefs={modelFitsCurrentRefs}
                onBrandClick={() =>
                  handleBrandClick(
                    section,
                    section.models.length === 1 ? section.models[0] : undefined
                  )
                }
                onCloseFlyout={() => setFlyoutBrandId(null)}
                onSelectModel={handleSelect}
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

function BrandSectionBlock({
  section,
  isActiveBrand,
  isFlyoutOpen,
  selectedOptionId,
  selectedModelName,
  modelFitsCurrentRefs,
  onBrandClick,
  onCloseFlyout,
  onSelectModel,
}: {
  readonly section: ModelBrandSection;
  readonly isActiveBrand: boolean;
  readonly isFlyoutOpen: boolean;
  readonly selectedOptionId: string;
  readonly selectedModelName: string | null;
  readonly modelFitsCurrentRefs: (model: OrgTextModelOption) => boolean;
  readonly onBrandClick: () => void;
  readonly onCloseFlyout: () => void;
  readonly onSelectModel: (model: OrgTextModelOption) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);

  const hasMultipleModels = section.models.length > 1;
  const representativeCanonicalId = section.models[0]?.canonicalId;

  return (
    <div ref={rowRef}>
      <BrandRow
        section={section}
        representativeCanonicalId={representativeCanonicalId}
        isActiveBrand={isActiveBrand}
        isFlyoutOpen={isFlyoutOpen}
        hasMultipleModels={hasMultipleModels}
        selectedModelName={selectedModelName}
        onClick={onBrandClick}
      />

      {isFlyoutOpen && hasMultipleModels ? (
        <BrandModelFlyoutPortal
          anchorRef={rowRef}
          section={section}
          selectedOptionId={selectedOptionId}
          modelFitsCurrentRefs={modelFitsCurrentRefs}
          onSelectModel={onSelectModel}
          onClose={onCloseFlyout}
        />
      ) : null}
    </div>
  );
}

function BrandModelFlyoutPortal({
  anchorRef,
  section,
  selectedOptionId,
  modelFitsCurrentRefs,
  onSelectModel,
  onClose,
}: {
  readonly anchorRef: RefObject<HTMLDivElement | null>;
  readonly section: ModelBrandSection;
  readonly selectedOptionId: string;
  readonly modelFitsCurrentRefs: (model: OrgTextModelOption) => boolean;
  readonly onSelectModel: (model: OrgTextModelOption) => void;
  readonly onClose: () => void;
}) {
  const flyoutRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<BrandFlyoutLayout>({
    top: 0,
    left: 0,
    width: FLYOUT_WIDTH_PX,
    maxHeight: FLYOUT_MAX_HEIGHT_PX,
  });
  const [visible, setVisible] = useState(false);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;

    setLayout(
      resolveBrandFlyoutLayout({
        rowRect: anchor.getBoundingClientRect(),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      })
    );
    setVisible(true);
  }, [anchorRef, section.id]);

  useEffect(() => {
    if (!visible) return;

    const handleReposition = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;

      setLayout(
        resolveBrandFlyoutLayout({
          rowRect: anchor.getBoundingClientRect(),
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
        })
      );
    };

    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [anchorRef, visible]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (flyoutRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;

      const popoverRoot = anchorRef.current?.closest(
        "[data-ai-model-picker-popover]"
      );
      if (popoverRoot?.contains(target)) {
        onClose();
        return;
      }

      onClose();
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [anchorRef, onClose]);

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      ref={flyoutRef}
      className={cn(
        "nodrag nowheel fixed z-[60] rounded-lg border border-border bg-card p-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-800",
        LIST_SCROLL_CLASS
      )}
      style={{
        top: layout.top,
        left: layout.left,
        width: layout.width,
        maxHeight: layout.maxHeight,
        visibility: visible ? "visible" : "hidden",
      }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      {section.models.map((model) => (
        <ModelOptionRow
          key={model.optionId}
          model={model}
          selected={model.optionId === selectedOptionId}
          fitsReferences={modelFitsCurrentRefs(model)}
          onSelect={onSelectModel}
        />
      ))}
    </div>,
    document.body
  );
}

function BrandRow({
  section,
  representativeCanonicalId,
  isActiveBrand,
  isFlyoutOpen,
  hasMultipleModels,
  selectedModelName,
  onClick,
}: {
  readonly section: ModelBrandSection;
  readonly representativeCanonicalId: string | undefined;
  readonly isActiveBrand: boolean;
  readonly isFlyoutOpen: boolean;
  readonly hasMultipleModels: boolean;
  readonly selectedModelName: string | null;
  readonly onClick: () => void;
}) {
  const title = hasMultipleModels
    ? section.name
    : (section.models[0]?.displayName ?? section.name);
  const subtitle = hasMultipleModels
    ? isActiveBrand && selectedModelName
      ? selectedModelName
      : section.description
    : null;

  return (
    <button
      type="button"
      className={cn(
        "flex h-[50px] w-full items-center gap-2 rounded-lg px-2 text-left transition",
        "hover:bg-muted/30 dark:hover:bg-neutral-700/40",
        isActiveBrand && "bg-muted/30 dark:bg-neutral-700/40",
        isFlyoutOpen && "bg-muted/40 dark:bg-neutral-700/50"
      )}
      onClick={onClick}
    >
      <span className="flex size-[34px] shrink-0 items-center justify-center rounded-lg bg-muted dark:bg-neutral-700">
        <ModelBrandIcon
          groupId={section.id === UNGROUPED_SECTION_ID ? null : section.id}
          icon={section.icon}
          canonicalId={representativeCanonicalId}
          className="size-4 bg-transparent"
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium leading-5 text-foreground">
          {title}
        </span>
        {subtitle ? (
          <span className="block truncate text-xs leading-4 text-muted-foreground">
            {subtitle}
          </span>
        ) : null}
      </span>
      {isActiveBrand ? (
        <CheckIcon className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
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
        available
          ? "hover:bg-muted/30 dark:hover:bg-neutral-700/40"
          : "opacity-50",
        selected && "bg-muted/30 dark:bg-neutral-700/40"
      )}
      onClick={() => onSelect(model)}
    >
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
        {model.displayName}
        {suffix}
      </span>
    </button>
  );
}
