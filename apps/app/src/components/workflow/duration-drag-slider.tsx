import {
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useMemo,
} from "react";

import { cn } from "@/utils/utils";

function durationFromClientX(
  clientX: number,
  track: HTMLDivElement,
  min: number,
  max: number
): number {
  const rect = track.getBoundingClientRect();
  const span = max - min;
  if (span <= 0) {
    return min;
  }
  const ratio = Math.min(
    1,
    Math.max(0, (clientX - rect.left) / Math.max(rect.width, 1))
  );
  return Math.min(max, Math.max(min, min + Math.round(ratio * span)));
}

function percentFromValue(value: number, min: number, max: number): number {
  const span = Math.max(max - min, 1);
  return ((value - min) / span) * 100;
}

function DragThumb({ percent }: { readonly percent: number }) {
  return (
    <div
      className="absolute top-1/2 size-3 -translate-y-1/2 rounded-full border border-border bg-background shadow-sm"
      style={{ left: `calc(${percent}% - 6px)` }}
    />
  );
}

export interface DurationDragSliderProps {
  readonly min: number;
  readonly max: number;
  readonly value: number;
  readonly disabled?: boolean;
  readonly marks?: readonly number[];
  readonly onDragStart?: () => void;
  readonly onPreview: (next: number) => void;
  readonly onCommit: (next: number) => void;
}

export function DurationDragSlider({
  min,
  max,
  value,
  disabled = false,
  marks,
  onDragStart,
  onPreview,
  onCommit,
}: DurationDragSliderProps) {
  const percent = percentFromValue(value, min, max);
  const visibleMarks = useMemo(
    () => (marks ?? []).filter((mark) => mark >= min && mark <= max),
    [marks, max, min]
  );

  const handleMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (disabled) return;
      event.preventDefault();
      event.stopPropagation();
      onDragStart?.();

      const track = event.currentTarget;
      let lastPreview = durationFromClientX(event.clientX, track, min, max);
      onPreview(lastPreview);

      const handleMouseMove = (moveEvent: MouseEvent) => {
        lastPreview = durationFromClientX(moveEvent.clientX, track, min, max);
        onPreview(lastPreview);
      };

      const finishDrag = () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", finishDrag);
        onCommit(lastPreview);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", finishDrag);
    },
    [disabled, max, min, onCommit, onDragStart, onPreview]
  );

  const handleMarkMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>, mark: number) => {
      if (disabled) return;
      event.preventDefault();
      event.stopPropagation();
      onDragStart?.();
      onPreview(mark);
      onCommit(mark);
    },
    [disabled, onCommit, onDragStart, onPreview]
  );

  return (
    <div
      className={cn(
        "nodrag nopan nowheel relative flex min-w-0 flex-1 flex-col",
        disabled && "pointer-events-none opacity-50"
      )}
    >
      <div
        data-testid="duration-drag-track"
        className="relative flex h-5 w-full cursor-pointer touch-none select-none items-center"
        onMouseDown={handleMouseDown}
      >
        <div className="pointer-events-none relative h-1 w-full">
          <div className="absolute inset-0 rounded-full bg-primary/20" />
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-primary"
            style={{ width: `${percent}%` }}
          />
          {visibleMarks.map((mark) => (
            <div
              key={mark}
              className="absolute top-1/2 h-1.5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/40"
              style={{ left: `${percentFromValue(mark, min, max)}%` }}
            />
          ))}
          <DragThumb percent={percent} />
        </div>
        {visibleMarks.map((mark) => (
          <button
            key={mark}
            type="button"
            aria-label={String(mark)}
            className="absolute top-1/2 z-10 h-5 w-4 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${percentFromValue(mark, min, max)}%` }}
            onMouseDown={(event) => handleMarkMouseDown(event, mark)}
          />
        ))}
      </div>
      {visibleMarks.length > 0 ? (
        <div className="relative h-3.5">
          {visibleMarks.map((mark) => {
            const markPercent = percentFromValue(mark, min, max);
            const align =
              mark === max ? "-translate-x-full" : "-translate-x-1/2";
            return (
              <button
                key={mark}
                type="button"
                data-testid={`duration-drag-mark-${mark}`}
                className={cn(
                  "absolute top-0 p-0 text-[10px] leading-none text-muted-foreground hover:text-foreground",
                  align
                )}
                style={{ left: `${markPercent}%` }}
                onMouseDown={(event) => handleMarkMouseDown(event, mark)}
              >
                {mark}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
