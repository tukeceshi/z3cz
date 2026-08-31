import {
  applyVideoTrimTimeFieldEdit,
  formatVideoTrimTimeSec,
  parseVideoTrimTimeInput,
  videoTrimSelectionDurationSec,
  type VideoTrimRangeSec,
  type VideoTrimTimeField,
} from "@dafthunk/types";
import CircleAlertIcon from "lucide-react/icons/circle-alert";
import { useState } from "react";

import { useTranslation } from "@/components/locale-provider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/utils/utils";

interface VideoTrimTimeFieldsProps {
  readonly className?: string;
  readonly videoDurationSec: number;
  readonly range: VideoTrimRangeSec;
  readonly minSelectionSec?: number;
  readonly disabled?: boolean;
  readonly onRangeChange: (range: VideoTrimRangeSec) => void;
  readonly onRangeCommit: (range: VideoTrimRangeSec) => void;
}

type TimeFieldBadgeVariant = "start" | "end" | "duration";

const TIME_FIELD_BADGE_CLASS: Record<TimeFieldBadgeVariant, string> = {
  start:
    "bg-neutral-300/80 text-neutral-700 dark:bg-neutral-600/80 dark:text-neutral-100",
  end: "bg-neutral-400/70 text-neutral-800 dark:bg-neutral-500/70 dark:text-neutral-50",
  duration:
    "bg-neutral-200/90 text-neutral-600 dark:bg-neutral-700/90 dark:text-neutral-200",
};

function TimeField({
  badge,
  badgeVariant,
  ariaLabel,
  valueSec,
  disabled,
  onCommit,
}: {
  readonly badge: string;
  readonly badgeVariant: TimeFieldBadgeVariant;
  readonly ariaLabel: string;
  readonly valueSec: number;
  readonly disabled?: boolean;
  readonly onCommit: (valueSec: number) => void;
}) {
  return (
    <label
      aria-label={ariaLabel}
      className={cn(
        "inline-flex h-7 min-w-0 overflow-hidden rounded border border-border/70 bg-background",
        "focus-within:ring-1 focus-within:ring-ring",
        disabled && "opacity-50"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex w-[1.125rem] shrink-0 items-center justify-center border-r border-border/60",
          "text-[10px] font-medium leading-none",
          TIME_FIELD_BADGE_CLASS[badgeVariant]
        )}
      >
        {badge}
      </span>
      <input
        type="text"
        inputMode="decimal"
        disabled={disabled}
        aria-label={ariaLabel}
        className={cn(
          "h-full w-[3.25rem] min-w-0 border-0 bg-transparent px-1.5 text-xs tabular-nums",
          "focus-visible:outline-none disabled:cursor-not-allowed"
        )}
        defaultValue={formatVideoTrimTimeSec(valueSec)}
        key={`${badgeVariant}-${formatVideoTrimTimeSec(valueSec)}`}
        onBlur={(event) => {
          const parsed = parseVideoTrimTimeInput(event.currentTarget.value);
          if (parsed === null) {
            event.currentTarget.value = formatVideoTrimTimeSec(valueSec);
            return;
          }
          onCommit(parsed);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}

function DurationHintIcon() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <Popover modal={false} open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("workflow.videoTrim.shortDurationConfirm.title")}
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-neutral-100 hover:text-foreground dark:hover:bg-neutral-700/60"
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <CircleAlertIcon className="size-3.5" strokeWidth={2} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 space-y-1 p-3 text-xs text-muted-foreground"
        align="center"
        side="top"
        onPointerDown={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <p>{t("workflow.videoTrim.shortDurationConfirm.seedanceReference")}</p>
        <p>{t("workflow.videoTrim.shortDurationConfirm.seedance25Edit")}</p>
      </PopoverContent>
    </Popover>
  );
}

export function VideoTrimTimeFields({
  className,
  videoDurationSec,
  range,
  minSelectionSec,
  disabled = false,
  onRangeChange,
  onRangeCommit,
}: VideoTrimTimeFieldsProps) {
  const { t } = useTranslation();

  const applyField = (field: VideoTrimTimeField, valueSec: number) => {
    const next = applyVideoTrimTimeFieldEdit({
      range,
      field,
      valueSec,
      videoDurationSec,
      minSelectionSec,
    });
    onRangeChange(next);
    onRangeCommit(next);
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <TimeField
        badge={t("workflow.videoTrim.startTimeBadge")}
        badgeVariant="start"
        ariaLabel={t("workflow.videoTrim.startTime")}
        valueSec={range.startSec}
        disabled={disabled}
        onCommit={(valueSec) => applyField("start", valueSec)}
      />
      <TimeField
        badge={t("workflow.videoTrim.endTimeBadge")}
        badgeVariant="end"
        ariaLabel={t("workflow.videoTrim.endTime")}
        valueSec={range.endSec}
        disabled={disabled}
        onCommit={(valueSec) => applyField("end", valueSec)}
      />
      <div className="flex items-center gap-0.5">
        <TimeField
          badge={t("workflow.videoTrim.durationBadge")}
          badgeVariant="duration"
          ariaLabel={t("workflow.videoTrim.duration")}
          valueSec={videoTrimSelectionDurationSec(range)}
          disabled={disabled}
          onCommit={(valueSec) => applyField("duration", valueSec)}
        />
        <DurationHintIcon />
      </div>
    </div>
  );
}
