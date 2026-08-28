import {
  clampVideoTrimRange,
  VIDEO_TRIM_SNAP_STEP_SEC,
  type VideoTrimRangeSec,
} from "@dafthunk/types";
import { useRanger } from "@tanstack/react-ranger";
import { useMemo, useRef } from "react";

import { cn } from "@/utils/utils";

interface VideoTrimRulerProps {
  readonly className?: string;
  readonly videoDurationSec: number;
  readonly range: VideoTrimRangeSec;
  readonly onRangeChange: (range: VideoTrimRangeSec) => void;
  readonly onRangeCommit: (range: VideoTrimRangeSec) => void;
}

interface RulerTick {
  readonly sec: number;
  readonly kind: "second" | "minute";
}

function resolveSecondTickStepSec(totalSeconds: number): number {
  return totalSeconds > 180 ? 5 : 1;
}

function buildRulerTicks(videoDurationSec: number): readonly RulerTick[] {
  if (!Number.isFinite(videoDurationSec) || videoDurationSec <= 0) {
    return [];
  }

  const totalSeconds = Math.ceil(videoDurationSec);
  const secondStep = resolveSecondTickStepSec(totalSeconds);
  const tickBySec = new Map<number, RulerTick>();

  for (let sec = 0; sec <= totalSeconds; sec += secondStep) {
    if (sec % 60 === 0) {
      continue;
    }
    tickBySec.set(sec, { sec, kind: "second" });
  }

  for (let sec = 0; sec <= totalSeconds; sec += 60) {
    tickBySec.set(sec, { sec, kind: "minute" });
  }

  const lastTick = tickBySec.get(totalSeconds);
  if (!lastTick) {
    tickBySec.set(totalSeconds, {
      sec: totalSeconds,
      kind: totalSeconds % 60 === 0 ? "minute" : "second",
    });
  }

  return [...tickBySec.values()].sort((a, b) => a.sec - b.sec);
}

export function VideoTrimRuler({
  className,
  videoDurationSec,
  range,
  onRangeChange,
  onRangeCommit,
}: VideoTrimRulerProps) {
  const rangerRef = useRef<HTMLDivElement>(null);
  const ticks = useMemo(
    () => buildRulerTicks(videoDurationSec),
    [videoDurationSec]
  );

  const startPercent =
    videoDurationSec > 0 ? (range.startSec / videoDurationSec) * 100 : 0;
  const endPercent =
    videoDurationSec > 0 ? (range.endSec / videoDurationSec) * 100 : 0;
  const selectionWidth = endPercent - startPercent;

  const rangerInstance = useRanger({
    getRangerElement: () => rangerRef.current,
    values: [range.startSec, range.endSec],
    min: 0,
    max: videoDurationSec,
    stepSize: VIDEO_TRIM_SNAP_STEP_SEC,
    onDrag: (instance) => {
      const [startSec, endSec] = instance.sortedValues;
      onRangeChange(
        clampVideoTrimRange({ startSec, endSec }, videoDurationSec)
      );
    },
    onChange: (instance) => {
      const [startSec, endSec] = instance.sortedValues;
      onRangeCommit(
        clampVideoTrimRange({ startSec, endSec }, videoDurationSec)
      );
    },
  });

  return (
    <div className={cn("min-w-0 flex-1", className)}>
      <div
        ref={rangerRef}
        className="relative h-9 select-none rounded-md bg-neutral-300/40 dark:bg-neutral-600/50"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-2.5">
          {ticks.map((tick) => {
            const left =
              videoDurationSec > 0
                ? (tick.sec / videoDurationSec) * 100
                : 0;
            return (
              <div
                key={tick.sec}
                className="absolute bottom-0 -translate-x-1/2"
                style={{ left: `${left}%` }}
              >
                <div
                  className={cn(
                    "bg-neutral-500/60 dark:bg-neutral-400/50",
                    tick.kind === "minute" ? "h-2.5 w-px" : "h-1 w-px"
                  )}
                />
              </div>
            );
          })}
        </div>

        {videoDurationSec > 0 ? (
          <>
            <div
              className="pointer-events-none absolute inset-y-0 left-0 rounded-l-md bg-black/35"
              style={{ width: `${startPercent}%` }}
            />
            <div
              className="pointer-events-none absolute inset-y-0 rounded-sm bg-neutral-100/25 ring-1 ring-inset ring-white/20 dark:bg-white/10"
              style={{
                left: `${startPercent}%`,
                width: `${selectionWidth}%`,
              }}
            />
            <div
              className="pointer-events-none absolute inset-y-0 right-0 rounded-r-md bg-black/35"
              style={{ width: `${100 - endPercent}%` }}
            />
          </>
        ) : null}

        {rangerInstance.handles().map((handle, index) => (
          <button
            key={index}
            type="button"
            aria-label={index === 0 ? "Trim start" : "Trim end"}
            onKeyDown={handle.onKeyDownHandler}
            onMouseDown={handle.onMouseDownHandler}
            onTouchStart={handle.onTouchStart}
            className={cn(
              "absolute inset-y-1 z-20 w-1.5 -translate-x-1/2 cursor-ew-resize rounded-full bg-white shadow-md ring-1 ring-black/10 dark:ring-white/20",
              handle.isActive && "z-30 ring-2 ring-white/80"
            )}
            style={{
              left: `${rangerInstance.getPercentageForValue(handle.value)}%`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
