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

function TimeField({
  label,
  valueSec,
  disabled,
  onCommit,
}: {
  readonly label: string;
  readonly valueSec: number;
  readonly disabled?: boolean;
  readonly onCommit: (valueSec: number) => void;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        disabled={disabled}
        className={cn(
          "h-7 w-[4.5rem] rounded border border-border/70 bg-background px-1.5 text-xs tabular-nums",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        )}
        defaultValue={formatVideoTrimTimeSec(valueSec)}
        key={`${label}-${formatVideoTrimTimeSec(valueSec)}`}
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
    <div className={cn("flex items-end gap-2", className)}>
      <TimeField
        label={t("workflow.videoTrim.startTime")}
        valueSec={range.startSec}
        disabled={disabled}
        onCommit={(valueSec) => applyField("start", valueSec)}
      />
      <TimeField
        label={t("workflow.videoTrim.endTime")}
        valueSec={range.endSec}
        disabled={disabled}
        onCommit={(valueSec) => applyField("end", valueSec)}
      />
      <div className="flex items-end gap-0.5">
        <TimeField
          label={t("workflow.videoTrim.duration")}
          valueSec={videoTrimSelectionDurationSec(range)}
          disabled={disabled}
          onCommit={(valueSec) => applyField("duration", valueSec)}
        />
        <DurationHintIcon />
      </div>
    </div>
  );
}
