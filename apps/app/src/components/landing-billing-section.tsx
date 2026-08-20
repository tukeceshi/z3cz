import {
  type AppLocale,
  applyVideoPricePromoFold,
  computeCostPerOutputSecond,
  computeLibtvConvertedYuan,
  computeLibtvCredits,
  computeLibtvCreditsForClipSplit,
  computePlanAccountCount,
  computeSplitVideoPriceEstimateForModel,
  computeVideoPriceEstimateForModel,
  DEFAULT_HOMEPAGE_VIDEO_SCENARIOS,
  formatVideoPricePromoDateRange,
  formatVideoPricePromoFold,
  formatVideoTokenMillions,
  type HomepageVideoScenario,
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
  type VideoPriceCompetitor,
} from "@dafthunk/types";
import ChevronDown from "lucide-react/icons/chevron-down";
import TriangleAlert from "lucide-react/icons/triangle-alert";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  landingMenuContentClass,
  landingMenuItemClass,
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { TranslationKey } from "@/i18n";
import {
  HINT_TOOLTIP_CONTENT_CLASS,
  HoverClickHint,
} from "@/pages/organization-ai-interfaces/dashed-hint-popover";
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
export { LANDING_TIME_MAX_SEC };
type TimeUnit = "sec" | "min";
export type LandingBillingTimeUnit = TimeUnit;
const DURATION_INPUT_CLASS = cn(
  "h-7 w-16 rounded-md bg-muted/45 px-1.5 py-0.5 text-center text-xs outline-none transition-colors",
  "focus:bg-muted/65",
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
);
const LANDING_CARD_CLASS =
  "bg-white dark:bg-neutral-800 dark:border-neutral-700";
const COMPACT_BUTTON_CLASS =
  "inline-flex h-7 items-center gap-1 rounded-md border border-border/70 bg-muted/20 px-2 text-xs text-foreground hover:bg-muted/40";
const COMPACT_CHIP_TRIGGER_CLASS =
  "inline-flex h-full items-center gap-1 bg-transparent px-0 text-inherit hover:text-foreground";

function readBillingRatio(value: string): BillingRatio {
  return BILLING_RATIOS.includes(value as BillingRatio)
    ? (value as BillingRatio)
    : LANDING_DEFAULT_RATIO;
}

export function applyScenarioPreset(
  scenario: HomepageVideoScenario,
  setters: {
    readonly setScenarioId: (id: string) => void;
    readonly setCanonicalId: (id: string) => void;
    readonly setRatio: (ratio: BillingRatio) => void;
    readonly setResolution: (resolution: string) => void;
    readonly setDurationSec: (seconds: number) => void;
    readonly setDurationUnit: (unit: TimeUnit) => void;
    readonly setReferencedClipCount: (count: number) => void;
    readonly setAvgReferenceSec: (seconds: number) => void;
    readonly setReferenceSec: (seconds: number) => void;
    readonly setReferenceClipOpen: (open: boolean) => void;
  }
): void {
  const { params } = scenario;
  setters.setScenarioId(scenario.id);
  setters.setCanonicalId(params.canonicalId);
  setters.setRatio(readBillingRatio(params.ratio));
  setters.setResolution(params.resolution);
  setters.setDurationSec(params.durationSec);
  setters.setDurationUnit(scenarioTimeUnit(params.durationSec));
  setters.setReferencedClipCount(params.referencedClipCount);
  setters.setAvgReferenceSec(params.avgReferenceSec);
  if (scenario.id === "clip") {
    setters.setReferenceSec(0);
  }
  setters.setReferenceClipOpen(false);
}
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

function creditSharePercent(credits: number, total: number): string {
  if (total <= 0) {
    return "0";
  }
  const raw = (credits / total) * 100;
  if (raw < 1) {
    return raw.toFixed(1);
  }
  return String(Math.round(raw));
}

function formatCompactUnit(
  value: number,
  divisor: number,
  suffix: string
): string {
  const scaled = value / divisor;
  if (Number.isInteger(scaled)) {
    return `${scaled}${suffix}`;
  }
  const fixed = scaled.toFixed(1);
  return fixed.endsWith(".0")
    ? `${Math.round(scaled)}${suffix}`
    : `${fixed}${suffix}`;
}

export function formatLandingCompareCredits(
  value: number,
  locale: AppLocale
): string {
  const rounded = Math.round(value);
  if (locale === "en") {
    if (rounded >= 1000) {
      return formatCompactUnit(rounded, 1000, "K");
    }
    return String(rounded);
  }
  if (rounded >= 10000) {
    return formatCompactUnit(rounded, 10000, "W");
  }
  return String(rounded);
}

export const LANDING_COMPARE_COMPETITOR_ROW_CLASS = "h-14";
export const LANDING_COMPARE_COMPETITOR_CELL_CLASS =
  "px-2 align-middle whitespace-nowrap";
export const LANDING_COMPARE_PLAN_SLOT_CLASS =
  "grid h-10 grid-rows-2 items-center gap-0.5";
export const LANDING_COMPARE_PLAN_PRIMARY_CLASS =
  "inline-flex min-w-0 items-center gap-x-0.5 leading-tight";
export const LANDING_COMPARE_PLAN_PRIMARY_CENTERED_CLASS =
  "row-span-2 flex items-center";

export function LandingComparePlanTableHeader() {
  const { t } = useTranslation();

  return (
    <span className="inline-flex items-center gap-1">
      {t("landing.tableLevel")}
      <HoverClickHint
        content={
          <div className="grid gap-1">
            <p>{t("landing.tableLevelBillingHintLine1")}</p>
            <p>{t("landing.tableLevelBillingHintLine2")}</p>
            <p>{t("landing.tableLevelBillingHintLine3")}</p>
          </div>
        }
        contentClassName={HINT_TOOLTIP_CONTENT_CLASS}
      >
        <button
          type="button"
          className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-red-400/70 transition-colors hover:text-red-500/85"
          aria-label={t("landing.tableLevelBillingHint")}
        >
          <TriangleAlert className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </HoverClickHint>
    </span>
  );
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

export function TimeAmountControl(props: {
  readonly title?: string;
  readonly hideTitle?: boolean;
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
      {!props.hideTitle && props.title ? (
        <span className="shrink-0 text-xs font-medium text-foreground">
          {props.title}
        </span>
      ) : null}
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

export function ReferenceClipControl(props: {
  readonly clipCount: number;
  readonly clipDurationSec: number;
  readonly referencedCount: number;
  readonly avgReferenceSec: number;
  readonly maxAvgReferenceSec: number;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onReferencedCountChange: (next: number) => void;
  readonly onAvgReferenceSecChange: (next: number) => void;
  readonly variant?: "default" | "chip";
  readonly modal?: boolean;
  readonly triggerClassName?: string;
  readonly hideChevron?: boolean;
  readonly popoverTitle?: string;
  readonly contentClassName?: string;
  readonly triggerLabel?: string;
}) {
  const { t } = useTranslation();
  const clipSeconds = Math.round(props.clipDurationSec);
  const triggerClassName =
    props.triggerClassName ??
    (props.variant === "chip"
      ? COMPACT_CHIP_TRIGGER_CLASS
      : COMPACT_BUTTON_CLASS);

  const popover = (
    <Popover
      modal={props.modal ?? true}
      open={props.open}
      onOpenChange={props.onOpenChange}
    >
      <PopoverTrigger asChild>
        <button type="button" className={triggerClassName}>
          <span>
            {props.triggerLabel ??
              t("landing.referenceClipSummary", {
                count: props.referencedCount,
                seconds: props.avgReferenceSec,
              })}
          </span>
          {props.hideChevron ? null : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={props.contentClassName ?? "w-auto min-w-56 p-2.5"}
      >
        <div className="grid gap-2 text-xs">
          {props.popoverTitle ? (
            <p className="block w-full font-medium text-foreground">
              {props.popoverTitle}
            </p>
          ) : null}
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
  );

  if (props.variant === "chip") {
    return popover;
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="shrink-0 text-xs font-medium">
        {t("landing.referenceTitle")}
      </span>
      {popover}
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

export function buildLandingPromoGroups(
  models: readonly PublicVideoPriceEstimateModel[],
  competitors: readonly VideoPriceCompetitor[],
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
): readonly PromoDisplayGroup[] {
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
        dateRange: formatVideoPricePromoDateRange(promo.startsAt, promo.endsAt),
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
        dateRange: formatVideoPricePromoDateRange(promo.startsAt, promo.endsAt),
      });
    }
  }
  return groupPromoRowsByPlatform(rows);
}

function formatPromoItemTags(
  row: PromoDisplayRow,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
): string {
  const parts: string[] = [];
  if (row.model) {
    parts.push(row.model);
  }
  if (row.resolution) {
    parts.push(row.resolution);
  }
  if (row.needsVideoReference) {
    parts.push(t("landing.promoNeedVideoReference"));
  }
  parts.push(row.foldLabel);
  if (row.dateRange) {
    parts.push(row.dateRange);
  }
  return parts.join(" · ");
}

function PromoPlatformCard(props: {
  readonly group: PromoDisplayGroup;
  readonly onOpenExternal: (next: { name: string; url: string }) => void;
}) {
  const { t } = useTranslation();

  const handleOpenPlatform = () => {
    const url = props.group.platformUrl;
    if (!url) {
      return;
    }
    props.onOpenExternal({
      name: props.group.platform,
      url,
    });
  };

  return (
    <article className="landing-promo-card">
      <div className="landing-promo-card-head">
        {props.group.platformUrl ? (
          <button
            type="button"
            className="landing-promo-card-title landing-promo-card-title-link truncate"
            onClick={handleOpenPlatform}
          >
            {props.group.platform}
          </button>
        ) : (
          <h3 className="landing-promo-card-title truncate">
            {props.group.platform}
          </h3>
        )}
        <span className="landing-promo-badge">
          {t("landing.promoItemCount", { count: props.group.items.length })}
        </span>
      </div>
      <div className="landing-promo-card-body">
        {props.group.items.map((row) => (
          <p key={row.id} className="landing-promo-card-desc">
            {formatPromoItemTags(row, t)}
          </p>
        ))}
      </div>
    </article>
  );
}

export function LandingPromoDiscountSection(props: {
  readonly id?: string;
  readonly groups: readonly PromoDisplayGroup[];
  readonly className?: string;
  readonly onOpenExternal: (next: { name: string; url: string }) => void;
}) {
  const { t } = useTranslation();
  if (props.groups.length === 0) {
    return null;
  }

  const handleBackToCalc = () => {
    document
      .getElementById("landing-demo")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div
      id={props.id}
      className={cn("landing-promo scroll-mt-24", props.className)}
    >
      <div className="landing-promo-header">
        <div className="landing-promo-header-copy">
          <h2 className="landing-promo-heading">
            {t("landing.promoSectionTitle")}
          </h2>
          <p className="landing-promo-subheading">
            {t("landing.promoSectionDesc")}
          </p>
        </div>
        <button
          type="button"
          className="landing-promo-link"
          onClick={handleBackToCalc}
        >
          {t("landing.promoBackToCalc")}
          <span aria-hidden>↗</span>
        </button>
      </div>
      <div className="landing-promo-grid-shell">
        <div className="landing-promo-grid">
          {props.groups.map((group) => (
            <PromoPlatformCard
              key={group.platform}
              group={group}
              onOpenExternal={props.onOpenExternal}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function LandingCompetitorCompareRow(props: {
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
  readonly useLandingMenu?: boolean;
}) {
  const { t, locale } = useTranslation();
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
    <tr
      className={cn(
        LANDING_COMPARE_COMPETITOR_ROW_CLASS,
        props.bordered ? "border-b" : undefined
      )}
    >
      <td className={cn(LANDING_COMPARE_COMPETITOR_CELL_CLASS, "font-medium")}>
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
      <td className="px-2 align-middle">
        {selectedPlan && selectedCyclePrice ? (
          <div className={LANDING_COMPARE_PLAN_SLOT_CLASS}>
            <span
              className={cn(
                LANDING_COMPARE_PLAN_PRIMARY_CLASS,
                planCycle === "monthly"
                  ? LANDING_COMPARE_PLAN_PRIMARY_CENTERED_CLASS
                  : undefined
              )}
            >
              <span className="font-medium">{planName(selectedPlan)}</span>
              {accountCount > 1 ? (
                <HoverClickHint
                  content={t("landing.planAccountsHint")}
                  contentClassName={HINT_TOOLTIP_CONTENT_CLASS}
                >
                  <button
                    type="button"
                    className="border-b border-dashed border-muted-foreground text-[11px] leading-none text-muted-foreground"
                  >
                    {t("landing.planAccounts", {
                      count: accountCount,
                    })}
                  </button>
                </HoverClickHint>
              ) : null}
              <span className="text-muted-foreground">
                {t("landing.planPricePart", {
                  price: (
                    selectedCyclePrice.monthlyYuan * accountCount
                  ).toFixed(0),
                })}
              </span>
              <Popover
                modal={!props.useLandingMenu}
                open={planOpen}
                onOpenChange={setPlanOpen}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground",
                      props.useLandingMenu
                        ? "hover:bg-[#f0ede6] dark:hover:bg-neutral-800"
                        : "hover:bg-muted"
                    )}
                    aria-label={planLabel}
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className={
                    props.useLandingMenu
                      ? landingMenuContentClass("min-w-52 max-w-80")
                      : "w-auto min-w-52 max-w-80 p-1"
                  }
                >
                  {availableCycles.length > 1 ? (
                    <div className="mb-1 flex gap-0.5">
                      {availableCycles.map((cycle) => (
                        <button
                          key={cycle}
                          type="button"
                          className={cn(
                            "flex-1 px-2 py-1 text-xs transition-colors",
                            props.useLandingMenu
                              ? cn(
                                  landingMenuItemClass(cycle === planCycle),
                                  "text-center"
                                )
                              : cn(
                                  "rounded-md",
                                  cycle === planCycle
                                    ? "bg-muted text-foreground"
                                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                                )
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
                        className={
                          props.useLandingMenu
                            ? landingMenuItemClass(plan.id === selectedPlan?.id)
                            : cn(
                                "rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                                plan.id === selectedPlan?.id
                                  ? "bg-muted text-foreground"
                                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                              )
                        }
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
            {planCycle === "monthly" ? null : (
              <span className="leading-none">
                <HoverClickHint
                  content={t("landing.planCycleRiskHint")}
                  contentClassName={HINT_TOOLTIP_CONTENT_CLASS}
                >
                  <button
                    type="button"
                    className="w-fit border-b border-dashed border-muted-foreground text-[11px] leading-none text-muted-foreground"
                  >
                    {t("landing.planCycleTotal", {
                      price: (
                        selectedCyclePrice.totalYuan * accountCount
                      ).toFixed(0),
                      unit: planCycleUnit(planCycle),
                    })}
                  </button>
                </HoverClickHint>
              </span>
            )}
          </div>
        ) : (
          <span>{t("landing.compareUnavailable")}</span>
        )}
      </td>
      <td className={LANDING_COMPARE_COMPETITOR_CELL_CLASS}>
        {credits == null || percent == null || !selectedPlan ? (
          t("landing.compareUnavailable")
        ) : (
          <span>
            <span>
              {formatLandingCompareCredits(credits, locale)}
              {" ("}
              <HoverClickHint
                content={
                  <div className="grid gap-0.5">
                    <p>
                      {t("landing.comparePointsTotal", {
                        total: selectedPlan.credits * accountCount,
                      })}
                    </p>
                    <p>
                      {t("landing.comparePointsUsage", {
                        points: credits,
                      })}
                    </p>
                  </div>
                }
                contentClassName={HINT_TOOLTIP_CONTENT_CLASS}
              >
                <button
                  type="button"
                  className="border-b border-dashed border-muted-foreground p-0 text-foreground"
                >
                  {t("landing.comparePointsPercentValue", {
                    percent,
                  })}
                </button>
              </HoverClickHint>
              {")"}
            </span>
            {props.excludePromo
              ? null
              : promoFolds.map((fold) => (
                  <DiscountMark key={fold} label={props.promoFoldLabel(fold)} />
                ))}
          </span>
        )}
      </td>
      <td className={LANDING_COMPARE_COMPETITOR_CELL_CLASS}>
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
  const { models, competitors } = usePublicVideoPriceEstimates();
  const [pendingExternal, setPendingExternal] = useState<{
    name: string;
    url: string;
  } | null>(null);
  const promoGroups = useMemo(
    () => buildLandingPromoGroups(models, competitors, t),
    [competitors, models, t]
  );

  if (promoGroups.length === 0) {
    return null;
  }

  return (
    <section id="pricing" className="scroll-mt-20 py-8 md:py-12">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <LandingPromoDiscountSection
          id="landing-promo"
          groups={promoGroups}
          onOpenExternal={setPendingExternal}
        />
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
