import {
  applyVideoPricePromoFold,
  computeCostPerOutputSecond,
  computeLibtvConvertedYuan,
  computeLibtvCredits,
  computeLibtvCreditsForClipSplit,
  computePlanAccountCount,
  computeSplitVideoPriceEstimateForModel,
  computeVideoPriceEstimateForModel,
  DEFAULT_LIBTV_COMPARISON_CONFIG,
  formatVideoPricePromoFold,
  formatVideoTokenMillions,
  isVideoPricePromoAnyResolution,
  LANDING_VIDEO_PRICE_MODEL_ID,
  type LibtvPlan,
  type LibtvPricePromo,
  type LibtvRateModelId,
  matchLibtvPricePromo,
  matchLowestCoveringPlan,
  matchVideoModelPricePromo,
  mergeLibtvComparisonConfig,
  planVideoEstimateClips,
  readVideoPriceEstimateTier,
  resolveLibtvRateModelId,
  splitClipOutputSeconds,
  VIDEO_DURATION_MAX,
  VIDEO_RATIO_OPTIONS,
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
  readonly model: string;
  readonly resolution: string | null;
  readonly needsVideoReference: boolean;
  readonly foldLabel: string;
  readonly startsAt: string;
  readonly endsAt: string;
}

function PromoChip(props: {
  readonly children: ReactNode;
  readonly emphasis?: boolean;
}) {
  return (
    <span
      className={cn(
        "text-xs",
        props.emphasis ? "text-foreground" : "text-muted-foreground"
      )}
    >
      {props.children}
    </span>
  );
}

export function LandingBillingSection() {
  const { t } = useTranslation();
  const { models, libtv, isEstimatesLoading } = usePublicVideoPriceEstimates();
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
  const [libtvPlanId, setLibtvPlanId] = useState(
    DEFAULT_LIBTV_COMPARISON_CONFIG.plans[0]?.id ?? ""
  );
  const [ratioOpen, setRatioOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [referenceClipOpen, setReferenceClipOpen] = useState(false);
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

  const libtvConfig = useMemo(
    () => mergeLibtvComparisonConfig(libtv ?? DEFAULT_LIBTV_COMPARISON_CONFIG),
    [libtv]
  );
  const libtvCreditParts = useMemo(() => {
    if (!model || !activeResolution) {
      return null;
    }
    if (isSingleClipScenario) {
      const hasRef = referenceSec > 0;
      const raw = computeLibtvCredits({
        config: libtvConfig,
        canonicalId: model.canonicalId,
        resolution: activeResolution,
        outputDurationSec: durationSec,
        referenceDurationSec: referenceSec,
      });
      if (raw == null) {
        return null;
      }
      return {
        referencedCredits: hasRef ? raw : 0,
        plainCredits: hasRef ? 0 : raw,
      };
    }
    const splitOutput = splitClipOutputSeconds(clipPlan, usedReferencedCount);
    return computeLibtvCreditsForClipSplit({
      config: libtvConfig,
      canonicalId: model.canonicalId,
      resolution: activeResolution,
      referencedOutputSec: splitOutput.referencedOutputSec,
      plainOutputSec: splitOutput.plainOutputSec,
      referenceDurationSec:
        usedReferencedCount > 0 ? usedReferencedCount * usedAvgReferenceSec : 0,
    });
  }, [
    activeResolution,
    clipPlan,
    durationSec,
    isSingleClipScenario,
    libtvConfig,
    model,
    referenceSec,
    usedAvgReferenceSec,
    usedReferencedCount,
  ]);
  const libtvPromoFolds = useMemo(() => {
    if (!model || !activeResolution || libtvCreditParts == null) {
      return [];
    }
    const modelId = resolveLibtvRateModelId(model.canonicalId);
    const folds: number[] = [];
    if (libtvCreditParts.referencedCredits > 0) {
      const promo = matchLibtvPricePromo(libtvConfig.promos, {
        canonicalId: modelId,
        resolution: activeResolution,
        withReference: true,
      });
      if (promo) {
        folds.push(promo.discountFold);
      }
    }
    if (libtvCreditParts.plainCredits > 0) {
      const promo = matchLibtvPricePromo(libtvConfig.promos, {
        canonicalId: modelId,
        resolution: activeResolution,
        withReference: false,
      });
      if (promo && !folds.includes(promo.discountFold)) {
        folds.push(promo.discountFold);
      }
    }
    return folds;
  }, [activeResolution, libtvConfig.promos, libtvCreditParts, model]);
  const libtvCredits = useMemo(() => {
    if (!model || !activeResolution || libtvCreditParts == null) {
      return null;
    }
    const modelId = resolveLibtvRateModelId(model.canonicalId);
    const referencedPromo =
      libtvCreditParts.referencedCredits > 0
        ? matchLibtvPricePromo(libtvConfig.promos, {
            canonicalId: modelId,
            resolution: activeResolution,
            withReference: true,
          })
        : null;
    const plainPromo =
      libtvCreditParts.plainCredits > 0
        ? matchLibtvPricePromo(libtvConfig.promos, {
            canonicalId: modelId,
            resolution: activeResolution,
            withReference: false,
          })
        : null;
    return (
      applyLibtvCreditsPromo(
        libtvCreditParts.referencedCredits,
        referencedPromo
      ) + applyLibtvCreditsPromo(libtvCreditParts.plainCredits, plainPromo)
    );
  }, [activeResolution, libtvConfig.promos, libtvCreditParts, model]);

  useEffect(() => {
    if (libtvCredits == null) {
      return;
    }
    const matched = matchLowestCoveringPlan(libtvConfig.plans, libtvCredits);
    if (matched) {
      setLibtvPlanId(matched.id);
    }
  }, [libtvCredits, libtvConfig.plans]);

  const selectedLibtvPlan =
    libtvConfig.plans.find((plan) => plan.id === libtvPlanId) ??
    libtvConfig.plans[0];
  const libtvAccountCount =
    libtvCredits != null && selectedLibtvPlan
      ? computePlanAccountCount(libtvCredits, selectedLibtvPlan.credits)
      : 1;
  const libtvPercent =
    libtvCredits != null && selectedLibtvPlan
      ? creditSharePercent(
          libtvCredits,
          selectedLibtvPlan.credits * libtvAccountCount
        )
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
  const planMonthlyLabel = (plan: LibtvPlan, priceYuan: number): string =>
    t("landing.planMonthly", {
      name: planName(plan),
      price: priceYuan.toFixed(0),
    });
  const planOptionLabel = (plan: LibtvPlan): string =>
    t("landing.planOption", {
      name: planName(plan),
      credits: plan.credits,
      price: plan.priceYuan.toFixed(0),
    });
  const libtvPlanLabel = selectedLibtvPlan
    ? planMonthlyLabel(
        selectedLibtvPlan,
        selectedLibtvPlan.priceYuan * libtvAccountCount
      )
    : t("landing.compareUnavailable");

  const officialCostYuan =
    estimate == null
      ? null
      : platformPromo
        ? applyVideoPricePromoFold(
            estimate.costYuan,
            platformPromo.discountFold
          )
        : estimate.costYuan;
  const officialTokens =
    estimate == null
      ? null
      : platformPromo
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
  const libtvConvertedYuan =
    libtvCredits == null || !selectedLibtvPlan
      ? null
      : computeLibtvConvertedYuan(libtvCredits, selectedLibtvPlan);
  const libtvRate =
    libtvConvertedYuan == null || durationSec <= 0
      ? null
      : libtvConvertedYuan / durationSec;

  const modelLabel = model?.displayName ?? t("landing.compareUnavailable");
  const promoFoldLabel = (fold: number): string =>
    t("landing.promoFoldHint", { fold: formatVideoPricePromoFold(fold) });
  const promoRows = useMemo(() => {
    const rows: PromoDisplayRow[] = [];
    for (const entry of models) {
      for (const promo of entry.promos ?? []) {
        rows.push({
          id: `official-${entry.canonicalId}-${promo.id}`,
          platform: t("landing.platformOfficial"),
          model: entry.displayName,
          resolution: billingResolutionLabel(promo.resolution),
          needsVideoReference: false,
          foldLabel: t("landing.promoFoldHint", {
            fold: formatVideoPricePromoFold(promo.discountFold),
          }),
          startsAt: promo.startsAt,
          endsAt: promo.endsAt,
        });
      }
    }
    for (const promo of libtvConfig.promos) {
      const modelId = resolveLibtvRateModelId(promo.canonicalId);
      const named = models.find(
        (entry) => entry.canonicalId === promo.canonicalId
      );
      rows.push({
        id: `libtv-${promo.id}`,
        platform: t("landing.compareLibtv"),
        model: named?.displayName ?? t(LIBTV_MODEL_LABEL_KEY[modelId]),
        resolution: billingResolutionLabel(promo.resolution),
        needsVideoReference: promo.withReference,
        foldLabel: t("landing.promoFoldHint", {
          fold: formatVideoPricePromoFold(promo.discountFold),
        }),
        startsAt: promo.startsAt,
        endsAt: promo.endsAt,
      });
    }
    return rows;
  }, [libtvConfig.promos, models, t]);

  return (
    <section id="pricing" className="scroll-mt-20 py-8 md:py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 md:px-6">
        <div className={cn("rounded-xl border p-4 md:p-5", LANDING_CARD_CLASS)}>
          <h2 className="text-lg font-semibold">{t("landing.billingTitle")}</h2>

          <div className="mt-4 flex flex-col gap-2">
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
              {t("landing.compareDisclaimer")}
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
                      {t("landing.tableTokens")}
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
                          {formatVideoTokenMillions(officialTokens)}
                          {platformPromo ? (
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
                  <tr>
                    <td className="overflow-hidden px-2 py-3 font-medium whitespace-nowrap">
                      {t("landing.compareLibtv")}
                    </td>
                    <td className="overflow-hidden px-2 py-3">
                      <span className="inline-flex min-w-0 flex-wrap items-center gap-x-0.5 gap-y-0.5">
                        {selectedLibtvPlan ? (
                          <>
                            <span className="font-medium">
                              {planName(selectedLibtvPlan)}
                            </span>
                            {libtvAccountCount > 1 ? (
                              <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      className="border-b border-dashed border-muted-foreground text-[11px] leading-none text-muted-foreground"
                                    >
                                      {t("landing.planAccounts", {
                                        count: libtvAccountCount,
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
                                  selectedLibtvPlan.priceYuan *
                                  libtvAccountCount
                                ).toFixed(0),
                              })}
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
                              aria-label={libtvPlanLabel}
                            >
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent
                            align="start"
                            className="w-auto min-w-52 max-w-80 p-1"
                          >
                            <div className="grid gap-0.5">
                              {libtvConfig.plans.map((plan) => (
                                <button
                                  key={plan.id}
                                  type="button"
                                  className={cn(
                                    "rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                                    plan.id === selectedLibtvPlan?.id
                                      ? "bg-muted text-foreground"
                                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                                  )}
                                  onClick={() => {
                                    setLibtvPlanId(plan.id);
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
                      {libtvCredits == null ||
                      libtvPercent == null ||
                      !selectedLibtvPlan ? (
                        t("landing.compareUnavailable")
                      ) : (
                        <span>
                          <span>
                            {t("landing.comparePointsBefore", {
                              points: libtvCredits,
                            })}
                            <TooltipProvider delayDuration={200}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    className="border-b border-dashed border-muted-foreground p-0 text-foreground"
                                  >
                                    {t("landing.comparePointsPercentValue", {
                                      percent: libtvPercent,
                                    })}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {t("landing.comparePointsTotal", {
                                    total:
                                      selectedLibtvPlan.credits *
                                      libtvAccountCount,
                                  })}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            {t("landing.comparePointsAfter")}
                          </span>
                          {libtvPromoFolds.map((fold) => (
                            <DiscountMark
                              key={fold}
                              label={promoFoldLabel(fold)}
                            />
                          ))}
                        </span>
                      )}
                    </td>
                    <td className="overflow-hidden px-2 py-3 whitespace-nowrap">
                      {libtvRate == null
                        ? t("landing.compareUnavailable")
                        : t("landing.rateValue", {
                            rate: libtvRate.toFixed(3),
                          })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        {promoRows.length > 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 px-4 py-3 md:px-5">
            <h2 className="text-sm font-medium text-muted-foreground">
              {t("landing.promoTitle")}
            </h2>
            <div className="mt-2 grid gap-1.5">
              {promoRows.map((row) => (
                <div
                  key={row.id}
                  className="flex flex-wrap items-center gap-x-2 gap-y-1"
                >
                  <PromoChip>{row.platform}</PromoChip>
                  <PromoChip>{row.model}</PromoChip>
                  {row.resolution ? (
                    <PromoChip>{row.resolution}</PromoChip>
                  ) : null}
                  {row.needsVideoReference ? (
                    <PromoChip>
                      {t("landing.promoNeedVideoReference")}
                    </PromoChip>
                  ) : null}
                  <PromoChip emphasis>{row.foldLabel}</PromoChip>
                  <span className="text-xs text-muted-foreground">
                    {row.startsAt}–{row.endsAt}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
