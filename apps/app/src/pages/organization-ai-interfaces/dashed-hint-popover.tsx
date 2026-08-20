import {
  cloneElement,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { cn } from "@/utils/utils";

export const HINT_TOOLTIP_CONTENT_CLASS =
  "w-auto max-w-[16rem] border-0 bg-primary px-3 py-1.5 text-xs text-primary-foreground shadow-none";

const LEAVE_CLOSE_DELAY_MS = 120;
const hintHiders = new Set<() => void>();

function hideOtherHints(except: () => void): void {
  for (const hide of hintHiders) {
    if (hide !== except) {
      hide();
    }
  }
}

interface HoverClickHintProps {
  readonly children: ReactElement;
  readonly content: ReactNode;
  readonly contentClassName?: string;
  readonly align?: "start" | "center" | "end";
  readonly side?: "top" | "right" | "bottom" | "left";
}

export function HoverClickHint({
  children,
  content,
  contentClassName,
  align = "start",
  side,
}: HoverClickHintProps) {
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  const closeTimerRef = useRef<number | null>(null);
  const anchorRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLElement | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const hide = useCallback(() => {
    clearCloseTimer();
    openRef.current = false;
    setOpen(false);
  }, [clearCloseTimer]);

  useEffect(() => {
    hintHiders.add(hide);
    return () => {
      hintHiders.delete(hide);
    };
  }, [hide]);

  const show = useCallback(() => {
    if (openRef.current) {
      return;
    }
    clearCloseTimer();
    hideOtherHints(hide);
    openRef.current = true;
    setOpen(true);
  }, [clearCloseTimer, hide]);

  const scheduleHide = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      const stillOver =
        anchorRef.current?.matches(":hover") ||
        contentRef.current?.matches(":hover");
      if (!stillOver) {
        hide();
      }
    }, LEAVE_CLOSE_DELAY_MS);
  }, [clearCloseTimer, hide]);

  const handleEnter = useCallback(() => {
    show();
  }, [show]);

  const handleLeave = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      const related = event.relatedTarget;
      if (related instanceof Node) {
        if (
          anchorRef.current?.contains(related) ||
          contentRef.current?.contains(related)
        ) {
          return;
        }
      }
      scheduleHide();
    },
    [scheduleHide]
  );

  const isInsideHint = useCallback((target: EventTarget | null) => {
    if (!(target instanceof Node)) {
      return false;
    }
    return (
      anchorRef.current?.contains(target) ||
      contentRef.current?.contains(target)
    );
  }, []);

  const handleClick = (event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    show();
  };

  const handleDismissOutside = useCallback(
    (event: { preventDefault: () => void; target: EventTarget | null }) => {
      if (isInsideHint(event.target)) {
        event.preventDefault();
        return;
      }
      hide();
    },
    [hide, isInsideHint]
  );

  const anchor = cloneElement(children, {
    ref: (node: HTMLElement | null) => {
      anchorRef.current = node;
    },
    onMouseEnter: handleEnter,
    onMouseLeave: handleLeave,
    onClick: handleClick,
  });

  return (
    <Popover open={open}>
      <PopoverAnchor asChild>{anchor}</PopoverAnchor>
      <PopoverContent
        ref={(node) => {
          contentRef.current = node;
        }}
        align={align}
        side={side}
        sideOffset={4}
        className={cn("pointer-events-auto", contentClassName)}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onPointerDownOutside={handleDismissOutside}
        onInteractOutside={handleDismissOutside}
        onEscapeKeyDown={() => {
          hide();
        }}
      >
        {content}
      </PopoverContent>
    </Popover>
  );
}

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
  return (
    <HoverClickHint
      align={align}
      content={children}
      contentClassName={contentClassName}
    >
      <button
        type="button"
        className={cn(
          "inline border-b border-dashed border-muted-foreground/70",
          "cursor-help font-normal text-muted-foreground hover:text-foreground",
          labelClassName
        )}
      >
        {label}
      </button>
    </HoverClickHint>
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
