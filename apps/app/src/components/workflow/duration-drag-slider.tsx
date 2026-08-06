import { useCallback, type MouseEvent as ReactMouseEvent } from "react";

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

export interface DurationDragSliderProps {
  readonly min: number;
  readonly max: number;
  readonly value: number;
  readonly disabled?: boolean;
  readonly onDragStart?: () => void;
  readonly onPreview: (next: number) => void;
  readonly onCommit: (next: number) => void;
}

export function DurationDragSlider({
  min,
  max,
  value,
  disabled = false,
  onDragStart,
  onPreview,
  onCommit,
}: DurationDragSliderProps) {
  const span = Math.max(max - min, 1);
  const percent = ((value - min) / span) * 100;

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

  return (
    <div
      data-testid="duration-drag-track"
      className={cn(
        "nodrag nopan nowheel relative flex h-5 min-w-0 flex-1 cursor-pointer touch-none select-none items-center",
        disabled && "pointer-events-none opacity-50"
      )}
      onMouseDown={handleMouseDown}
    >
      <div className="pointer-events-none relative h-1 w-full">
        <div className="absolute inset-0 rounded-full bg-primary/20" />
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-primary"
          style={{ width: `${percent}%` }}
        />
        <div
          className="absolute top-1/2 size-3 -translate-y-1/2 rounded-full border border-border bg-background shadow-sm"
          style={{ left: `calc(${percent}% - 6px)` }}
        />
      </div>
    </div>
  );
}
