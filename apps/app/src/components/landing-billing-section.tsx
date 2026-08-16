import {
  DEFAULT_LIBTV_COMPARISON_CONFIG,
  LANDING_VIDEO_PRICE_MODEL_ID,
  LANDING_VOLCANO_MIN_RECHARGE_YUAN,
  VIDEO_DURATION_MAX,
  VIDEO_DURATION_MIN,
  VIDEO_RATIO_OPTIONS,
  computeCostPerOutputSecond,
  computeLibtvConvertedYuan,
  computeLibtvCredits,
  computeVideoPriceEstimateForModel,
  formatVideoTokenMillions,
  mergeLibtvComparisonConfig,
  readVideoPriceEstimateTier,
} from "@dafthunk/types";
import Upload from "lucide-react/icons/upload";
import X from "lucide-react/icons/x";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useTranslation } from "@/components/locale-provider";
import { DurationDragSlider } from "@/components/workflow/duration-drag-slider";
import { normalizeGenerativeCardUploadFile } from "@/components/workflow/generative-card-upload-utils";
import { probeMediaDuration } from "@/components/workflow/studio-media-file-meta";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePublicVideoPriceEstimates } from "@/services/video-price-estimates-service";
import { cn } from "@/utils/utils";

const BILLING_RATIOS = VIDEO_RATIO_OPTIONS.filter(
  (ratio) => ratio !== "adaptive"
);
const VIDEO_ACCEPT = ".mp4,.webm,.mov,.mkv,.m4v,video/*";
const DURATION_INPUT_CLASS = cn(
  "h-5 w-12 rounded-md bg-muted/45 px-1.5 py-0.5 text-center text-xs outline-none transition-colors",
  "focus:bg-muted/65",
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
);

const LANDING_CARD_CLASS = "bg-white dark:bg-neutral-800 dark:border-neutral-700";

interface ReferenceFile {
  readonly id: string;
  readonly name: string;
  readonly durationSec: number;
  readonly objectUrl: string;
}

function clampDuration(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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

function RatioPreviewIcon({ value }: { readonly value: string }) {
  return (
    <span
      className={cn(
        "rounded-[2px] border border-current text-foreground",
        ratioFrameClass(value)
      )}
    />
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
            "min-w-0 flex-1 rounded-md px-2 py-1.5 text-xs transition-colors",
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

function DurationControl(props: {
  readonly title: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly onChange: (next: number) => void;
}) {
  const [localDuration, setLocalDuration] = useState(props.value);
  const [inputDraft, setInputDraft] = useState<string | null>(null);
  const isDraggingRef = useRef(false);
  const isInputFocusedRef = useRef(false);

  useEffect(() => {
    if (!isDraggingRef.current && !isInputFocusedRef.current) {
      setLocalDuration(props.value);
    }
  }, [props.value]);

  const commitDuration = useCallback(
    (next: number) => {
      const clamped = clampDuration(next, props.min, props.max);
      setLocalDuration(clamped);
      props.onChange(clamped);
    },
    [props.min, props.max, props.onChange]
  );

  return (
    <div className="grid gap-1.5">
      <Label className="text-xs font-medium text-foreground">{props.title}</Label>
      <div className="flex items-center gap-2">
        <DurationDragSlider
          min={props.min}
          max={props.max}
          value={localDuration}
          onDragStart={() => {
            isDraggingRef.current = true;
            setInputDraft(null);
          }}
          onPreview={setLocalDuration}
          onCommit={(next) => {
            isDraggingRef.current = false;
            commitDuration(next);
          }}
        />
        <div className="flex shrink-0 items-center gap-1">
          <Input
            type="text"
            inputMode="numeric"
            value={inputDraft ?? String(localDuration)}
            className={DURATION_INPUT_CLASS}
            onFocus={() => {
              isInputFocusedRef.current = true;
              setInputDraft(String(localDuration));
            }}
            onChange={(event) => setInputDraft(event.target.value)}
            onBlur={(event) => {
              isInputFocusedRef.current = false;
              setInputDraft(null);
              const parsed = Number(event.target.value);
              if (Number.isFinite(parsed)) {
                commitDuration(parsed);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
            }}
          />
          <span className="text-xs text-muted-foreground">s</span>
        </div>
      </div>
    </div>
  );
}

export function LandingBillingSection() {
  const { t } = useTranslation();
  const { models, libtv, isEstimatesLoading } = usePublicVideoPriceEstimates();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [canonicalId, setCanonicalId] = useState(LANDING_VIDEO_PRICE_MODEL_ID);
  const model =
    models.find((entry) => entry.canonicalId === canonicalId) ??
    models.find((entry) => entry.canonicalId === LANDING_VIDEO_PRICE_MODEL_ID) ??
    models[0];

  const resolutions = model?.tiers.map((tier) => tier.resolution) ?? [];
  const [resolution, setResolution] = useState("");
  const [ratio, setRatio] = useState("16:9");
  const [durationSec, setDurationSec] = useState(5);
  const [referenceSec, setReferenceSec] = useState(0);
  const [referenceDraft, setReferenceDraft] = useState("0");
  const [referenceFiles, setReferenceFiles] = useState<readonly ReferenceFile[]>(
    []
  );
  const referenceFilesRef = useRef(referenceFiles);
  referenceFilesRef.current = referenceFiles;
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [rechargeOpen, setRechargeOpen] = useState(false);

  const activeResolution =
    resolution && resolutions.includes(resolution)
      ? resolution
      : (resolutions[0] ?? "");

  const maxVideos = model?.maxReferenceVideos ?? 1;
  const maxVideoSeconds = model?.maxVideoReferenceSeconds ?? 60;
  const maxVideoBytes = model?.maxVideoReferenceBytes ?? 50 * 1024 * 1024;

  useEffect(() => {
    return () => {
      for (const file of referenceFilesRef.current) {
        URL.revokeObjectURL(file.objectUrl);
      }
    };
  }, []);

  const applyReferenceSeconds = (next: number) => {
    const clamped = Math.max(0, Math.round(next));
    setReferenceSec(clamped);
    setReferenceDraft(String(clamped));
  };

  const handleFiles = async (fileList: FileList | readonly File[]) => {
    setReferenceError(null);
    const incoming = Array.from(fileList);
    const accepted: ReferenceFile[] = [];
    let nextCount = referenceFiles.length;

    for (const raw of incoming) {
      if (nextCount >= maxVideos) {
        setReferenceError(
          t("landing.referenceTooMany", { max: maxVideos })
        );
        break;
      }
      if (raw.size > maxVideoBytes) {
        setReferenceError(t("landing.referenceTooLarge"));
        continue;
      }
      const file = normalizeGenerativeCardUploadFile(raw, "video");
      if (!file) {
        setReferenceError(t("landing.referenceBadFormat"));
        continue;
      }
      const objectUrl = URL.createObjectURL(file);
      try {
        const duration = await probeMediaDuration(objectUrl, "video");
        if (duration > maxVideoSeconds) {
          URL.revokeObjectURL(objectUrl);
          setReferenceError(
            t("landing.referenceTooLong", { max: maxVideoSeconds })
          );
          continue;
        }
        accepted.push({
          id: `${file.name}-${file.size}-${file.lastModified}-${nextCount}`,
          name: file.name,
          durationSec: duration,
          objectUrl,
        });
        nextCount += 1;
      } catch {
        URL.revokeObjectURL(objectUrl);
        setReferenceError(t("landing.referenceReadFailed"));
      }
    }

    if (accepted.length === 0) {
      return;
    }

    setReferenceFiles((current) => {
      const next = [...current, ...accepted];
      const total = next.reduce((sum, entry) => sum + entry.durationSec, 0);
      applyReferenceSeconds(total);
      return next;
    });
  };

  const handleRemoveFile = (id: string) => {
    setReferenceFiles((current) => {
      const target = current.find((entry) => entry.id === id);
      if (target) {
        URL.revokeObjectURL(target.objectUrl);
      }
      const next = current.filter((entry) => entry.id !== id);
      const total = next.reduce((sum, entry) => sum + entry.durationSec, 0);
      applyReferenceSeconds(total);
      return next;
    });
  };

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
  }, [activeResolution, durationSec, model, ratio, referenceSec]);

  const libtvConfig = useMemo(
    () => mergeLibtvComparisonConfig(libtv ?? DEFAULT_LIBTV_COMPARISON_CONFIG),
    [libtv]
  );
  const libtvRows = useMemo(() => {
    if (!model || !activeResolution) {
      return [];
    }
    const credits = computeLibtvCredits({
      config: libtvConfig,
      canonicalId: model.canonicalId,
      resolution: activeResolution,
      outputDurationSec: durationSec,
      referenceDurationSec: referenceSec,
    });
    return libtvConfig.plans.map((plan) => {
      const convertedYuan =
        credits == null ? null : computeLibtvConvertedYuan(credits, plan);
      const rateYuan =
        convertedYuan == null || durationSec <= 0
          ? null
          : convertedYuan / durationSec;
      return { plan, credits, convertedYuan, rateYuan };
    });
  }, [activeResolution, durationSec, libtvConfig, model, referenceSec]);

  const costPerSecond = estimate
    ? computeCostPerOutputSecond(estimate.costYuan, estimate.outputDurationSec)
    : null;

  return (
    <section id="pricing" className="scroll-mt-20 py-8 md:py-12">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 md:px-6">
        <Card className={LANDING_CARD_CLASS}>
          <CardHeader className="p-4 pb-2">
            <CardTitle>{t("landing.billingTitle")}</CardTitle>
            <CardDescription>{t("landing.billingSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {isEstimatesLoading ? (
              <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
            ) : !model || resolutions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("landing.noPrice")}</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                <div
                  className={cn(
                    "grid content-start gap-2 rounded-lg border border-dashed p-2",
                    isDraggingFiles
                      ? "border-primary bg-primary/5"
                      : "border-border bg-muted/20"
                  )}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsDraggingFiles(true);
                  }}
                  onDragLeave={() => setIsDraggingFiles(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setIsDraggingFiles(false);
                    void handleFiles(event.dataTransfer.files);
                  }}
                >
                  <Label htmlFor="landing_reference_sec" className="text-xs">
                    {t("landing.referenceTitle")}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="landing_reference_sec"
                      inputMode="numeric"
                      value={referenceDraft}
                      className="h-8 min-w-0 flex-1"
                      onChange={(event) =>
                        setReferenceDraft(event.target.value)
                      }
                      onBlur={() => {
                        const parsed = Number(referenceDraft);
                        applyReferenceSeconds(
                          Number.isFinite(parsed) ? parsed : 0
                        );
                      }}
                    />
                    <span className="shrink-0 text-xs text-muted-foreground">
                      s
                    </span>
                  </div>
                  <button
                    type="button"
                    className="flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-center text-xs text-muted-foreground hover:bg-background/60 hover:text-foreground dark:hover:bg-neutral-900/60"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>{t("landing.referenceDrop")}</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={VIDEO_ACCEPT}
                    multiple
                    className="hidden"
                    onChange={(event) => {
                      if (event.target.files) {
                        void handleFiles(event.target.files);
                        event.target.value = "";
                      }
                    }}
                  />
                  {referenceFiles.length > 0 ? (
                    <ul className="grid gap-1">
                      {referenceFiles.map((file) => (
                        <li
                          key={file.id}
                          className="flex items-center justify-between gap-1 rounded-md border bg-white px-2 py-1 text-xs dark:bg-neutral-900"
                        >
                          <span className="min-w-0 truncate">{file.name}</span>
                          <span className="shrink-0 text-muted-foreground">
                            {file.durationSec.toFixed(1)}s
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={() => handleRemoveFile(file.id)}
                            aria-label={t("common.delete")}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {referenceError ? (
                    <p className="text-xs text-destructive">{referenceError}</p>
                  ) : (
                    <p className="text-[11px] leading-4 text-muted-foreground">
                      {t("landing.referenceHint", {
                        max: maxVideos,
                        seconds: maxVideoSeconds,
                      })}
                    </p>
                  )}
                </div>

                <div className="grid content-start gap-3 sm:grid-cols-2 md:col-span-2">
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-medium">
                      {t("landing.modelLabel")}
                    </Label>
                    <SegmentedControl
                      options={models.map((entry) => entry.canonicalId)}
                      value={model.canonicalId}
                      formatOption={(option) =>
                        models.find((entry) => entry.canonicalId === option)
                          ?.displayName ?? option
                      }
                      onSelect={setCanonicalId}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-medium">
                      {t("landing.resolutionLabel")}
                    </Label>
                    <SegmentedControl
                      options={resolutions}
                      value={activeResolution}
                      formatOption={(option) => option.toUpperCase()}
                      onSelect={setResolution}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-medium">
                      {t("landing.ratioLabel")}
                    </Label>
                    <div className="flex gap-0.5 rounded-lg border border-border/70 bg-muted/20 p-0.5">
                      {BILLING_RATIOS.map((option) => (
                        <button
                          key={option}
                          type="button"
                          className={cn(
                            "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-md px-0.5 py-1.5 transition-colors",
                            ratio === option
                              ? "bg-background text-foreground shadow-sm dark:bg-neutral-900"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                          onClick={() => setRatio(option)}
                        >
                          <RatioPreviewIcon value={option} />
                          <span className="w-full truncate text-center text-[10px] leading-none">
                            {option}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <DurationControl
                    title={t("landing.durationLabel")}
                    value={durationSec}
                    min={VIDEO_DURATION_MIN}
                    max={VIDEO_DURATION_MAX}
                    onChange={setDurationSec}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={LANDING_CARD_CLASS}>
          <CardHeader className="p-4 pb-2">
            <CardTitle>{t("landing.compareTitle")}</CardTitle>
            <CardDescription>{t("landing.compareDisclaimer")}</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="px-2 py-2 font-medium">{t("landing.tablePlatform")}</th>
                    <th className="px-2 py-2 font-medium">{t("landing.tableLevel")}</th>
                    <th className="px-2 py-2 font-medium">{t("landing.tableTokens")}</th>
                    <th className="px-2 py-2 font-medium">{t("landing.tablePrice")}</th>
                    <th className="px-2 py-2 font-medium">{t("landing.tableRate")}</th>
                    <th className="px-2 py-2 font-medium">{t("landing.tableStorage")}</th>
                    <th className="px-2 py-2 font-medium">{t("landing.tableGptSkill")}</th>
                    <th className="px-2 py-2 font-medium">{t("landing.tableFirstCost")}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="px-2 py-3 font-medium">z3cz</td>
                    <td className="px-2 py-3">{t("landing.tableLevelNone")}</td>
                    <td className="px-2 py-3">
                      {estimate
                        ? formatVideoTokenMillions(estimate.billingTokens)
                        : t("landing.compareUnavailable")}
                    </td>
                    <td className="px-2 py-3">
                      {estimate
                        ? t("landing.costValue", {
                            cost: estimate.costYuan.toFixed(2),
                          })
                        : t("landing.compareUnavailable")}
                    </td>
                    <td className="px-2 py-3">
                      {costPerSecond != null
                        ? t("landing.rateValue", {
                            rate: costPerSecond.toFixed(3),
                          })
                        : t("landing.compareUnavailable")}
                    </td>
                    <td className="px-2 py-3">{t("landing.tableStorageUser")}</td>
                    <td className="px-2 py-3">
                      <div className="leading-5">
                        <div>{t("landing.tableGptSkillValue")}</div>
                        <div className="text-muted-foreground">
                          {t("landing.tableGptSkillDev")}
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-3">
                      <button
                        type="button"
                        className="border-b border-dashed border-muted-foreground text-foreground"
                        onClick={() => setRechargeOpen(true)}
                      >
                        {LANDING_VOLCANO_MIN_RECHARGE_YUAN}
                      </button>
                    </td>
                  </tr>
                  {libtvRows.map((row) => (
                    <tr key={row.plan.id}>
                      <td className="px-2 py-3 font-medium">
                        {t("landing.compareLibtv")}
                      </td>
                      <td className="px-2 py-3">
                        {row.plan.id === "supreme-monthly"
                          ? t("landing.tableLibtvSupreme")
                          : t("landing.tableLibtvLevel")}
                      </td>
                      <td className="px-2 py-3">
                        {row.credits == null
                          ? t("landing.compareUnavailable")
                          : t("landing.comparePoints", {
                              points: row.credits,
                            })}
                      </td>
                      <td className="px-2 py-3">
                        {row.convertedYuan == null
                          ? t("landing.compareUnavailable")
                          : t("landing.costValue", {
                              cost: row.convertedYuan.toFixed(2),
                            })}
                      </td>
                      <td className="px-2 py-3">
                        {row.rateYuan == null
                          ? t("landing.compareUnavailable")
                          : t("landing.rateValue", {
                              rate: row.rateYuan.toFixed(3),
                            })}
                      </td>
                      <td className="px-2 py-3">
                        {t("landing.tableStoragePlatform")}
                      </td>
                      <td className="px-2 py-3">
                        <div className="leading-5">
                          <div>{t("landing.tableGptSkillUnavailable")}</div>
                          <div className="text-muted-foreground">
                            {t("landing.tableGptSkillSupported")}
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-3">
                        {t("landing.costValue", {
                          cost: row.plan.priceYuan.toFixed(0),
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={rechargeOpen} onOpenChange={setRechargeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("landing.rechargeTitle")}</DialogTitle>
            <DialogDescription>{t("landing.rechargeBody")}</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </section>
  );
}
