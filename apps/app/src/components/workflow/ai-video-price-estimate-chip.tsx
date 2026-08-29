import type { ReactNode } from "react";
import {
  applyVideoPriceEstimateDisplayFolds,
  computeCostPerOutputSecond,
  computeOptimalReferenceSeconds,
  computePackTokens,
  computeVideoPriceEstimateForModel,
  formatVideoBillingTokensDisplay,
  formatVideoPriceEstimateCostDisplay,
  type VideoPriceEstimateResult,
} from "@dafthunk/types";
import type { WorkflowMediaValue } from "@dafthunk/types";
import { getResourceIdFromValue } from "@dafthunk/types";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";

import { useAuth } from "@/components/auth-context";
import { useTranslation } from "@/components/locale-provider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { resolveMediaDisplayUrlSet } from "@/services/resolve-resource-display-url";
import { cn } from "@/utils/utils";

import { AI_BOTTOM_CHIP_CLASS } from "./ai-bottom-chip";
import { probeMediaDuration } from "./studio-media-file-meta";

function readGenerationFieldString(
  values: Readonly<Record<string, unknown>>,
  fieldName: string,
  fallback: string
): string {
  const value = values[fieldName];
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  return String(value);
}

function readGenerationFieldNumber(
  values: Readonly<Record<string, unknown>>,
  fieldName: string,
  fallback: number
): number {
  const value = values[fieldName];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function useSummedReferenceVideoDurationSeconds(
  mediaList: readonly WorkflowMediaValue[]
): number {
  const { organization } = useAuth();
  const { id: workflowId } = useParams<{ id: string }>();
  const orgId = organization?.id;
  const mediaKey = mediaList
    .map((entry) => getResourceIdFromValue(entry) ?? "")
    .join("|");
  const [totalSec, setTotalSec] = useState(0);

  useEffect(() => {
    if (mediaList.length === 0 || !orgId || !workflowId) {
      setTotalSec(0);
      return;
    }

    let cancelled = false;

    void (async () => {
      let sum = 0;
      for (const media of mediaList) {
        try {
          const urlSet = await resolveMediaDisplayUrlSet({
            media,
            organizationId: orgId,
            workflowId,
            nodeType: "ai-video",
          });
          const src = urlSet.full ?? urlSet.preview;
          if (!src) {
            continue;
          }
          sum += await probeMediaDuration(src, "video");
        } catch {
          // Skip videos we cannot probe yet.
        }
      }
      if (!cancelled) {
        setTotalSec(sum);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mediaKey, mediaList, orgId, workflowId]);

  return totalSec;
}

export interface AiVideoPriceEstimateChipProps {
  readonly canonicalId: string;
  readonly priceWithoutVideo: number;
  readonly priceWithVideo: number;
  readonly baseline480pWithoutVideo: number | null;
  readonly generationValues: Readonly<Record<string, unknown>>;
  readonly referenceVideoMedia: readonly WorkflowMediaValue[];
  readonly displayFolds?: readonly number[];
  readonly disabled?: boolean;
}

function PriceEstimateDetailRow({
  label,
  value,
  labelNode,
}: {
  readonly label: string;
  readonly value: string;
  readonly labelNode?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      {labelNode ?? <span className="text-muted-foreground">{label}</span>}
      <span className="text-right font-medium tabular-nums">{value}</span>
    </div>
  );
}

function DashedHelpLabel({
  label,
  help,
}: {
  readonly label: string;
  readonly help: string;
}) {
  return (
    <Popover modal={false}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="border-b border-dashed border-muted-foreground/60 text-left text-muted-foreground hover:text-foreground"
          onClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
        >
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className="w-56 p-2.5 text-[11px] leading-relaxed dark:border-neutral-700 dark:bg-neutral-800"
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <p>{help}</p>
      </PopoverContent>
    </Popover>
  );
}

function PackTokenLabel({ label }: { readonly label: string }) {
  const { t } = useTranslation();

  return (
    <DashedHelpLabel
      label={label}
      help={t("workflow.aiVideoPanel.priceEstimatePackTokensHelp")}
    />
  );
}

function PriceEstimateDetail({
  estimate,
  displayCostYuan,
  packTokens,
  optimalReferenceSeconds,
  showOptimalReferenceSeconds,
}: {
  readonly estimate: VideoPriceEstimateResult;
  readonly displayCostYuan: number;
  readonly packTokens: number | null;
  readonly optimalReferenceSeconds: number;
  readonly showOptimalReferenceSeconds: boolean;
}) {
  const { t } = useTranslation();
  const costPerSecond = computeCostPerOutputSecond(
    displayCostYuan,
    estimate.outputDurationSec
  );

  return (
    <div className="space-y-2">
      <PriceEstimateDetailRow
        label={t("workflow.aiVideoPanel.priceEstimateBillingTokens")}
        value={formatVideoBillingTokensDisplay(estimate.billingTokens)}
      />
      {showOptimalReferenceSeconds ? (
        <PriceEstimateDetailRow
          label={t("workflow.aiVideoPanel.priceEstimateOptimalReferenceSec")}
          value={t("workflow.aiVideoPanel.priceEstimateOptimalReferenceSecValue", {
            seconds: optimalReferenceSeconds,
          })}
          labelNode={
            <DashedHelpLabel
              label={t("workflow.aiVideoPanel.priceEstimateOptimalReferenceSec")}
              help={t("workflow.aiVideoPanel.priceEstimateOptimalReferenceSecHelp")}
            />
          }
        />
      ) : null}
      {packTokens != null ? (
        <PriceEstimateDetailRow
          label={t("workflow.aiVideoPanel.priceEstimatePackTokens")}
          value={formatVideoBillingTokensDisplay(packTokens)}
          labelNode={
            <PackTokenLabel
              label={t("workflow.aiVideoPanel.priceEstimatePackTokens")}
            />
          }
        />
      ) : null}
      <PriceEstimateDetailRow
        label={t("workflow.aiVideoPanel.priceEstimateCost")}
        value={t("workflow.aiVideoPanel.priceEstimateCostValue", {
          cost: displayCostYuan.toFixed(2),
        })}
      />
      <PriceEstimateDetailRow
        label={t("workflow.aiVideoPanel.priceEstimateUnitRate")}
        value={t("workflow.aiVideoPanel.priceEstimateUnitRateValue", {
          rate: costPerSecond.toFixed(2),
        })}
      />
      <p className="pt-1 text-[11px] leading-relaxed text-muted-foreground">
        {t("workflow.aiVideoPanel.priceEstimateDisclaimer")}
      </p>
    </div>
  );
}

export function AiVideoPriceEstimateChip({
  canonicalId,
  priceWithoutVideo,
  priceWithVideo,
  baseline480pWithoutVideo,
  generationValues,
  referenceVideoMedia,
  displayFolds = [],
  disabled = false,
}: AiVideoPriceEstimateChipProps) {
  const inputDurationSec = useSummedReferenceVideoDurationSeconds(
    referenceVideoMedia
  );
  const hasReferenceVideo = referenceVideoMedia.length > 0;
  const outputDurationSec = readGenerationFieldNumber(
    generationValues,
    "duration",
    5
  );
  const resolution = readGenerationFieldString(
    generationValues,
    "resolution",
    "720p"
  );
  const ratio = readGenerationFieldString(generationValues, "ratio", "16:9");

  const estimate = useMemo(
    () =>
      computeVideoPriceEstimateForModel({
        canonicalId,
        resolution,
        ratio,
        outputDurationSec,
        inputDurationSec,
        hasReferenceVideo,
        priceWithoutVideo,
        priceWithVideo,
      }),
    [
      canonicalId,
      hasReferenceVideo,
      inputDurationSec,
      outputDurationSec,
      priceWithVideo,
      priceWithoutVideo,
      ratio,
      resolution,
    ]
  );

  const displayCostYuan = useMemo(
    () => applyVideoPriceEstimateDisplayFolds(estimate.costYuan, displayFolds),
    [displayFolds, estimate.costYuan]
  );

  const packTokens = useMemo(() => {
    if (baseline480pWithoutVideo == null) {
      return null;
    }
    return computePackTokens({
      billingTokens: estimate.billingTokens,
      unitPrice: estimate.unitPrice,
      baseline480pWithoutVideo,
    });
  }, [baseline480pWithoutVideo, estimate.billingTokens, estimate.unitPrice]);

  const optimalReferenceSeconds = useMemo(
    () => computeOptimalReferenceSeconds(outputDurationSec),
    [outputDurationSec]
  );
  const showOptimalReferenceSeconds =
    priceWithVideo > 0 && optimalReferenceSeconds > 0;

  const summary = formatVideoPriceEstimateCostDisplay(displayCostYuan);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(AI_BOTTOM_CHIP_CLASS, "max-w-[140px]")}
        >
          <span className="truncate">{summary}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className="w-52 p-3 dark:border-neutral-700 dark:bg-neutral-800"
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <PriceEstimateDetail
          estimate={estimate}
          displayCostYuan={displayCostYuan}
          packTokens={packTokens}
          optimalReferenceSeconds={optimalReferenceSeconds}
          showOptimalReferenceSeconds={showOptimalReferenceSeconds}
        />
      </PopoverContent>
    </Popover>
  );
}
