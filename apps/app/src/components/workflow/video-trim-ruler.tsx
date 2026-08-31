import {
  clampVideoTrimRange,
  shiftVideoTrimRange,
  VIDEO_TRIM_SNAP_STEP_SEC,
  type VideoTrimRangeSec,
} from "@dafthunk/types";
import { useRanger } from "@tanstack/react-ranger";
import {
  useMemo,
  useRef,
  useCallback,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { cn } from "@/utils/utils";

interface VideoTrimRulerProps {
  readonly className?: string;
  readonly videoDurationSec: number;
  readonly range: VideoTrimRangeSec;
  readonly minSelectionSec?: number;
  readonly onRangeChange: (range: VideoTrimRangeSec) => void;
  readonly onRangeCommit: (range: VideoTrimRangeSec) => void;
}

interface RulerTick {
  readonly sec: number;
  readonly kind: "second" | "minute";
}

interface RegionDragState {
  readonly pointerId: number;
  readonly startClientX: number;
  readonly initialRange: VideoTrimRangeSec;
}

function resolveSecondTickStepSec(videoDurationSec: number): number {
  return videoDurationSec > 180 ? 5 : 1;
}

function buildRulerTicks(videoDurationSec: number): readonly RulerTick[] {
  if (!Number.isFinite(videoDurationSec) || videoDurationSec <= 0) {
    return [];
  }

  const secondStep = resolveSecondTickStepSec(videoDurationSec);
  const tickBySec = new Map<number, RulerTick>();

  for (let sec = 0; sec <= videoDurationSec; sec += secondStep) {
    if (sec % 60 === 0) {
      continue;
    }
    tickBySec.set(sec, { sec, kind: "second" });
  }

  for (let sec = 0; sec <= videoDurationSec; sec += 60) {
    tickBySec.set(sec, { sec, kind: "minute" });
  }

  if (!tickBySec.has(videoDurationSec)) {
    tickBySec.set(videoDurationSec, {
      sec: videoDurationSec,
      kind: videoDurationSec % 60 === 0 ? "minute" : "second",
    });
  }

  return [...tickBySec.values()].sort((a, b) => a.sec - b.sec);
}

function rangeToTrackPercent(
  valueSec: number,
  videoDurationSec: number
): number {
  if (videoDurationSec <= 0) {
    return 0;
  }
  return Math.min(100, Math.max(0, (valueSec / videoDurationSec) * 100));
}

function resolveShiftedRange(
  drag: RegionDragState,
  clientX: number,
  trackWidth: number,
  videoDurationSec: number,
  minSelectionSec: number | undefined
): VideoTrimRangeSec {
  const deltaSec =
    trackWidth > 0
      ? ((clientX - drag.startClientX) / trackWidth) * videoDurationSec
      : 0;
  return shiftVideoTrimRange(
    drag.initialRange,
    deltaSec,
    videoDurationSec,
    minSelectionSec
  );
}

export function VideoTrimRuler({
  className,
  videoDurationSec,
  range,
  minSelectionSec,
  onRangeChange,
  onRangeCommit,
}: VideoTrimRulerProps) {
  const rangerRef = useRef<HTMLDivElement>(null);
  const regionDragRef = useRef<RegionDragState | null>(null);
  const [isRegionDragging, setIsRegionDragging] = useState(false);
  const ticks = useMemo(
    () => buildRulerTicks(videoDurationSec),
    [videoDurationSec]
  );

  const clampRange = useCallback(
    (nextRange: VideoTrimRangeSec) =>
      clampVideoTrimRange(nextRange, videoDurationSec, minSelectionSec),
    [minSelectionSec, videoDurationSec]
  );

  const resolveRangeFromDrag = useCallback(
    (drag: RegionDragState, clientX: number) => {
      const track = rangerRef.current;
      const trackWidth = track?.getBoundingClientRect().width ?? 0;
      return clampRange(
        resolveShiftedRange(
          drag,
          clientX,
          trackWidth,
          videoDurationSec,
          minSelectionSec
        )
      );
    },
    [clampRange, minSelectionSec, videoDurationSec]
  );

  const handleSelectionPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 || videoDurationSec <= 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      regionDragRef.current = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        initialRange: range,
      };
      setIsRegionDragging(true);
    },
    [range, videoDurationSec]
  );

  const handleSelectionPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = regionDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) {
        return;
      }
      event.preventDefault();
      onRangeChange(resolveRangeFromDrag(drag, event.clientX));
    },
    [onRangeChange, resolveRangeFromDrag]
  );

  const finishRegionDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = regionDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) {
        return;
      }
      event.currentTarget.releasePointerCapture(event.pointerId);
      regionDragRef.current = null;
      setIsRegionDragging(false);
      onRangeCommit(resolveRangeFromDrag(drag, event.clientX));
    },
    [onRangeCommit, resolveRangeFromDrag]
  );

  const handleSelectionPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      finishRegionDrag(event);
    },
    [finishRegionDrag]
  );

  const handleSelectionPointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      finishRegionDrag(event);
    },
    [finishRegionDrag]
  );

  const startPercent = rangeToTrackPercent(range.startSec, videoDurationSec);
  const endPercent = rangeToTrackPercent(range.endSec, videoDurationSec);
  const handlePercents = [startPercent, endPercent] as const;
  const selectionWidth = endPercent - startPercent;

  const rangerInstance = useRanger({
    getRangerElement: () => rangerRef.current,
    values: [range.startSec, range.endSec],
    min: 0,
    max: videoDurationSec,
    stepSize: VIDEO_TRIM_SNAP_STEP_SEC,
    onDrag: (instance) => {
      const [startSec, endSec] = instance.sortedValues;
      onRangeChange(clampRange({ startSec, endSec }));
    },
    onChange: (instance) => {
      const [startSec, endSec] = instance.sortedValues;
      onRangeCommit(clampRange({ startSec, endSec }));
    },
  });

  const handleDragActive = rangerInstance
    .handles()
    .some((handle) => handle.isActive);

  return (
    <div className={cn("min-w-0 flex-1", className)}>
      <div
        ref={rangerRef}
        className="relative h-9 select-none rounded-md bg-neutral-300/40 dark:bg-neutral-600/50"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-2.5">
          {ticks.map((tick) => {
            const left = rangeToTrackPercent(tick.sec, videoDurationSec);
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
              role="slider"
              aria-label="Move trim selection"
              aria-valuemin={0}
              aria-valuemax={videoDurationSec}
              aria-valuenow={range.startSec}
              className={cn(
                "absolute inset-y-0 z-10 rounded-sm bg-neutral-100/25 ring-1 ring-inset ring-white/20 dark:bg-white/10",
                isRegionDragging
                  ? "cursor-grabbing"
                  : "cursor-grab active:cursor-grabbing",
                (handleDragActive || selectionWidth <= 0) &&
                  "pointer-events-none"
              )}
              style={{
                left: `${startPercent}%`,
                width: `${selectionWidth}%`,
              }}
              onPointerDown={handleSelectionPointerDown}
              onPointerMove={handleSelectionPointerMove}
              onPointerUp={handleSelectionPointerUp}
              onPointerCancel={handleSelectionPointerCancel}
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
            disabled={isRegionDragging}
            onKeyDown={handle.onKeyDownHandler}
            onMouseDown={handle.onMouseDownHandler}
            onTouchStart={handle.onTouchStart}
            className={cn(
              "absolute inset-y-1 z-20 w-1.5 -translate-x-1/2 cursor-ew-resize rounded-full bg-white shadow-md ring-1 ring-black/10 dark:ring-white/20",
              handle.isActive && "z-30 ring-2 ring-white/80",
              isRegionDragging && "pointer-events-none"
            )}
            style={{
              left: `${handlePercents[index] ?? endPercent}%`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
