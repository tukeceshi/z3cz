import {
  applyVideoPricePromoFold,
  computeCostPerOutputSecond,
  computeLibtvConvertedYuan,
  computeLibtvCredits,
  computeLibtvCreditsForClipSplit,
  computePlanAccountCount,
  computeSplitVideoPriceEstimateForModel,
  computeVideoPriceEstimateForModel,
  formatVideoPricePromoDateRange,
  formatVideoPricePromoFold,
  formatVideoTokenMillions,
  isVideoPriceCompareCompetitor,
  isVideoPricePromoAnyResolution,
  isVideoPricePromoDate,
  isVideoPricePromoNoteCompetitor,
  LANDING_VIDEO_PRICE_MODEL_ID,
  type LibtvComparisonConfig,
  type LibtvPlan,
  type LibtvPlanCycle,
  type LibtvPricePromo,
  type LibtvRateModelId,
  libtvPlanCyclesWithPrice,
  libtvPlansForCycle,
  matchLibtvPricePromo,
  matchLowestCoveringPlan,
  matchVideoModelPricePromo,
  type PublicVideoPriceEstimateModel,
  planVideoEstimateClips,
  readLibtvPlanCyclePrice,
  readVideoPriceCompetitorPublicUrl,
  readVideoPriceEstimateTier,
  resolveLibtvRateModelId,
  splitClipOutputSeconds,
  VIDEO_DURATION_MAX,
  VIDEO_RATIO_OPTIONS,
  type VideoClipPlan,
  type VideoPriceCompareCompetitor,
} from "@dafthunk/types";
import ChevronDown from "lucide-react/icons/chevron-down";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { TranslationKey } from "@/i18n";
import { DashedHintPopover } from "@/pages/organization-ai-interfaces/dashed-hint-popover";
import { usePublicVideoPriceEstimates } from "@/services/video-price-estimates-service";
import { cn } from "@/utils/utils";

type BillingRatio = Exclude<(typeof VIDEO_RATIO_OPTIONS)[number], "adaptive">;
const BILLING_RATIOS: readonly BillingRatio[] = VIDEO_RATIO_OPTIONS.filter(
  (ratio): ratio is BillingRatio => ratio !== "adaptive"
);
const LANDING_DEFAULT_RATIO = "16:9" as const;
const LANDING_DEFAULT_RESOLUTION = "720p";
const LANDING_DEFAULT_DURATION_SEC = 15;
const LANDING_TIME_MAX_SEC = 24 * 60 * 60;
const SEEDANCE_2_MINI_ID = "doubao-seedance-2-mini";
const SEEDANCE_2_5_ID = "doubao-seedance-2-5";
const DURATION_INPUT_CLASS = cn(
  "h-7 w-16 rounded-md bg-muted/45 px-1.5 py-0.5 text-center text-xs outline-none transition-colors",
  "focus:bg-muted/65",
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
);
const LANDING_CARD_CLASS =
  "bg-white dark:bg-neutral-800 dark:border-neutral-700";
const COMPACT_BUTTON_CLASS =
  "inline-flex h-7 items-center gap-1 rounded-md border border-border/70 bg-muted/20 px-2 text-xs text-foreground hover:bg-muted/40";
const SCENARIO_IDS = [
  "clip",
  "learn",
  "personal",
  "pipeline",
  "restyle",
  "premium4k",
  "drama25",
] as const;
type ScenarioId = (typeof SCENARIO_IDS)[number];
type TimeUnit = "sec" | "min";
interface ScenarioPreset {
  readonly canonicalId: string;
  readonly ratio: BillingRatio;
  readonly resolution: string;
  readonly durationSec: number;
  readonly referencedClipCount: number;
  readonly avgReferenceSec: number;
}
const SCENARIO_PRESETS: Record<ScenarioId, ScenarioPreset> = {
  clip: {
    canonicalId: LANDING_VIDEO_PRICE_MODEL_ID,
    ratio: "16:9",
    resolution: "720p",
    durationSec: LANDING_DEFAULT_DURATION_SEC,
    referencedClipCount: 0,
    avgReferenceSec: 0,
  },
  learn: {
    canonicalId: SEEDANCE_2_MINI_ID,
    ratio: "16:9",
    resolution: "480p",
    durationSec: 10 * 60,
    referencedClipCount: 5,
    avgReferenceSec: 5,
  },
  personal: {
    canonicalId: LANDING_VIDEO_PRICE_MODEL_ID,
    ratio: "16:9",
    resolution: "720p",
    durationSec: 15 * 3 * 60,
    referencedClipCount: 30,
    avgReferenceSec: 10,
  },
  pipeline: {
    canonicalId: LANDING_VIDEO_PRICE_MODEL_ID,
    ratio: "9:16",
    resolution: "480p",
    durationSec: 30 * 2 * 60,
    referencedClipCount: 0,
    avgReferenceSec: 0,
  },
  restyle: {
    canonicalId: LANDING_VIDEO_PRICE_MODEL_ID,
    ratio: "9:16",
    resolution: "720p",
    durationSec: 30 * 2 * 60,
    referencedClipCount: Math.ceil((30 * 2 * 60) / VIDEO_DURATION_MAX),
    avgReferenceSec: VIDEO_DURATION_MAX,
  },
  premium4k: {
    canonicalId: LANDING_VIDEO_PRICE_MODEL_ID,
    ratio: "16:9",
    resolution: "4k",
    durationSec: 20 * 3 * 60,
    referencedClipCount: 60,
    avgReferenceSec: 10,
  },
  drama25: {
    canonicalId: SEEDANCE_2_5_ID,
    ratio: "9:16",
    resolution: "1080p",
    durationSec: 30 * 2 * 60,
    referencedClipCount: 20,
    avgReferenceSec: 5,
  },
};
const SCENARIO_LABEL_KEY: Record<ScenarioId, TranslationKey> = {
  clip: "landing.scenarioClip",
  learn: "landing.scenarioLearn",
  personal: "landing.scenarioPersonal",
  pipeline: "landing.scenarioPipeline",
  restyle: "landing.scenarioRestyle",
  premium4k: "landing.scenarioPremium4k",
  drama25: "landing.scenarioDrama25",
};
const SCENARIO_BODY_KEY: Record<ScenarioId, TranslationKey> = {
  clip: "landing.scenarioClipBody",
  learn: "landing.scenarioLearnBody",
  personal: "landing.scenarioPersonalBody",
  pipeline: "landing.scenarioPipelineBody",
  restyle: "landing.scenarioRestyleBody",
  premium4k: "landing.scenarioPremium4kBody",
  drama25: "landing.scenarioDrama25Body",
};
const LIBTV_MODEL_LABEL_KEY: Readonly<
  Record<LibtvRateModelId, TranslationKey>
> = {
  "doubao-seedance-2": "competitorPricing.modelSeedance2",
  "doubao-seedance-2-fast": "competitorPricing.modelSeedance2Fast",
  "doubao-seedance-2-mini": "competitorPricing.modelSeedance2Mini",
  "doubao-seedance-2-5": "competitorPricing.modelSeedance25",
};

function billingResolutionLabel(resolution: string): string | null {
  if (isVideoPricePromoAnyResolution(resolution)) {
    return null;
  }
  return resolution === "4k" ? "4K" : resolution.toUpperCase();
}

function clampSeconds(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function secondsToInputValue(seconds: number, unit: TimeUnit): string {
  if (unit === "sec") {
    return String(Math.round(seconds));
  }
  const minutes = seconds / 60;
  if (Number.isInteger(minutes)) {
    return String(minutes);
  }
  return String(Number(minutes.toFixed(2)));
}

function parseTimeInput(raw: string, unit: TimeUnit): number | null {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return unit === "sec" ? parsed : parsed * 60;
}

function creditSharePercent(credits: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.round((credits / total) * 100);
}

function scenarioTimeUnit(durationSec: number): TimeUnit {
  return durationSec >= 60 ? "min" : "sec";
}

function ratioFrameClass(value: string): string {
  switch (value) {
    case "21:9":
      return "h-2 w-5";
    case "16:9":
      return "h-2.5 w-4.5";
    case "4:3":
      return "h-3 w-4";
    case "1:1":
      return "h-3.5 w-3.5";
    case "3:4":
      return "h-4 w-3";
    case "9:16":
      return "h-4.5 w-2.5";
    default:
      return "h-3.5 w-3.5";
  }
}

function RatioTiles(props: {
  readonly value: BillingRatio;
  readonly onSelect: (option: BillingRatio) => void;
}) {
  return (
    <div className="flex gap-0.5 rounded-lg border border-border/70 bg-muted/20 p-0.5">
      {BILLING_RATIOS.map((option) => (
        <button
          key={option}
          type="button"
          className={cn(
            "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-md px-0.5 py-1.5 transition-colors",
            props.value === option
              ? "bg-background text-foreground shadow-sm dark:bg-neutral-900"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => props.onSelect(option)}
        >
          <span
            className={cn(
              "rounded-[2px] border border-current text-foreground",
              ratioFrameClass(option)
            )}
          />
          <span className="w-full truncate text-center text-[10px] leading-none">
            {option}
          </span>
        </button>
      ))}
    </div>
  );
}

function SegmentedControl(props: {
  readonly options: readonly string[];
  readonly value: string;
  readonly formatOption?: (option: string) => string;
  readonly onSelect: (option: string) => void;
}) {
  return (
    <div className="flex rounded-lg border border-border/70 bg-muted/20 p-0.5">
      {props.options.map((option) => (
        <button
          key={option}
          type="button"
          className={cn(
            "min-w-0 rounded-md px-2 py-1 text-xs transition-colors",
            props.value === option
              ? "bg-background text-foreground shadow-sm dark:bg-neutral-900"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => props.onSelect(option)}
        >
          {props.formatOption ? props.formatOption(option) : option}
        </button>
      ))}
    </div>
  );
}

function TimeAmountControl(props: {
  readonly title: string;
  readonly seconds: number;
  readonly unit: TimeUnit;
  readonly minSeconds: number;
  readonly maxSeconds: number;
  readonly unitSecLabel: string;
  readonly unitMinLabel: string;
  readonly onSecondsChange: (next: number) => void;
  readonly onUnitChange: (next: TimeUnit) => void;
}) {
  const [inputDraft, setInputDraft] = useState<string | null>(null);
  const isInputFocusedRef = useRef(false);

  useEffect(() => {
    if (!isInputFocusedRef.current) {
      setInputDraft(null);
    }
  }, [props.seconds, props.unit]);

  const commitSeconds = useCallback(
    (next: number) => {
      props.onSecondsChange(
        clampSeconds(next, props.minSeconds, props.maxSeconds)
      );
    },
    [props.maxSeconds, props.minSeconds, props.onSecondsChange]
  );

  const displayValue =
    inputDraft ?? secondsToInputValue(props.seconds, props.unit);

  return (
    <div className="flex items-center gap-1.5">
      <span className="shrink-0 text-xs font-medium text-foreground">
        {props.title}
      </span>
      <Input
        type="text"
        inputMode="decimal"
        value={displayValue}
        className={DURATION_INPUT_CLASS}
        autoComplete="off"
        onFocus={() => {
          isInputFocusedRef.current = true;
          setInputDraft(secondsToInputValue(props.seconds, props.unit));
        }}
        onChange={(event) => setInputDraft(event.target.value)}
        onBlur={(event) => {
          isInputFocusedRef.current = false;
          setInputDraft(null);
          const parsed = parseTimeInput(event.target.value, props.unit);
          if (parsed != null) {
            commitSeconds(parsed);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
      />
      <div className="flex rounded-md border border-border/70 bg-muted/20 p-0.5">
        {(["sec", "min"] as const).map((unit) => (
          <button
            key={unit}
            type="button"
            className={cn(
              "rounded px-1.5 py-0.5 text-[11px] transition-colors",
              props.unit === unit
                ? "bg-background text-foreground shadow-sm dark:bg-neutral-900"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => props.onUnitChange(unit)}
          >
            {unit === "sec" ? props.unitSecLabel : props.unitMinLabel}
          </button>
        ))}
      </div>
    </div>
  );
}

function ClipNumberInput(props: {
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly onChange: (next: number) => void;
}) {
  const [inputDraft, setInputDraft] = useState<string | null>(null);
  const isInputFocusedRef = useRef(false);

  useEffect(() => {
    if (!isInputFocusedRef.current) {
      setInputDraft(null);
    }
  }, [props.value]);

  const commitValue = useCallback(
    (raw: string) => {
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) {
        return;
      }
      props.onChange(clampSeconds(Math.round(parsed), props.min, props.max));
    },
    [props.max, props.min, props.onChange]
  );

  return (
    <Input
      type="text"
      inputMode="numeric"
      value={inputDraft ?? String(props.value)}
      className={DURATION_INPUT_CLASS}
      autoComplete="off"
      onFocus={() => {
        isInputFocusedRef.current = true;
        setInputDraft(String(props.value));
      }}
      onChange={(event) => setInputDraft(event.target.value)}
      onBlur={(event) => {
        isInputFocusedRef.current = false;
        setInputDraft(null);
        commitValue(event.target.value);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
      }}
    />
  );
}

function ReferenceClipControl(props: {
  readonly clipCount: number;
  readonly clipDurationSec: number;
  readonly referencedCount: number;
  readonly avgReferenceSec: number;
  readonly maxAvgReferenceSec: number;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onReferencedCountChange: (next: number) => void;
  readonly onAvgReferenceSecChange: (next: number) => void;
}) {
  const { t } = useTranslation();
  const clipSeconds = Math.round(props.clipDurationSec);

  return (
    <div className="flex items-center gap-1.5">
      <span className="shrink-0 text-xs font-medium">
        {t("landing.referenceTitle")}
      </span>
      <Popover open={props.open} onOpenChange={props.onOpenChange}>
        <PopoverTrigger asChild>
          <button type="button" className={COMPACT_BUTTON_CLASS}>
            <span>
              {t("landing.referenceClipSummary", {
                count: props.referencedCount,
                seconds: props.avgReferenceSec,
              })}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto min-w-56 p-2.5">
          <div className="grid gap-2 text-xs">
            <p className="text-muted-foreground">
              {t("landing.referenceClipPlan", {
                count: props.clipCount,
                seconds: clipSeconds,
              })}
            </p>
            <div className="flex items-center gap-1.5">
              <span className="shrink-0">
                {t("landing.referenceClipUsedPrefix")}
              </span>
              <ClipNumberInput
                value={props.referencedCount}
                min={0}
                max={props.clipCount}
                onChange={props.onReferencedCountChange}
              />
              <span>{t("landing.referenceClipUsedSuffix")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="shrink-0">
                {t("landing.referenceClipAveragePrefix")}
              </span>
              <ClipNumberInput
                value={props.avgReferenceSec}
                min={0}
                max={props.maxAvgReferenceSec}
                onChange={props.onAvgReferenceSecChange}
              />
              <span>{t("landing.referenceClipAverageSuffix")}</span>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function applyLibtvCreditsPromo(
  credits: number,
  promo: LibtvPricePromo | null
): number {
  if (!promo) {
    return credits;
  }
  return Math.round(applyVideoPricePromoFold(credits, promo.discountFold));
}

function landingCompetitorCreditParts(params: {
  readonly config: LibtvComparisonConfig;
  readonly canonicalId: string;
  readonly resolution: string;
  readonly isSingleClipScenario: boolean;
  readonly durationSec: number;
  readonly referenceSec: number;
  readonly clipPlan: VideoClipPlan;
  readonly usedReferencedCount: number;
  readonly usedAvgReferenceSec: number;
}): { referencedCredits: number; plainCredits: number } | null {
  if (params.isSingleClipScenario) {
    const hasRef = params.referenceSec > 0;
    const raw = computeLibtvCredits({
      config: params.config,
      canonicalId: params.canonicalId,
      resolution: params.resolution,
      outputDurationSec: params.durationSec,
      referenceDurationSec: params.referenceSec,
    });
    if (raw == null) {
      return null;
    }
    return {
      referencedCredits: hasRef ? raw : 0,
      plainCredits: hasRef ? 0 : raw,
    };
  }
  const splitOutput = splitClipOutputSeconds(
    params.clipPlan,
    params.usedReferencedCount
  );
  return computeLibtvCreditsForClipSplit({
    config: params.config,
    canonicalId: params.canonicalId,
    resolution: params.resolution,
    referencedOutputSec: splitOutput.referencedOutputSec,
    plainOutputSec: splitOutput.plainOutputSec,
    referenceDurationSec:
      params.usedReferencedCount > 0
        ? params.usedReferencedCount * params.usedAvgReferenceSec
        : 0,
  });
}

function landingCompetitorPromoFolds(
  config: LibtvComparisonConfig,
  canonicalId: string,
  resolution: string,
  parts: { referencedCredits: number; plainCredits: number }
): number[] {
  const modelId = resolveLibtvRateModelId(canonicalId);
  const folds: number[] = [];
  if (parts.referencedCredits > 0) {
    const promo = matchLibtvPricePromo(config.promos, {
      canonicalId: modelId,
      resolution,
      withReference: true,
    });
    if (promo) {
      folds.push(promo.discountFold);
    }
  }
  if (parts.plainCredits > 0) {
    const promo = matchLibtvPricePromo(config.promos, {
      canonicalId: modelId,
      resolution,
      withReference: false,
    });
    if (promo && !folds.includes(promo.discountFold)) {
      folds.push(promo.discountFold);
    }
  }
  return folds;
}

function OptionMenu(props: {
  readonly label: string;
  readonly children: ReactNode;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly contentClassName?: string;
}) {
  return (
    <Popover open={props.open} onOpenChange={props.onOpenChange}>
      <PopoverTrigger asChild>
        <button type="button" className={COMPACT_BUTTON_CLASS}>
          <span>{props.label}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn("w-auto p-1", props.contentClassName)}
      >
        {props.children}
      </PopoverContent>
    </Popover>
  );
}

function DiscountMark(props: { readonly label: string }) {
  return (
    <sup className="ml-0.5 text-[10px] leading-none text-muted-foreground">
      {props.label}
    </sup>
  );
}

interface PromoDisplayRow {
  readonly id: string;
  readonly platform: string;
  readonly platformUrl: string | null;
  readonly model: string;
  readonly resolution: string | null;
  readonly needsVideoReference: boolean;
  readonly foldLabel: string;
  readonly dateRange: string;
}

interface PromoDisplayGroup {
  readonly platform: string;
  readonly platformUrl: string | null;
  readonly items: readonly PromoDisplayRow[];
}

function groupPromoRowsByPlatform(
  rows: readonly PromoDisplayRow[]
): readonly PromoDisplayGroup[] {
  const groups: Array<{
    platform: string;
    platformUrl: string | null;
    items: PromoDisplayRow[];
  }> = [];
  const indexByPlatform = new Map<string, number>();
  for (const row of rows) {
    const existing = indexByPlatform.get(row.platform);
    if (existing === undefined) {
      indexByPlatform.set(row.platform, groups.length);
      groups.push({
        platform: row.platform,
        platformUrl: row.platformUrl,
        items: [row],
      });
      continue;
    }
    const group = groups[existing];
    if (!group) {
      continue;
    }
    if (!group.platformUrl && row.platformUrl) {
      group.platformUrl = row.platformUrl;
    }
    group.items.push(row);
  }
  return groups;
}

function PromoChip(props: {
  readonly children: ReactNode;
  readonly emphasis?: boolean;
  readonly onClick?: () => void;
}) {
  const className = cn(
    "text-xs",
    props.emphasis ? "text-foreground" : "text-muted-foreground",
    props.onClick
      ? "cursor-pointer bg-transparent p-0 underline decoration-dotted underline-offset-2"
      : undefined
  );
  if (props.onClick) {
    return (
      <button type="button" className={className} onClick={props.onClick}>
        {props.children}
      </button>
    );
  }
  return <span className={className}>{props.children}</span>;
}

function LandingCompetitorCompareRow(props: {
  readonly competitor: VideoPriceCompareCompetitor;
  readonly bordered: boolean;
  readonly model: PublicVideoPriceEstimateModel | undefined;
  readonly activeResolution: string;
  readonly isSingleClipScenario: boolean;
  readonly durationSec: number;
  readonly referenceSec: number;
  readonly clipPlan: VideoClipPlan;
  readonly usedReferencedCount: number;
  readonly usedAvgReferenceSec: number;
  readonly excludePromo: boolean;
  readonly promoFoldLabel: (fold: number) => string;
  readonly onOpenExternal: (next: { name: string; url: string }) => void;
}) {
  const { t } = useTranslation();
  const [planId, setPlanId] = useState(
    props.competitor.config.plans[0]?.id ?? ""
  );
  const [planCycle, setPlanCycle] = useState<LibtvPlanCycle>("monthly");
  const [planOpen, setPlanOpen] = useState(false);
  const config = props.competitor.config;
  const creditParts = useMemo(() => {
    if (!props.model || !props.activeResolution) {
      return null;
    }
    return landingCompetitorCreditParts({
      config,
      canonicalId: props.model.canonicalId,
      resolution: props.activeResolution,
      isSingleClipScenario: props.isSingleClipScenario,
      durationSec: props.durationSec,
      referenceSec: props.referenceSec,
      clipPlan: props.clipPlan,
      usedReferencedCount: props.usedReferencedCount,
      usedAvgReferenceSec: props.usedAvgReferenceSec,
    });
  }, [
    config,
    props.activeResolution,
    props.clipPlan,
    props.durationSec,
    props.isSingleClipScenario,
    props.model,
    props.referenceSec,
    props.usedAvgReferenceSec,
    props.usedReferencedCount,
  ]);
  const promoFolds = useMemo(() => {
    if (!props.model || !props.activeResolution || creditParts == null) {
      return [];
    }
    return landingCompetitorPromoFolds(
      config,
      props.model.canonicalId,
      props.activeResolution,
      creditParts
    );
  }, [config, creditParts, props.activeResolution, props.model]);
  const credits = useMemo(() => {
    if (!props.model || !props.activeResolution || creditParts == null) {
      return null;
    }
    const modelId = resolveLibtvRateModelId(props.model.canonicalId);
    const referencedPromo =
      !props.excludePromo && creditParts.referencedCredits > 0
        ? matchLibtvPricePromo(config.promos, {
            canonicalId: modelId,
            resolution: props.activeResolution,
            withReference: true,
          })
        : null;
    const plainPromo =
      !props.excludePromo && creditParts.plainCredits > 0
        ? matchLibtvPricePromo(config.promos, {
            canonicalId: modelId,
            resolution: props.activeResolution,
            withReference: false,
          })
        : null;
    return (
      applyLibtvCreditsPromo(creditParts.referencedCredits, referencedPromo) +
      applyLibtvCreditsPromo(creditParts.plainCredits, plainPromo)
    );
  }, [
    config.promos,
    creditParts,
    props.activeResolution,
    props.excludePromo,
    props.model,
  ]);
  const availableCycles = useMemo(
    () => libtvPlanCyclesWithPrice(config.plans),
    [config.plans]
  );
  const cyclePlans = useMemo(
    () => libtvPlansForCycle(config.plans, planCycle),
    [config.plans, planCycle]
  );

  useEffect(() => {
    if (!availableCycles.includes(planCycle)) {
      setPlanCycle("monthly");
    }
  }, [availableCycles, planCycle]);

  useEffect(() => {
    if (credits == null) {
      return;
    }
    const matched = matchLowestCoveringPlan(cyclePlans, credits);
    if (matched) {
      setPlanId(matched.id);
    }
  }, [cyclePlans, credits]);

  const selectedPlan =
    cyclePlans.find((plan) => plan.id === planId) ?? cyclePlans[0];
  const selectedCyclePrice = selectedPlan
    ? readLibtvPlanCyclePrice(selectedPlan, planCycle)
    : null;
  const accountCount =
    credits != null && selectedPlan
      ? computePlanAccountCount(credits, selectedPlan.credits)
      : 1;
  const percent =
    credits != null && selectedPlan
      ? creditSharePercent(credits, selectedPlan.credits * accountCount)
      : null;
  const planName = (plan: LibtvPlan): string => {
    const custom = plan.name.trim();
    if (custom) {
      return custom;
    }
    if (plan.id === "supreme-monthly") {
      return t("landing.planSupreme");
    }
    if (plan.id === "standard-monthly") {
      return t("landing.planStandard");
    }
    return plan.id;
  };
  const planCycleLabel = (cycle: LibtvPlanCycle): string => {
    if (cycle === "quarterly") {
      return t("landing.planCycleQuarterly");
    }
    if (cycle === "yearly") {
      return t("landing.planCycleYearly");
    }
    return t("landing.planCycleMonthly");
  };
  const planCycleUnit = (cycle: LibtvPlanCycle): string => {
    if (cycle === "quarterly") {
      return t("landing.planCycleQuarterUnit");
    }
    if (cycle === "yearly") {
      return t("landing.planCycleYearUnit");
    }
    return "";
  };
  const planPricePart = (
    plan: LibtvPlan,
    cycle: LibtvPlanCycle,
    count = 1
  ): string => {
    const priced = readLibtvPlanCyclePrice(plan, cycle);
    if (!priced) {
      return "";
    }
    const monthly = t("landing.planPricePart", {
      price: (priced.monthlyYuan * count).toFixed(0),
    });
    if (cycle === "monthly") {
      return monthly;
    }
    return `${monthly}·${t("landing.planCycleTotal", {
      price: (priced.totalYuan * count).toFixed(0),
      unit: planCycleUnit(cycle),
    })}`;
  };
  const planOptionLabel = (plan: LibtvPlan): string =>
    t("landing.planOption", {
      name: planName(plan),
      credits: plan.credits,
      pricePart: planPricePart(plan, planCycle),
    });
  const planLabel = selectedPlan
    ? `${planName(selectedPlan)}${planPricePart(
        selectedPlan,
        planCycle,
        accountCount
      )}`
    : t("landing.compareUnavailable");
  const convertedYuan =
    credits == null || !selectedPlan
      ? null
      : computeLibtvConvertedYuan(credits, selectedPlan, planCycle);
  const rate =
    convertedYuan == null || props.durationSec <= 0
      ? null
      : convertedYuan / props.durationSec;
  const platformLabel = props.competitor.name;
  const platformUrl = readVideoPriceCompetitorPublicUrl(props.competitor);

  return (
    <tr className={props.bordered ? "border-b" : undefined}>
      <td className="overflow-hidden px-2 py-3 font-medium whitespace-nowrap">
        {platformUrl ? (
          <button
            type="button"
            className="cursor-pointer bg-transparent p-0 font-medium underline decoration-dotted underline-offset-2"
            onClick={() =>
              props.onOpenExternal({ name: platformLabel, url: platformUrl })
            }
          >
            {platformLabel}
          </button>
        ) : (
          platformLabel
        )}
      </td>
      <td className="overflow-hidden px-2 py-3">
        <span className="inline-flex min-w-0 flex-wrap items-center gap-x-0.5 gap-y-0.5">
          {selectedPlan && selectedCyclePrice ? (
            <>
              <span className="font-medium">{planName(selectedPlan)}</span>
              {accountCount > 1 ? (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="border-b border-dashed border-muted-foreground text-[11px] leading-none text-muted-foreground"
                      >
                        {t("landing.planAccounts", {
                          count: accountCount,
                        })}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {t("landing.planAccountsHint")}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : null}
              <span className="text-muted-foreground">
                {t("landing.planPricePart", {
                  price: (
                    selectedCyclePrice.monthlyYuan * accountCount
                  ).toFixed(0),
                })}
                {planCycle === "monthly" ? null : (
                  <>
                    ·
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="border-b border-dashed border-muted-foreground"
                          >
                            {t("landing.planCycleTotal", {
                              price: (
                                selectedCyclePrice.totalYuan * accountCount
                              ).toFixed(0),
                              unit: planCycleUnit(planCycle),
                            })}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {t("landing.planCycleRiskHint")}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </>
                )}
              </span>
            </>
          ) : (
            <span>{t("landing.compareUnavailable")}</span>
          )}
          <Popover open={planOpen} onOpenChange={setPlanOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={planLabel}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-auto min-w-52 max-w-80 p-1"
            >
              {availableCycles.length > 1 ? (
                <div className="mb-1 flex gap-0.5">
                  {availableCycles.map((cycle) => (
                    <button
                      key={cycle}
                      type="button"
                      className={cn(
                        "flex-1 rounded-md px-2 py-1 text-xs transition-colors",
                        cycle === planCycle
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      )}
                      onClick={() => {
                        setPlanCycle(cycle);
                      }}
                    >
                      {planCycleLabel(cycle)}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="grid gap-0.5">
                {cyclePlans.map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    className={cn(
                      "rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                      plan.id === selectedPlan?.id
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    )}
                    onClick={() => {
                      setPlanId(plan.id);
                      setPlanOpen(false);
                    }}
                  >
                    {planOptionLabel(plan)}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </span>
      </td>
      <td className="overflow-hidden px-2 py-3 whitespace-nowrap">
        {credits == null || percent == null || !selectedPlan ? (
          t("landing.compareUnavailable")
        ) : (
          <span>
            <span>
              {t("landing.comparePointsBefore", {
                points: credits,
              })}
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="border-b border-dashed border-muted-foreground p-0 text-foreground"
                    >
                      {t("landing.comparePointsPercentValue", {
                        percent,
                      })}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t("landing.comparePointsTotal", {
                      total: selectedPlan.credits * accountCount,
                    })}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {t("landing.comparePointsAfter")}
            </span>
            {props.excludePromo
              ? null
              : promoFolds.map((fold) => (
                  <DiscountMark key={fold} label={props.promoFoldLabel(fold)} />
                ))}
          </span>
        )}
      </td>
      <td className="overflow-hidden px-2 py-3 whitespace-nowrap">
        {rate == null
          ? t("landing.compareUnavailable")
          : t("landing.rateValue", {
              rate: rate.toFixed(3),
            })}
      </td>
    </tr>
  );
}

export function LandingBillingSection() {
  const { t } = useTranslation();
  const { models, competitors, isEstimatesLoading } =
    usePublicVideoPriceEstimates();
  const [canonicalId, setCanonicalId] = useState<string>(
    LANDING_VIDEO_PRICE_MODEL_ID
  );
  const model =
    models.find((entry) => entry.canonicalId === canonicalId) ??
    models.find(
      (entry) => entry.canonicalId === LANDING_VIDEO_PRICE_MODEL_ID
    ) ??
    models[0];

  const resolutions = model?.tiers.map((tier) => tier.resolution) ?? [];
  const [resolution, setResolution] = useState(LANDING_DEFAULT_RESOLUTION);
  const [ratio, setRatio] = useState<BillingRatio>(LANDING_DEFAULT_RATIO);
  const [durationSec, setDurationSec] = useState(LANDING_DEFAULT_DURATION_SEC);
  const [durationUnit, setDurationUnit] = useState<TimeUnit>("sec");
  const [referenceSec, setReferenceSec] = useState(0);
  const [referenceUnit, setReferenceUnit] = useState<TimeUnit>("sec");
  const [referencedClipCount, setReferencedClipCount] = useState(0);
  const [avgReferenceSec, setAvgReferenceSec] = useState(0);
  const [scenarioId, setScenarioId] = useState<ScenarioId>("clip");
  const [ratioOpen, setRatioOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [excludePromo, setExcludePromo] = useState(false);
  const [referenceClipOpen, setReferenceClipOpen] = useState(false);
  const [pendingExternal, setPendingExternal] = useState<{
    name: string;
    url: string;
  } | null>(null);
  const isSingleClipScenario = scenarioId === "clip";

  const activeResolution =
    resolution && resolutions.includes(resolution)
      ? resolution
      : resolutions.includes(LANDING_DEFAULT_RESOLUTION)
        ? LANDING_DEFAULT_RESOLUTION
        : (resolutions[0] ?? "");

  const handleSelectScenario = (id: ScenarioId) => {
    const preset = SCENARIO_PRESETS[id];
    setScenarioId(id);
    setCanonicalId(preset.canonicalId);
    setRatio(preset.ratio);
    setResolution(preset.resolution);
    setDurationSec(preset.durationSec);
    setDurationUnit(scenarioTimeUnit(preset.durationSec));
    setReferencedClipCount(preset.referencedClipCount);
    setAvgReferenceSec(preset.avgReferenceSec);
    if (id === "clip") {
      setReferenceSec(0);
    }
    setReferenceClipOpen(false);
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
          tiers: model.tiers.map((entry) => ({
            ...entry,
            enabled: true,
          })),
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
    return competitors.some((competitor) => {
      if (!isVideoPriceCompareCompetitor(competitor)) {
        return false;
      }
      const parts = landingCompetitorCreditParts({
        config: competitor.config,
        canonicalId: model.canonicalId,
        resolution: activeResolution,
        isSingleClipScenario,
        durationSec,
        referenceSec,
        clipPlan,
        usedReferencedCount,
        usedAvgReferenceSec,
      });
      if (!parts) {
        return false;
      }
      return (
        landingCompetitorPromoFolds(
          competitor.config,
          model.canonicalId,
          activeResolution,
          parts
        ).length > 0
      );
    });
  }, [
    activeResolution,
    clipPlan,
    competitors,
    durationSec,
    isSingleClipScenario,
    model,
    referenceSec,
    usedAvgReferenceSec,
    usedReferencedCount,
  ]);

  const officialCostYuan =
    estimate == null
      ? null
      : !excludePromo && platformPromo
        ? applyVideoPricePromoFold(
            estimate.costYuan,
            platformPromo.discountFold
          )
        : estimate.costYuan;
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

  const modelLabel = model?.displayName ?? t("landing.compareUnavailable");
  const promoFoldLabel = (fold: number): string =>
    t("landing.promoFoldHint", { fold: formatVideoPricePromoFold(fold) });
  const promoGroups = useMemo(() => {
    const rows: PromoDisplayRow[] = [];
    for (const entry of models) {
      for (const promo of entry.promos ?? []) {
        rows.push({
          id: `official-${entry.canonicalId}-${promo.id}`,
          platform: t("landing.platformOfficial"),
          platformUrl: null,
          model: entry.displayName,
          resolution: billingResolutionLabel(promo.resolution),
          needsVideoReference: false,
          foldLabel: t("landing.promoFoldHint", {
            fold: formatVideoPricePromoFold(promo.discountFold),
          }),
          dateRange: formatVideoPricePromoDateRange(
            promo.startsAt,
            promo.endsAt
          ),
        });
      }
    }
    for (const competitor of competitors) {
      if (isVideoPricePromoNoteCompetitor(competitor)) {
        if (!competitor.text) {
          continue;
        }
        rows.push({
          id: competitor.id,
          platform: competitor.name,
          platformUrl: readVideoPriceCompetitorPublicUrl(competitor),
          model: "",
          resolution: null,
          needsVideoReference: false,
          foldLabel: competitor.text,
          dateRange:
            competitor.showDates &&
            isVideoPricePromoDate(competitor.startsAt) &&
            isVideoPricePromoDate(competitor.endsAt)
              ? formatVideoPricePromoDateRange(
                  competitor.startsAt,
                  competitor.endsAt
                )
              : "",
        });
        continue;
      }
      if (!isVideoPriceCompareCompetitor(competitor)) {
        continue;
      }
      for (const promo of competitor.config.promos) {
        const modelId = resolveLibtvRateModelId(promo.canonicalId);
        const named = models.find(
          (entry) => entry.canonicalId === promo.canonicalId
        );
        rows.push({
          id: `${competitor.id}-${promo.id}`,
          platform: competitor.name,
          platformUrl: readVideoPriceCompetitorPublicUrl(competitor),
          model: named?.displayName ?? t(LIBTV_MODEL_LABEL_KEY[modelId]),
          resolution: billingResolutionLabel(promo.resolution),
          needsVideoReference: promo.withReference,
          foldLabel: t("landing.promoFoldHint", {
            fold: formatVideoPricePromoFold(promo.discountFold),
          }),
          dateRange: formatVideoPricePromoDateRange(
            promo.startsAt,
            promo.endsAt
          ),
        });
      }
    }
    return groupPromoRowsByPlatform(rows);
  }, [competitors, models, t]);

  return (
    <section id="pricing" className="scroll-mt-20 pt-2 pb-8 md:pb-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 md:px-6">
        <div className={cn("rounded-xl border p-4 md:p-5", LANDING_CARD_CLASS)}>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap justify-center gap-2">
              {SCENARIO_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={cn(
                    "h-9 rounded-md border px-3 text-sm transition-colors",
                    scenarioId === id
                      ? "border-foreground/20 bg-background text-foreground shadow-sm dark:bg-neutral-900"
                      : "border-border/70 bg-muted/20 text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => handleSelectScenario(id)}
                >
                  {t(SCENARIO_LABEL_KEY[id])}
                </button>
              ))}
            </div>
            <div className="rounded-lg border border-dashed border-border px-3 py-2 text-sm leading-6 text-muted-foreground">
              {t(SCENARIO_BODY_KEY[scenarioId])}
            </div>
          </div>

          <div className="mt-4">
            {isEstimatesLoading ? (
              <p className="text-sm text-muted-foreground">
                {t("common.loading")}
              </p>
            ) : !model || resolutions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("landing.noPrice")}
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="flex items-center gap-1.5">
                  <span className="shrink-0 text-xs font-medium">
                    {t("landing.modelLabel")}
                  </span>
                  <OptionMenu
                    label={modelLabel}
                    open={modelOpen}
                    onOpenChange={setModelOpen}
                    contentClassName="min-w-52"
                  >
                    <div className="grid gap-0.5">
                      {models.map((entry) => (
                        <button
                          key={entry.canonicalId}
                          type="button"
                          className={cn(
                            "rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                            entry.canonicalId === model.canonicalId
                              ? "bg-muted text-foreground"
                              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                          )}
                          onClick={() => {
                            setCanonicalId(entry.canonicalId);
                            setModelOpen(false);
                          }}
                        >
                          {entry.displayName}
                        </button>
                      ))}
                    </div>
                  </OptionMenu>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="shrink-0 text-xs font-medium">
                    {t("landing.ratioLabel")}
                  </span>
                  <OptionMenu
                    label={ratio}
                    open={ratioOpen}
                    onOpenChange={setRatioOpen}
                    contentClassName="min-w-72 border-0 bg-transparent p-0 shadow-none"
                  >
                    <RatioTiles
                      value={ratio}
                      onSelect={(option) => {
                        setRatio(option);
                        setRatioOpen(false);
                      }}
                    />
                  </OptionMenu>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="shrink-0 text-xs font-medium">
                    {t("landing.resolutionLabel")}
                  </span>
                  <SegmentedControl
                    options={resolutions}
                    value={activeResolution}
                    formatOption={(option) => option.toUpperCase()}
                    onSelect={setResolution}
                  />
                </div>
                {isSingleClipScenario ? (
                  <TimeAmountControl
                    title={t("landing.referenceTitle")}
                    seconds={referenceSec}
                    unit={referenceUnit}
                    minSeconds={0}
                    maxSeconds={LANDING_TIME_MAX_SEC}
                    unitSecLabel={t("landing.durationUnitSec")}
                    unitMinLabel={t("landing.durationUnitMin")}
                    onSecondsChange={setReferenceSec}
                    onUnitChange={setReferenceUnit}
                  />
                ) : (
                  <ReferenceClipControl
                    clipCount={clipPlan.clipCount}
                    clipDurationSec={clipPlan.clipDurationSec}
                    referencedCount={usedReferencedCount}
                    avgReferenceSec={usedAvgReferenceSec}
                    maxAvgReferenceSec={model.maxVideoReferenceSeconds}
                    open={referenceClipOpen}
                    onOpenChange={setReferenceClipOpen}
                    onReferencedCountChange={setReferencedClipCount}
                    onAvgReferenceSecChange={setAvgReferenceSec}
                  />
                )}
                <TimeAmountControl
                  title={t("landing.durationLabel")}
                  seconds={durationSec}
                  unit={durationUnit}
                  minSeconds={1}
                  maxSeconds={LANDING_TIME_MAX_SEC}
                  unitSecLabel={t("landing.durationUnitSec")}
                  unitMinLabel={t("landing.durationUnitMin")}
                  onSecondsChange={setDurationSec}
                  onUnitChange={setDurationUnit}
                />
              </div>
            )}
          </div>

          <div className="mt-5 border-t border-dashed border-border pt-4">
            <p className="text-sm text-muted-foreground">
              {t("landing.compareDisclaimer")}{" "}
              <DashedHintPopover label={t("landing.compareFeedback")}>
                <p className="text-sm">{t("landing.compareFeedbackQq")}</p>
              </DashedHintPopover>
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[36rem] table-fixed text-left text-sm">
                <colgroup>
                  <col className="w-[18%]" />
                  <col className="w-[36%]" />
                  <col className="w-[28%]" />
                  <col className="w-[18%]" />
                </colgroup>
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="px-2 py-2 font-medium">
                      {t("landing.tablePlatform")}
                    </th>
                    <th className="px-2 py-2 font-medium">
                      {t("landing.tableLevel")}
                    </th>
                    <th className="px-2 py-2 font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        {t("landing.tableTokens")}
                        {platformPromo || hasCompetitorPromo ? (
                          <label className="inline-flex items-center gap-0.5 text-[10px] font-normal leading-none text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={excludePromo}
                              onChange={(event) => {
                                setExcludePromo(event.target.checked);
                              }}
                              className="h-3 w-3 accent-foreground"
                            />
                            {t("landing.tableExcludePromo")}
                          </label>
                        ) : null}
                      </span>
                    </th>
                    <th className="px-2 py-2 font-medium">
                      {t("landing.tableRate")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="overflow-hidden px-2 py-3 whitespace-nowrap">
                      <span className="font-medium">
                        {t("landing.platformOfficial")}
                      </span>
                      <span className="ml-1 align-middle text-[10px] text-muted-foreground">
                        {t("landing.platformOfficialBadge")}
                      </span>
                    </td>
                    <td className="overflow-hidden px-2 py-3 whitespace-nowrap">
                      {officialCostYuan == null
                        ? t("landing.compareUnavailable")
                        : officialCostYuan.toFixed(2)}
                    </td>
                    <td className="overflow-hidden px-2 py-3 whitespace-nowrap">
                      {officialTokens == null ? (
                        t("landing.compareUnavailable")
                      ) : (
                        <span>
                          {t("landing.officialTokenValue", {
                            tokens: formatVideoTokenMillions(officialTokens),
                          })}
                          {!excludePromo && platformPromo ? (
                            <DiscountMark
                              label={promoFoldLabel(platformPromo.discountFold)}
                            />
                          ) : null}
                        </span>
                      )}
                    </td>
                    <td className="overflow-hidden px-2 py-3 whitespace-nowrap">
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
                      />
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        {promoGroups.length > 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 px-4 py-3 md:px-5">
            <h2 className="text-sm font-medium text-muted-foreground">
              {t("landing.promoTitle")}
            </h2>
            <div className="mt-2 grid gap-1.5">
              {promoGroups.map((group) => (
                <div
                  key={group.platform}
                  className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-1"
                >
                  <PromoChip
                    onClick={
                      group.platformUrl
                        ? () => {
                            const url = group.platformUrl;
                            if (!url) {
                              return;
                            }
                            setPendingExternal({
                              name: group.platform,
                              url,
                            });
                          }
                        : undefined
                    }
                  >
                    {group.platform}
                  </PromoChip>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {group.items.map((row) => (
                      <span
                        key={row.id}
                        className="inline-flex max-w-full shrink-0 flex-wrap items-center gap-x-2 gap-y-1"
                      >
                        {row.model ? <PromoChip>{row.model}</PromoChip> : null}
                        {row.resolution ? (
                          <PromoChip>{row.resolution}</PromoChip>
                        ) : null}
                        {row.needsVideoReference ? (
                          <PromoChip>
                            {t("landing.promoNeedVideoReference")}
                          </PromoChip>
                        ) : null}
                        <PromoChip emphasis>{row.foldLabel}</PromoChip>
                        {row.dateRange ? (
                          <span className="text-xs text-muted-foreground">
                            {row.dateRange}
                          </span>
                        ) : null}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <AlertDialog
          open={pendingExternal != null}
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
                  name: pendingExternal?.name ?? "",
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (!pendingExternal) {
                    return;
                  }
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
      </div>
    </section>
  );
}
