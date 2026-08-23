import { cn } from "@/utils/utils";

/** Shared chip style for floating canvas top chrome controls. */
export const canvasChromeChipClassName = cn(
  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2 text-sm",
  "bg-background/70 backdrop-blur-sm transition-colors",
  "hover:bg-neutral-200/70 dark:hover:bg-neutral-700/70"
);

export const canvasChromeChipActiveClassName = cn(
  "bg-neutral-200/80 dark:bg-neutral-700/80"
);
