import {
  applyVideoPricePromoFold,
  computeCostPerOutputSecond,
  computeSplitVideoPriceEstimateForModel,
  computeVideoPriceEstimateForModel,
  DEFAULT_HOMEPAGE_VIDEO_SCENARIOS,
  formatVideoPricePromoFold,
  formatVideoTokenMillions,
  type HomepageVideoScenario,
  isVideoPriceCompareCompetitor,
  isVideoPricePromoFold,
  isVideoPricePromoFoldDraft,
  LANDING_VIDEO_PRICE_MODEL_ID,
  matchVideoModelPricePromo,
  normalizeVideoPricePromoFold,
  planVideoEstimateClips,
  readVideoPriceEstimateTier,
  VIDEO_DURATION_MAX,
  VIDEO_RATIO_OPTIONS,
} from "@dafthunk/types";
import ArrowRight from "lucide-react/icons/arrow-right";
import ArrowUp from "lucide-react/icons/arrow-up";
import ChevronDown from "lucide-react/icons/chevron-down";
import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  applyScenarioPreset,
  buildLandingPromoGroups,
  LANDING_COMPARE_COMPETITOR_CELL_CLASS,
  LANDING_COMPARE_COMPETITOR_ROW_CLASS,
  LANDING_TIME_MAX_SEC,
  type LandingBillingTimeUnit,
  LandingComparePlanTableHeader,
  LandingCompetitorCompareRow,
  ReferenceClipControl,
  TimeAmountControl,
} from "@/components/landing-billing-section";
import { LandingCanvasGenerateDemo } from "@/components/landing-canvas-generate-demo";
import {
  formatLandingParamDuration,
  formatLandingParamReferenceSummary,
  LANDING_PARAM_CHIP_CLASS,
  LANDING_PARAM_TRIGGER_CLASS,
  LandingMenuOptionButton,
  LandingMenuPopover,
  LandingSelectPopover,
  landingMenuContentClass,
} from "@/components/landing-select-menu";
import { useTranslation } from "@/components/locale-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import {
  HINT_TOOLTIP_CONTENT_CLASS,
  HoverClickHint,
} from "@/pages/organization-ai-interfaces/dashed-hint-popover";
import { usePublicVideoPriceEstimates } from "@/services/video-price-estimates-service";
import { contentFitScale } from "@/utils/logo-fit-scale";
import { cn } from "@/utils/utils";

const LANDING_BORDER = "border-[#e2ded4] dark:border-[#35363e]";
const REAPI_BRAND_INK = "text-[#4a55cf]";
const CLIP_SCENARIO_ID = "clip";

type BillingRatio = Exclude<(typeof VIDEO_RATIO_OPTIONS)[number], "adaptive">;
const BILLING_RATIOS: readonly BillingRatio[] = VIDEO_RATIO_OPTIONS.filter(
  (ratio): ratio is BillingRatio => ratio !== "adaptive"
);
const LANDING_DEFAULT_RATIO = "16:9" as const;
const LANDING_DEFAULT_RESOLUTION = "720p";
const LANDING_DEFAULT_DURATION_SEC = 15;
const LANDING_PROMO_CHECKBOX_CLASS =
  "landing-promo-checkbox size-2.5 shrink-0 rounded-[2px] border border-foreground/35 bg-transparent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#5b66de]/30";
const LANDING_POPOVER_TITLE_CLASS =
  "mb-2 block w-full text-xs font-medium text-foreground";
const YEAR_CONTRACT_FOLD_INPUT_CLASS = cn(
  "h-7 w-16 rounded-md bg-muted/45 px-1.5 py-0.5 text-center text-xs outline-none transition-colors",
  "focus:bg-muted/65",
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
);
const YEAR_CONTRACT_FOLD_MARK_CLASS =
  "ml-0.5 text-[10px] leading-none text-muted-foreground";
const FEATURED_PARAM_TRIGGER_CLASS = cn(
  LANDING_PARAM_TRIGGER_CLASS,
  LANDING_PARAM_CHIP_CLASS
);

function LandingCompareTableScale({
  children,
}: {
  readonly children: ReactNode;
}) {
  const slotRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const slot = slotRef.current;
    const inner = innerRef.current;
    if (!slot || !inner) {
      return;
    }

    const update = (): void => {
      if (window.matchMedia("(min-width: 768px)").matches) {
        inner.style.zoom = "";
        return;
      }
      if (slot.clientWidth <= 0 || slot.clientHeight <= 0) {
        inner.style.zoom = "";
        return;
      }
      const table = inner.querySelector("table");
      const applied = inner.style.zoom;
      inner.style.zoom = "";
      const natural = Math.max(table?.offsetWidth ?? 0, inner.offsetWidth);
      if (natural <= 0) {
        inner.style.zoom = "";
        return;
      }
      const next =
        Math.round(contentFitScale(slot.clientWidth, natural) * 1000) / 1000;
      const nextZoom = next === 1 ? "" : String(next);
      if (nextZoom === applied) {
        inner.style.zoom = applied;
        return;
      }
      inner.style.zoom = nextZoom;
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(slot);
    observer.observe(inner);
    const observedTables = new Set<Element>();
    const observeTable = (): void => {
      const table = inner.querySelector("table");
      if (!table || observedTables.has(table)) {
        return;
      }
      observedTables.add(table);
      observer.observe(table);
    };
    observeTable();
    const mutations = new MutationObserver(() => {
      observeTable();
      update();
    });
    mutations.observe(inner, { childList: true, subtree: true });
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      mutations.disconnect();
      window.removeEventListener("resize", update);
      inner.style.zoom = "";
    };
  }, []);

  return (
    <div ref={slotRef} className="min-h-0 min-w-0 overflow-hidden md:flex-1">
      <div
        ref={innerRef}
        className="w-max min-w-max origin-top-left md:w-full md:min-w-0"
      >
        {children}
      </div>
    </div>
  );
}

function parseYearContractFoldDraft(raw: string): number | null {
  if (raw.trim() === "") {
    return null;
  }
  const value = Number(raw);
  if (!isVideoPricePromoFold(value)) {
    return null;
  }
  return normalizeVideoPricePromoFold(value);
}

function applyYearContractFold(costYuan: number, fold: number | null): number {
  if (fold == null) {
    return costYuan;
  }
  return applyVideoPricePromoFold(costYuan, fold);
}

function formatScenarioTabIndex(index: number): string {
  return String(index + 1).padStart(2, "0");
}

function allScenarioTabsFitIndex(grid: HTMLElement): boolean {
  const tabs = grid.querySelectorAll<HTMLElement>("[data-scenario-tab]");
  if (tabs.length === 0) {
    return true;
  }

  return Array.from(tabs).every((tab) => {
    const indexEl = tab.querySelector<HTMLElement>("[data-tab-index]");
    const nameEl = tab.querySelector<HTMLElement>("[data-tab-name]");
    const arrowEl = tab.querySelector<HTMLElement>("[data-tab-arrow]");
    const labelEl = tab.querySelector<HTMLElement>("[data-tab-label]");
    if (!indexEl || !nameEl) {
      return true;
    }

    const tabStyle = getComputedStyle(tab);
    const paddingX =
      Number.parseFloat(tabStyle.paddingLeft) +
      Number.parseFloat(tabStyle.paddingRight);
    const tabGap = Number.parseFloat(tabStyle.columnGap) || 0;
    const labelGap = labelEl
      ? Number.parseFloat(getComputedStyle(labelEl).columnGap) || 0
      : 0;
    const available =
      tab.clientWidth - paddingX - tabGap - (arrowEl?.offsetWidth ?? 0);
    const needed = indexEl.scrollWidth + labelGap + nameEl.scrollWidth;
    return needed <= available;
  });
}

function createScenarioSetters(state: {
  readonly setScenarioId: (id: string) => void;
  readonly setCanonicalId: (id: string) => void;
  readonly setRatio: (ratio: BillingRatio) => void;
  readonly setResolution: (resolution: string) => void;
  readonly setDurationSec: (seconds: number) => void;
  readonly setDurationUnit: (unit: LandingBillingTimeUnit) => void;
  readonly setReferencedClipCount: (count: number) => void;
  readonly setAvgReferenceSec: (seconds: number) => void;
  readonly setReferenceSec: (seconds: number) => void;
  readonly setReferenceClipOpen: (open: boolean) => void;
}) {
  return state;
}

function OfficialPaidPriceCell(props: {
  readonly costYuan: number | null;
  readonly unavailableLabel: string;
  readonly title: string;
  readonly foldUnit: string;
  readonly foldLabel: string | null;
  readonly draft: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onDraftChange: (raw: string) => void;
}) {
  if (props.costYuan == null) {
    return props.unavailableLabel;
  }

  return (
    <span className="inline-flex items-center gap-x-0.5">
      <span>{props.costYuan.toFixed(2)}</span>
      {props.foldLabel ? (
        <sup className={YEAR_CONTRACT_FOLD_MARK_CLASS}>{props.foldLabel}</sup>
      ) : null}
      <LandingMenuPopover
        open={props.open}
        onOpenChange={props.onOpenChange}
        contentClassName="p-2.5"
        trigger={
          <button
            type="button"
            aria-label={props.title}
            className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-[#f0ede6] hover:text-foreground dark:hover:bg-neutral-800"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        }
      >
        <p className={LANDING_POPOVER_TITLE_CLASS}>{props.title}</p>
        <div className="flex items-center gap-1">
          <Input
            id="landing_year_contract_fold"
            name="landing_year_contract_fold"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            autoFocus
            value={props.draft}
            className={YEAR_CONTRACT_FOLD_INPUT_CLASS}
            onChange={(event) => {
              props.onDraftChange(event.target.value);
            }}
          />
          <span className="text-xs text-muted-foreground">
            {props.foldUnit}
          </span>
        </div>
      </LandingMenuPopover>
    </span>
  );
}

function ShowcaseScenarioTab(props: {
  readonly index: number;
  readonly name: string;
  readonly active: boolean;
  readonly showIndex: boolean;
  readonly onSelect: () => void;
}) {
  return (
    <button
      type="button"
      data-scenario-tab=""
      className={cn(
        "landing-featured-tab group relative flex min-w-0 flex-1 items-center justify-between gap-2 bg-[#f7f5f1] px-3 py-3.5 text-left font-mono text-xs text-foreground/80 transition-colors duration-300 hover:bg-[#f0ede6] hover:text-foreground dark:bg-neutral-900 dark:hover:bg-neutral-800",
        LANDING_BORDER,
        "border-r border-b",
        props.active && "bg-[#f0ede6] text-foreground dark:bg-neutral-800"
      )}
      onClick={props.onSelect}
    >
      <span data-tab-label="" className="flex min-w-0 items-center gap-2.5">
        <span
          data-tab-index=""
          aria-hidden
          className={cn(
            "landing-featured-tab-index shrink-0",
            props.showIndex
              ? REAPI_BRAND_INK
              : "pointer-events-none absolute opacity-0"
          )}
        >
          [{formatScenarioTabIndex(props.index)}]
        </span>
        <span data-tab-name="" className="truncate">
          {props.name}
        </span>
      </span>
      <span data-tab-arrow="" className="shrink-0">
        <ArrowRight className="size-3 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </span>
    </button>
  );
}

function ShowcaseScenarioTabList(props: {
  readonly scenarios: readonly HomepageVideoScenario[];
  readonly activeId: string;
  readonly onSelect: (scenario: HomepageVideoScenario) => void;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [showIndex, setShowIndex] = useState(true);

  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) {
      return;
    }

    const update = (): void => {
      const next = allScenarioTabsFitIndex(grid);
      setShowIndex((prev) => (prev === next ? prev : next));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [props.scenarios]);

  return (
    <div
      ref={gridRef}
      className={cn(
        "grid grid-cols-3 border-t border-l md:grid-cols-6",
        LANDING_BORDER
      )}
    >
      {props.scenarios.map((scenario, index) => (
        <ShowcaseScenarioTab
          key={scenario.id}
          index={index}
          name={scenario.name}
          active={scenario.id === props.activeId}
          showIndex={showIndex}
          onSelect={() => props.onSelect(scenario)}
        />
      ))}
    </div>
  );
}

export function LandingHeroFeaturedPricing() {
  const { t } = useTranslation();
  const {
    models,
    competitors,
    scenarios: loadedScenarios,
    isEstimatesLoading,
  } = usePublicVideoPriceEstimates();

  const allScenarios = useMemo(
    () =>
      loadedScenarios.length > 0
        ? [...loadedScenarios].sort(
            (left, right) => left.sortOrder - right.sortOrder
          )
        : DEFAULT_HOMEPAGE_VIDEO_SCENARIOS,
    [loadedScenarios]
  );
  const featuredScenarios = useMemo(
    () => allScenarios.filter((scenario) => scenario.id !== CLIP_SCENARIO_ID),
    [allScenarios]
  );

  const [canonicalId, setCanonicalId] = useState(LANDING_VIDEO_PRICE_MODEL_ID);
  const [resolution, setResolution] = useState(LANDING_DEFAULT_RESOLUTION);
  const [ratio, setRatio] = useState<BillingRatio>(LANDING_DEFAULT_RATIO);
  const [durationSec, setDurationSec] = useState(LANDING_DEFAULT_DURATION_SEC);
  const [durationUnit, setDurationUnit] =
    useState<LandingBillingTimeUnit>("sec");
  const [referencedClipCount, setReferencedClipCount] = useState(0);
  const [avgReferenceSec, setAvgReferenceSec] = useState(0);
  const [referenceSec, setReferenceSec] = useState(0);
  const [referenceUnit, setReferenceUnit] =
    useState<LandingBillingTimeUnit>("sec");
  const [scenarioId, setScenarioId] = useState<string>(CLIP_SCENARIO_ID);
  const [ratioOpen, setRatioOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [resolutionOpen, setResolutionOpen] = useState(false);
  const [durationOpen, setDurationOpen] = useState(false);
  const [referenceOpen, setReferenceOpen] = useState(false);
  const [referenceClipOpen, setReferenceClipOpen] = useState(false);
  const [excludePromo, setExcludePromo] = useState(false);
  const [yearContractFold, setYearContractFold] = useState<number | null>(null);
  const [yearContractFoldDraft, setYearContractFoldDraft] = useState("");
  const [yearContractOpen, setYearContractOpen] = useState(false);
  const [showParamHint, setShowParamHint] = useState(true);
  const [pendingExternal, setPendingExternal] = useState<{
    name: string;
    url: string;
  } | null>(null);
  const appliedInitialPresetRef = useRef(false);

  const scenarioSetters = useMemo(
    () =>
      createScenarioSetters({
        setScenarioId,
        setCanonicalId,
        setRatio,
        setResolution,
        setDurationSec,
        setDurationUnit,
        setReferencedClipCount,
        setAvgReferenceSec,
        setReferenceSec,
        setReferenceClipOpen,
      }),
    []
  );

  const model =
    models.find((entry) => entry.canonicalId === canonicalId) ??
    models.find(
      (entry) => entry.canonicalId === LANDING_VIDEO_PRICE_MODEL_ID
    ) ??
    models[0];
  const resolutions = model?.tiers.map((tier) => tier.resolution) ?? [];
  const selectedScenario =
    allScenarios.find((entry) => entry.id === scenarioId) ??
    allScenarios.find((entry) => entry.id === CLIP_SCENARIO_ID) ??
    null;
  const isSingleClipScenario = scenarioId === CLIP_SCENARIO_ID;

  useEffect(() => {
    if (allScenarios.length === 0 || appliedInitialPresetRef.current) {
      return;
    }
    const clip =
      allScenarios.find((entry) => entry.id === CLIP_SCENARIO_ID) ??
      allScenarios[0];
    if (!clip) {
      return;
    }
    applyScenarioPreset(clip, scenarioSetters);
    appliedInitialPresetRef.current = true;
  }, [allScenarios, scenarioSetters]);

  useEffect(() => {
    if (allScenarios.length === 0) {
      return;
    }
    if (allScenarios.some((entry) => entry.id === scenarioId)) {
      return;
    }
    const clip =
      allScenarios.find((entry) => entry.id === CLIP_SCENARIO_ID) ??
      allScenarios[0];
    if (!clip) {
      return;
    }
    applyScenarioPreset(clip, scenarioSetters);
  }, [allScenarios, scenarioId, scenarioSetters]);

  const activeResolution =
    resolution && resolutions.includes(resolution)
      ? resolution
      : resolutions.includes(LANDING_DEFAULT_RESOLUTION)
        ? LANDING_DEFAULT_RESOLUTION
        : (resolutions[0] ?? "");

  const handleSelectScenario = (scenario: HomepageVideoScenario) => {
    applyScenarioPreset(scenario, scenarioSetters);
    setShowParamHint(false);
  };

  const hideParamHintOnButton = (event: {
    readonly target: EventTarget | null;
  }) => {
    if (event.target instanceof Element && event.target.closest("button")) {
      setShowParamHint(false);
    }
  };

  const clipPlan = useMemo(
    () =>
      planVideoEstimateClips({
        totalDurationSec: durationSec,
        maxOutputDurationSec: model?.maxOutputDurationSec ?? VIDEO_DURATION_MAX,
      }),
    [durationSec, model?.maxOutputDurationSec]
  );
  const usedReferencedCount = Math.min(
    Math.max(0, referencedClipCount),
    clipPlan.clipCount
  );
  const usedAvgReferenceSec = Math.min(
    Math.max(0, avgReferenceSec),
    model?.maxVideoReferenceSeconds ?? avgReferenceSec
  );

  const estimate = useMemo(() => {
    if (!model || !activeResolution) {
      return null;
    }
    const tier = readVideoPriceEstimateTier(
      {
        priceEstimate: {
          enabled: true,
          tiers: model.tiers.map((entry) => ({ ...entry, enabled: true })),
        },
      },
      activeResolution
    );
    if (!tier) {
      return null;
    }
    if (isSingleClipScenario) {
      const hasReferenceVideo = referenceSec > 0;
      return computeVideoPriceEstimateForModel({
        canonicalId: model.canonicalId,
        resolution: activeResolution,
        ratio,
        outputDurationSec: durationSec,
        inputDurationSec: hasReferenceVideo ? referenceSec : 0,
        hasReferenceVideo,
        priceWithoutVideo: tier.priceWithoutVideo,
        priceWithVideo: tier.priceWithVideo,
      });
    }
    return computeSplitVideoPriceEstimateForModel({
      canonicalId: model.canonicalId,
      resolution: activeResolution,
      ratio,
      priceWithoutVideo: tier.priceWithoutVideo,
      priceWithVideo: tier.priceWithVideo,
      plan: clipPlan,
      referencedCount: usedReferencedCount,
      avgReferenceSec: usedAvgReferenceSec,
    });
  }, [
    activeResolution,
    clipPlan,
    durationSec,
    isSingleClipScenario,
    model,
    ratio,
    referenceSec,
    usedAvgReferenceSec,
    usedReferencedCount,
  ]);

  const platformPromo = useMemo(() => {
    if (!model || !activeResolution) {
      return null;
    }
    return matchVideoModelPricePromo(model.promos ?? [], activeResolution);
  }, [activeResolution, model]);

  const hasCompetitorPromo = useMemo(() => {
    if (!model || !activeResolution) {
      return false;
    }
    return competitors.some((competitor) =>
      isVideoPriceCompareCompetitor(competitor)
    );
  }, [activeResolution, competitors, model]);

  const promoGroups = useMemo(
    () => buildLandingPromoGroups(models, competitors, t),
    [competitors, models, t]
  );
  const compareCompetitors = useMemo(
    () => competitors.filter(isVideoPriceCompareCompetitor),
    [competitors]
  );
  const showPromoControls =
    promoGroups.length > 0 && (platformPromo != null || hasCompetitorPromo);

  const handleScrollToLandingPromo = () => {
    document
      .getElementById("landing-promo")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const billedCostYuan =
    estimate == null
      ? null
      : !excludePromo && platformPromo
        ? applyVideoPricePromoFold(
            estimate.costYuan,
            platformPromo.discountFold
          )
        : estimate.costYuan;
  const officialCostYuan =
    billedCostYuan == null
      ? null
      : applyYearContractFold(billedCostYuan, yearContractFold);
  const officialTokens =
    estimate == null
      ? null
      : !excludePromo && platformPromo
        ? Math.round(
            applyVideoPricePromoFold(
              estimate.billingTokens,
              platformPromo.discountFold
            )
          )
        : estimate.billingTokens;
  const officialRate =
    officialCostYuan == null || estimate == null
      ? null
      : computeCostPerOutputSecond(
          officialCostYuan,
          estimate.outputDurationSec
        );

  const promoFoldLabel = (fold: number): string =>
    t("landing.promoFoldHint", { fold: formatVideoPricePromoFold(fold) });

  const durationLabel = formatLandingParamDuration(durationSec);

  const referenceLabel = isSingleClipScenario
    ? formatLandingParamDuration(referenceSec)
    : formatLandingParamReferenceSummary(
        usedReferencedCount,
        usedAvgReferenceSec
      );

  return (
    <>
      <div
        id="landing-demo"
        className={cn(
          "landing-featured mx-auto mt-10 flex min-h-0 min-w-0 w-full max-w-4xl flex-col overflow-hidden border bg-[#f7f5f1] text-left dark:bg-neutral-900 md:h-[350px]",
          LANDING_BORDER
        )}
        onClickCapture={hideParamHintOnButton}
      >
        <div
          className={cn(
            "landing-featured-bar flex items-center justify-between gap-3 border-b",
            LANDING_BORDER
          )}
        >
          <span aria-hidden className="landing-featured-bar-mark">
            ||
          </span>
          <span className="landing-featured-bar-title truncate">
            {t("landing.heroTitle")}
          </span>
          <span aria-hidden className="landing-featured-bar-mark">
            [×]
          </span>
        </div>

        <div className="grid min-h-0 min-w-0 flex-1 md:grid-cols-[2fr_3fr]">
          <div className="flex h-full min-h-0 min-w-0 flex-col items-start gap-4 p-6 lg:p-8">
            <div className="flex w-full items-baseline justify-between gap-3">
              <span className="landing-featured-title font-mono font-bold text-foreground">
                {selectedScenario?.name ?? t("common.loading")}
              </span>
              <HoverClickHint
                align="end"
                side="bottom"
                content={
                  <>
                    <span className="block">
                      {t("landing.compareFeedback")}
                    </span>
                    <span className="block">
                      {t("landing.compareFeedbackQq")}
                    </span>
                  </>
                }
                contentClassName={HINT_TOOLTIP_CONTENT_CLASS}
              >
                <button
                  type="button"
                  className="inline-flex shrink-0 items-baseline gap-0 p-0 font-mono text-[12.5px] text-foreground/65"
                >
                  <span className="border-b border-dashed border-muted-foreground">
                    {t("landing.priceEstimateHint")}
                  </span>
                  <span aria-hidden>{" ->"}</span>
                </button>
              </HoverClickHint>
            </div>

            <p className="text-sm leading-6 text-muted-foreground">
              {selectedScenario?.description ?? ""}
            </p>

            {isEstimatesLoading || !model || resolutions.length === 0 ? (
              <p className="font-mono text-xs text-muted-foreground">
                {isEstimatesLoading
                  ? t("common.loading")
                  : t("landing.noPrice")}
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                <LandingSelectPopover
                  label={model.displayName}
                  open={modelOpen}
                  onOpenChange={setModelOpen}
                  triggerClassName={FEATURED_PARAM_TRIGGER_CLASS}
                  contentClassName="min-w-52"
                >
                  {models.map((entry) => (
                    <LandingMenuOptionButton
                      key={entry.canonicalId}
                      active={entry.canonicalId === model.canonicalId}
                      onSelect={() => {
                        setCanonicalId(entry.canonicalId);
                        setModelOpen(false);
                      }}
                    >
                      {entry.displayName}
                    </LandingMenuOptionButton>
                  ))}
                </LandingSelectPopover>

                <LandingSelectPopover
                  label={ratio}
                  open={ratioOpen}
                  onOpenChange={setRatioOpen}
                  triggerClassName={FEATURED_PARAM_TRIGGER_CLASS}
                >
                  {BILLING_RATIOS.map((option) => (
                    <LandingMenuOptionButton
                      key={option}
                      active={option === ratio}
                      onSelect={() => {
                        setRatio(option);
                        setRatioOpen(false);
                      }}
                    >
                      {option}
                    </LandingMenuOptionButton>
                  ))}
                </LandingSelectPopover>

                <LandingSelectPopover
                  label={activeResolution.toUpperCase()}
                  open={resolutionOpen}
                  onOpenChange={setResolutionOpen}
                  triggerClassName={FEATURED_PARAM_TRIGGER_CLASS}
                >
                  {resolutions.map((option) => (
                    <LandingMenuOptionButton
                      key={option}
                      active={option === activeResolution}
                      onSelect={() => {
                        setResolution(option);
                        setResolutionOpen(false);
                      }}
                    >
                      {option.toUpperCase()}
                    </LandingMenuOptionButton>
                  ))}
                </LandingSelectPopover>

                <LandingMenuPopover
                  open={durationOpen}
                  onOpenChange={setDurationOpen}
                  contentClassName="p-2.5"
                  trigger={
                    <button
                      type="button"
                      className={FEATURED_PARAM_TRIGGER_CLASS}
                    >
                      {durationLabel}
                    </button>
                  }
                >
                  <p className={LANDING_POPOVER_TITLE_CLASS}>
                    {t("landing.durationLabel")}
                  </p>
                  <TimeAmountControl
                    hideTitle
                    seconds={durationSec}
                    unit={durationUnit}
                    minSeconds={1}
                    maxSeconds={LANDING_TIME_MAX_SEC}
                    unitSecLabel={t("landing.durationUnitSec")}
                    unitMinLabel={t("landing.durationUnitMin")}
                    onSecondsChange={setDurationSec}
                    onUnitChange={setDurationUnit}
                  />
                </LandingMenuPopover>

                {isSingleClipScenario ? (
                  <LandingMenuPopover
                    open={referenceOpen}
                    onOpenChange={setReferenceOpen}
                    contentClassName="p-2.5"
                    trigger={
                      <button
                        type="button"
                        className={FEATURED_PARAM_TRIGGER_CLASS}
                      >
                        {referenceLabel}
                      </button>
                    }
                  >
                    <p className={LANDING_POPOVER_TITLE_CLASS}>
                      {t("landing.referenceVideoDurationLabel")}
                    </p>
                    <TimeAmountControl
                      hideTitle
                      seconds={referenceSec}
                      unit={referenceUnit}
                      minSeconds={0}
                      maxSeconds={LANDING_TIME_MAX_SEC}
                      unitSecLabel={t("landing.durationUnitSec")}
                      unitMinLabel={t("landing.durationUnitMin")}
                      onSecondsChange={setReferenceSec}
                      onUnitChange={setReferenceUnit}
                    />
                  </LandingMenuPopover>
                ) : (
                  <ReferenceClipControl
                    variant="chip"
                    modal={false}
                    hideChevron
                    popoverTitle={t("landing.referenceVideoDurationLabel")}
                    triggerLabel={formatLandingParamReferenceSummary(
                      usedReferencedCount,
                      usedAvgReferenceSec
                    )}
                    contentClassName={landingMenuContentClass("min-w-56 p-2.5")}
                    triggerClassName={FEATURED_PARAM_TRIGGER_CLASS}
                    clipCount={clipPlan.clipCount}
                    clipDurationSec={clipPlan.clipDurationSec}
                    referencedCount={usedReferencedCount}
                    avgReferenceSec={usedAvgReferenceSec}
                    maxAvgReferenceSec={
                      model.maxVideoReferenceSeconds ?? usedAvgReferenceSec
                    }
                    open={referenceClipOpen}
                    onOpenChange={setReferenceClipOpen}
                    onReferencedCountChange={setReferencedClipCount}
                    onAvgReferenceSecChange={setAvgReferenceSec}
                  />
                )}
              </div>
            )}

            {showParamHint ? (
              <p className="landing-param-hint-shake mt-auto flex flex-col items-center gap-0.5 self-center font-mono text-sm text-muted-foreground">
                <ArrowUp aria-hidden className="size-4" strokeWidth={2} />
                <span>{t("landing.paramAdjustHint")}</span>
              </p>
            ) : null}
          </div>

          <div
            className={cn(
              "flex h-full min-h-0 min-w-0 flex-col border-t p-3 md:border-t-0 md:border-l md:p-4",
              LANDING_BORDER
            )}
          >
            <LandingCompareTableScale>
              <table className="w-max min-w-max table-auto text-left text-sm md:w-full md:min-w-0">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="px-2 py-2 font-medium whitespace-nowrap">
                      {t("landing.tablePlatform")}
                    </th>
                    <th className="px-2 py-2 font-medium whitespace-nowrap">
                      <LandingComparePlanTableHeader />
                    </th>
                    <th className="px-2 py-2 font-medium whitespace-nowrap">
                      {t("landing.tableTokens")}
                    </th>
                    <th className="px-2 py-2 font-medium whitespace-nowrap">
                      {t("landing.tableRate")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    className={cn(
                      "border-b",
                      LANDING_COMPARE_COMPETITOR_ROW_CLASS
                    )}
                  >
                    <td
                      className={cn(
                        LANDING_COMPARE_COMPETITOR_CELL_CLASS,
                        "font-medium"
                      )}
                    >
                      {t("landing.platformOfficial")}
                    </td>
                    <td className={LANDING_COMPARE_COMPETITOR_CELL_CLASS}>
                      <OfficialPaidPriceCell
                        costYuan={officialCostYuan}
                        unavailableLabel={t("landing.compareUnavailable")}
                        title={t("landing.yearContractDiscount")}
                        foldUnit={t("landing.yearContractFoldUnit")}
                        foldLabel={
                          yearContractFold == null
                            ? null
                            : promoFoldLabel(yearContractFold)
                        }
                        draft={yearContractFoldDraft}
                        open={yearContractOpen}
                        onOpenChange={(open) => {
                          setYearContractOpen(open);
                          if (!open) {
                            setYearContractFoldDraft(
                              yearContractFold == null
                                ? ""
                                : formatVideoPricePromoFold(yearContractFold)
                            );
                          }
                        }}
                        onDraftChange={(raw) => {
                          if (!isVideoPricePromoFoldDraft(raw)) {
                            return;
                          }
                          setYearContractFoldDraft(raw);
                          setYearContractFold(parseYearContractFoldDraft(raw));
                        }}
                      />
                    </td>
                    <td className={LANDING_COMPARE_COMPETITOR_CELL_CLASS}>
                      {officialTokens == null ? (
                        t("landing.compareUnavailable")
                      ) : (
                        <span>
                          {formatVideoTokenMillions(officialTokens)}
                          {!excludePromo && platformPromo ? (
                            <sup className={YEAR_CONTRACT_FOLD_MARK_CLASS}>
                              {promoFoldLabel(platformPromo.discountFold)}
                            </sup>
                          ) : null}
                        </span>
                      )}
                    </td>
                    <td className={LANDING_COMPARE_COMPETITOR_CELL_CLASS}>
                      {officialRate == null
                        ? t("landing.compareUnavailable")
                        : t("landing.rateValue", {
                            rate: officialRate.toFixed(3),
                          })}
                    </td>
                  </tr>
                  {compareCompetitors.map((competitor, index, rows) => (
                    <LandingCompetitorCompareRow
                      key={competitor.id}
                      competitor={competitor}
                      bordered={index < rows.length - 1}
                      model={model}
                      activeResolution={activeResolution}
                      isSingleClipScenario={isSingleClipScenario}
                      durationSec={durationSec}
                      referenceSec={referenceSec}
                      clipPlan={clipPlan}
                      usedReferencedCount={usedReferencedCount}
                      usedAvgReferenceSec={usedAvgReferenceSec}
                      excludePromo={excludePromo}
                      promoFoldLabel={promoFoldLabel}
                      onOpenExternal={setPendingExternal}
                      useLandingMenu
                    />
                  ))}
                </tbody>
              </table>
            </LandingCompareTableScale>
            {showPromoControls ? (
              <p className="shrink-0 pt-2 text-[11px] leading-[11px] text-muted-foreground">
                <span>{t("landing.featuredPromoHintPrefix")}</span>
                <button
                  type="button"
                  className="inline align-baseline border-0 bg-transparent p-0 font-[inherit] text-[inherit] leading-[inherit] underline decoration-dashed decoration-muted-foreground underline-offset-[2px] text-foreground/80 hover:text-foreground"
                  onClick={handleScrollToLandingPromo}
                >
                  {t("landing.featuredPromoLink")}
                </button>
                <span className="mx-0.5">
                  {t("landing.featuredPromoHintCan")}
                </span>
                <label className="mx-0.5 cursor-pointer whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={excludePromo}
                    onChange={(event) => {
                      setExcludePromo(event.target.checked);
                    }}
                    className={cn(
                      LANDING_PROMO_CHECKBOX_CLASS,
                      "mr-0.5 align-text-bottom"
                    )}
                  />
                  {t("landing.tableExcludePromo")}
                </label>
                <span>{t("landing.featuredPromoHintSuffix")}</span>
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div
        className="landing-featured mx-auto mt-4 w-full max-w-4xl"
        onClickCapture={hideParamHintOnButton}
      >
        <ShowcaseScenarioTabList
          scenarios={featuredScenarios}
          activeId={scenarioId}
          onSelect={handleSelectScenario}
        />
      </div>

      <LandingCanvasGenerateDemo />

      {pendingExternal ? (
        <AlertDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setPendingExternal(null);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t("landing.externalLinkTitle")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t("landing.externalLinkBody", {
                  name: pendingExternal.name,
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  window.open(
                    pendingExternal.url,
                    "_blank",
                    "noopener,noreferrer"
                  );
                }}
              >
                {t("landing.externalLinkContinue")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </>
  );
}
