import type { ReactNode } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/utils/utils";

export const LANDING_MENU_BORDER = "border-[#e2ded4]";

export function formatLandingParamDuration(seconds: number): string {
  if (seconds >= 60) {
    const minutes = seconds / 60;
    return Number.isInteger(minutes)
      ? `${minutes}min`
      : `${Number(minutes.toFixed(2))}min`;
  }
  return `${Math.round(seconds)}s`;
}

export function formatLandingParamReferenceSummary(
  count: number,
  seconds: number,
): string {
  return `${count}*${seconds}s`;
}

export const LANDING_PARAM_CHIP_CLASS = cn(
  "landing-featured-param inline-flex items-center border px-2 py-1 text-[10px] uppercase tracking-[0.02em] text-foreground/70",
  LANDING_MENU_BORDER,
  "before:mr-1.5 before:text-[#4a55cf] before:content-['▪']",
);

export const LANDING_PARAM_TRIGGER_CLASS =
  "bg-transparent p-0 text-inherit uppercase hover:text-foreground";

export function landingMenuContentClass(className?: string): string {
  return cn(
    "w-auto min-w-32 border-[#e2ded4] bg-[#f7f5f1] p-1 text-foreground shadow-sm",
    "dark:border-neutral-700 dark:bg-neutral-900",
    className,
  );
}

export function landingMenuItemClass(active?: boolean): string {
  return cn(
    "rounded-md px-2 py-1.5 text-left text-xs transition-colors",
    active
      ? "bg-[#f0ede6] text-foreground dark:bg-neutral-800"
      : "text-foreground/80 hover:bg-[#f0ede6] hover:text-foreground dark:hover:bg-neutral-800",
  );
}

export function LandingMenuOptionButton(props: {
  readonly active?: boolean;
  readonly onSelect: () => void;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <button
      type="button"
      className={cn(landingMenuItemClass(props.active), props.className)}
      onClick={props.onSelect}
    >
      {props.children}
    </button>
  );
}

export function LandingMenuPopover(props: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly trigger: ReactNode;
  readonly children: ReactNode;
  readonly align?: "start" | "center" | "end";
  readonly contentClassName?: string;
}) {
  return (
    <Popover modal={false} open={props.open} onOpenChange={props.onOpenChange}>
      <PopoverTrigger asChild>{props.trigger}</PopoverTrigger>
      <PopoverContent
        align={props.align ?? "start"}
        className={landingMenuContentClass(props.contentClassName)}
      >
        {props.children}
      </PopoverContent>
    </Popover>
  );
}

export function LandingSelectPopover(props: {
  readonly label: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly children: ReactNode;
  readonly triggerClassName?: string;
  readonly contentClassName?: string;
  readonly align?: "start" | "center" | "end";
}) {
  return (
    <LandingMenuPopover
      open={props.open}
      onOpenChange={props.onOpenChange}
      align={props.align}
      contentClassName={props.contentClassName}
      trigger={
        <button
          type="button"
          className={cn(LANDING_PARAM_TRIGGER_CLASS, props.triggerClassName)}
        >
          {props.label}
        </button>
      }
    >
      <div className="grid gap-0.5">{props.children}</div>
    </LandingMenuPopover>
  );
}

export function LandingDropdownMenu(props: {
  readonly trigger: ReactNode;
  readonly children: ReactNode;
  readonly align?: "start" | "center" | "end";
  readonly contentClassName?: string;
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>{props.trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        align={props.align ?? "end"}
        className={landingMenuContentClass(props.contentClassName)}
      >
        {props.children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function LandingDropdownMenuItem(props: {
  readonly active?: boolean;
  readonly onSelect: () => void;
  readonly children: ReactNode;
}) {
  return (
    <DropdownMenuItem
      className={cn(
        landingMenuItemClass(props.active),
        "cursor-pointer focus:bg-[#f0ede6] dark:focus:bg-neutral-800",
      )}
      onClick={props.onSelect}
    >
      {props.children}
    </DropdownMenuItem>
  );
}
