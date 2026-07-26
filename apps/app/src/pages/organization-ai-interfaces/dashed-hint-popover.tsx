import type { ReactNode } from "react";
import { useCallback, useRef, useState } from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/utils/utils";

const HOVER_CLOSE_DELAY_MS = 120;

interface DashedHintPopoverProps {
  readonly label: string;
  readonly children: ReactNode;
  readonly contentClassName?: string;
  readonly labelClassName?: string;
  readonly align?: "start" | "center" | "end";
}

export function DashedHintPopover({
  label,
  children,
  contentClassName,
  labelClassName,
  align = "start",
}: DashedHintPopoverProps) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    if (pinned) {
      return;
    }
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
    }, HOVER_CLOSE_DELAY_MS);
  }, [clearCloseTimer, pinned]);

  const handlePointerEnter = useCallback(() => {
    clearCloseTimer();
    setOpen(true);
  }, [clearCloseTimer]);

  const handlePointerLeave = useCallback(() => {
    scheduleClose();
  }, [scheduleClose]);

  const handleTriggerClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    clearCloseTimer();
    setPinned(true);
    setOpen(true);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setPinned(false);
      setOpen(false);
      clearCloseTimer();
      return;
    }
    setOpen(true);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline border-b border-dashed border-muted-foreground/70",
            "text-muted-foreground hover:text-foreground cursor-help font-normal",
            labelClassName
          )}
          onMouseEnter={handlePointerEnter}
          onMouseLeave={handlePointerLeave}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={handleTriggerClick}
        >
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        sideOffset={6}
        className={cn("pointer-events-auto", contentClassName)}
        onMouseEnter={handlePointerEnter}
        onMouseLeave={handlePointerLeave}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onInteractOutside={() => {
          setPinned(false);
          setOpen(false);
          clearCloseTimer();
        }}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}

interface SupportedModelNameGridProps {
  readonly names: readonly string[];
}

export function supportedModelPopoverWidthClass(
  count: number
): string | undefined {
  if (count > 20) {
    return "min-w-[32rem] max-w-[40rem]";
  }
  if (count > 12) {
    return "min-w-[26rem] max-w-[34rem]";
  }
  if (count > 6) {
    return "min-w-[20rem] max-w-[28rem]";
  }
  if (count > 0) {
    return "min-w-[12rem] max-w-[20rem]";
  }
  return undefined;
}

export function supportedModelGridClass(count: number): string {
  return count > 12 ? "grid-cols-3" : "grid-cols-2";
}

export function SupportedModelNameGrid({ names }: SupportedModelNameGridProps) {
  if (names.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "grid gap-x-4 gap-y-1 text-xs leading-relaxed",
        supportedModelGridClass(names.length)
      )}
    >
      {names.map((name) => (
        <span key={name}>{name}</span>
      ))}
    </div>
  );
}
