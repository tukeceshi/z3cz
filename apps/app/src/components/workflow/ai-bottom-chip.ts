import { cn } from "@/utils/utils";

/** Shared bottom-bar chip look (model name + params triggers). */
export const AI_BOTTOM_CHIP_CLASS = cn(
  "inline-flex h-8 max-w-[240px] items-center gap-1.5 rounded-full px-3 text-left text-xs transition",
  "bg-muted/45 text-muted-foreground hover:bg-muted/65",
  "disabled:pointer-events-none disabled:opacity-50"
);

export const AI_BOTTOM_CHIP_OPEN_CLASS = "bg-muted/75 text-foreground";
