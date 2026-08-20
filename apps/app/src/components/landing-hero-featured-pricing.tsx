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
import { useEffect, useMemo, useRef, useState } from "react";

import {
  applyScenarioPreset,
  buildLandingPromoGroups,
  LandingCompetitorCompareRow,
  LandingComparePlanTableHeader,
  LANDING_COMPARE_COMPETITOR_CELL_CLASS,
  LANDING_COMPARE_COMPETITOR_ROW_CLASS,
  LANDING_TIME_MAX_SEC,
  ReferenceClipControl,
  TimeAmountControl,
  type LandingBillingTimeUnit,
} from "@/components/landing-billing-section";
import { LandingCanvasGenerateDemo } from "@/components/landing-canvas-generate-demo";
import {
  LandingMenuOptionButton,
  LandingMenuPopover,
  LandingSelectPopover,
  formatLandingParamDuration,
  formatLandingParamReferenceSummary,
  LANDING_PARAM_CHIP_CLASS,
  LANDING_PARAM_TRIGGER_CLASS,
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePublicVideoPriceEstimates } from "@/services/video-price-estimates-service";
import { cn } from "@/utils/utils";

const LANDING_BORDER = "border-[#e2ded4] dark:border-[#35363e]";
const REAPI_BRAND_INK = "text-[#4a55cf]";
const CLIP_SCENARIO_ID = "clip";

type BillingRatio = Exclude<(typeof VIDEO_RATIO_OPTIONS)[number], "adaptive">;
const BILLING_RATIOS: readonly BillingRatio[] = VIDEO_RATIO_OPTIONS.filter(
  (ratio): ratio is BillingRatio => ratio !== "adaptive",
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
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
);
const YEAR_CONTRACT_FOLD_MARK_CLASS =
  "ml-0.5 text-[10px] leading-none text-muted-foreground";
const FEATURED_PARAM_TRIGGER_CLASS = cn(
  LANDING_PARAM_TRIGGER_CLASS,
  LANDING_PARAM_CHIP_CLASS,
);

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
          <span className="text-xs text-muted-foreground">{props.foldUnit}</span>
        </div>
      </LandingMenuPopover>
    </span>
  );
}

function ShowcaseScenarioTab(props: {
  readonly index: number;
  readonly name: string;
  readonly active: boolean;
  readonly onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "landing-featured-tab group flex min-w-0 flex-1 items-center justify-between gap-2 bg-[#f7f5f1] px-3 py-3.5 text-left font-mono text-xs text-foreground/80 transition-colors duration-300 hover:bg-[#f0ede6] hover:text-foreground dark:bg-neutral-900 dark:hover:bg-neutral-800",
        LANDING_BORDER,
        "border-r border-b",
        props.active && "bg-[#f0ede6] text-foreground dark:bg-neutral-800",
      )}
      onClick={props.onSelect}
    >
      <span className="flex items-center gap-2.5">
        <span aria-hidden className={cn("landing-featured-tab-index", REAPI_BRAND_INK)}>
          [{formatScenarioTabIndex(props.index)}]
        </span>
        <span className="truncate">{props.name}</span>
      </span>
      <ArrowRight className="size-3 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

export function LandingHeroFeaturedPricing() {
  const { t } = useTranslation();
  const { models, competitors, scenarios: loadedScenarios, isEstimatesLoading } =
    usePublicVideoPriceEstimates();

  const allScenarios = useMemo(
    () =>
      loadedScenarios.length > 0
        ? [...loadedScenarios].sort((left, right) => left.sortOrder - right.sortOrder)
        : DEFAULT_HOMEPAGE_VIDEO_SCENARIOS,
    [loadedScenarios],
  );
  const featuredScenarios = useMemo(
    () => allScenarios.filter((scenario) => scenario.id !== CLIP_SCENARIO_ID),
    [allScenarios],
  );

  const [canonicalId, setCanonicalId] = useState(LANDING_VIDEO_PRICE_MODEL_ID);
  const [resolution, setResolution] = useState(LANDING_DEFAULT_RESOLUTION);
  const [ratio, setRatio] = useState<BillingRatio>(LANDING_DEFAULT_RATIO);
  const [durationSec, setDurationSec] = useState(LANDING_DEFAULT_DURATION_SEC);
  const [durationUnit, setDurationUnit] = useState<LandingBillingTimeUnit>("sec");
  const [referencedClipCount, setReferencedClipCount] = useState(0);
  const [avgReferenceSec, setAvgReferenceSec] = useState(0);
  const [referenceSec, setReferenceSec] = useState(0);
  const [referenceUnit, setReferenceUnit] = useState<LandingBillingTimeUnit>("sec");
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
    [],
  );

  const model =
    models.find((entry) => entry.canonicalId === canonicalId) ??
    models.find((entry) => entry.canonicalId === LANDING_VIDEO_PRICE_MODEL_ID) ??
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

  const hideParamHintOnButton = (event: { readonly target: EventTarget | null }) => {
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
    [durationSec, model?.maxOutputDurationSec],
  );
  const usedReferencedCount = Math.min(
    Math.max(0, referencedClipCount),
    clipPlan.clipCount,
  );
  const usedAvgReferenceSec = Math.min(
    Math.max(0, avgReferenceSec),
    model?.maxVideoReferenceSeconds ?? avgReferenceSec,
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
      activeResolution,
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
    return competitors.some((competitor) => isVideoPriceCompareCompetitor(competitor));
  }, [activeResolution, competitors, model]);

  const promoGroups = useMemo(
    () => buildLandingPromoGroups(models, competitors, t),
    [competitors, models, t],
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
        ? applyVideoPricePromoFold(estimate.costYuan, platformPromo.discountFold)
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
              platformPromo.discountFold,
            ),
          )
        : estimate.billingTokens;
  const officialRate =
    officialCostYuan == null || estimate == null
      ? null
      : computeCostPerOutputSecond(officialCostYuan, estimate.outputDurationSec);

  const promoFoldLabel = (fold: number): string =>
    t("landing.promoFoldHint", { fold: formatVideoPricePromoFold(fold) });

  const durationLabel = formatLandingParamDuration(durationSec);

  const referenceLabel = isSingleClipScenario
    ? formatLandingParamDuration(referenceSec)
    : formatLandingParamReferenceSummary(
        usedReferencedCount,
        usedAvgReferenceSec,
      );

  return (
    <>
      <div
        id="landing-demo"
        className={cn(
          "landing-featured mx-auto mt-10 flex min-h-0 w-full max-w-4xl flex-col overflow-hidden border bg-[#f7f5f1] text-left dark:bg-neutral-900 md:h-[350px]",
          LANDING_BORDER,
        )}
        onClickCapture={hideParamHintOnButton}
      >
        <div
          className={cn(
            "landing-featured-bar flex items-center justify-between gap-3 border-b",
            LANDING_BORDER,
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

        <div className="grid min-h-0 flex-1 md:grid-cols-[2fr_3fr]">
          <div className="flex h-full min-h-0 flex-col items-start gap-4 p-6 lg:p-8">
          <div className="flex w-full items-baseline justify-between gap-3">
            <span className="landing-featured-title font-mono font-bold text-foreground">
              {selectedScenario?.name ?? t("common.loading")}
            </span>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex shrink-0 items-baseline gap-0 p-0 font-mono text-[12.5px] text-foreground/65"
                  >
                    <span className="border-b border-dashed border-muted-foreground">
                      {t("landing.priceEstimateHint")}
                    </span>
                    <span aria-hidden>{" ->"}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="end">
                  <span className="block">{t("landing.compareFeedback")}</span>
                  <span className="block">{t("landing.compareFeedbackQq")}</span>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <p className="text-sm leading-6 text-muted-foreground">
            {selectedScenario?.description ?? ""}
          </p>

          {isEstimatesLoading || !model || resolutions.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground">
              {isEstimatesLoading ? t("common.loading") : t("landing.noPrice")}
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
                  <button type="button" className={FEATURED_PARAM_TRIGGER_CLASS}>
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
                    <button type="button" className={FEATURED_PARAM_TRIGGER_CLASS}>
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
                    usedAvgReferenceSec,
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
              "flex h-full min-h-0 flex-col border-t p-3 md:border-t-0 md:border-l md:p-4",
              LANDING_BORDER,
            )}
          >
            {isEstimatesLoading ? (
              <p className="font-mono text-xs text-muted-foreground">
                {t("common.loading")}
              </p>
            ) : !model || !activeResolution ? (
              <p className="font-mono text-xs text-muted-foreground">
                {t("landing.noPrice")}
              </p>
            ) : (
              <>
                <div className="thin-scrollbar min-h-0 flex-1 overflow-auto">
                  <table className="w-full table-auto text-left text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="px-2 py-2 font-medium whitespace-nowrap">
                          {t("landing.tablePlatform")}
                        </th>
                        <th className="px-2 py-2 font-medium">
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
                      <tr className={cn("border-b", LANDING_COMPARE_COMPETITOR_ROW_CLASS)}>
                        <td className={cn(LANDING_COMPARE_COMPETITOR_CELL_CLASS, "font-medium")}>
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
                                    : formatVideoPricePromoFold(yearContractFold),
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
                      {competitors
                        .filter(isVideoPriceCompareCompetitor)
                        .map((competitor, index, rows) => (
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
                </div>
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
                    <span className="mx-0.5">{t("landing.featuredPromoHintCan")}</span>
                    <label className="mx-0.5 cursor-pointer whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={excludePromo}
                        onChange={(event) => {
                          setExcludePromo(event.target.checked);
                        }}
                        className={cn(
                          LANDING_PROMO_CHECKBOX_CLASS,
                          "mr-0.5 align-text-bottom",
                        )}
                      />
                      {t("landing.tableExcludePromo")}
                    </label>
                    <span>{t("landing.featuredPromoHintSuffix")}</span>
                  </p>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>

      <div
        className="landing-featured mx-auto mt-4 w-full max-w-4xl"
        onClickCapture={hideParamHintOnButton}
      >
        <div
          className={cn(
            "grid grid-cols-3 border-t border-l md:grid-cols-6",
            LANDING_BORDER,
          )}
        >
          {featuredScenarios.map((scenario, index) => (
            <ShowcaseScenarioTab
              key={scenario.id}
              index={index}
              name={scenario.name}
              active={scenario.id === scenarioId}
              onSelect={() => handleSelectScenario(scenario)}
            />
          ))}
        </div>
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
              <AlertDialogTitle>{t("landing.externalLinkTitle")}</AlertDialogTitle>
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
                    "noopener,noreferrer",
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
