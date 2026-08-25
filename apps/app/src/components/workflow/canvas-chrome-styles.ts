import { cn } from "@/utils/utils";

/** Shared chip style for floating canvas top chrome controls. */
export const canvasChromeChipClassName = cn(
  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2 text-sm",
  "bg-background/70 backdrop-blur-sm transition-colors",
  "hover:bg-neutral-200/70 dark:hover:bg-neutral-700/70"
);

/** Bottom dock — matched to infinite-canvas toolbar. */
export const canvasDockBarClassName = cn(
  "flex h-14 items-center gap-1 rounded-xl border px-2 backdrop-blur",
  "border-[#d6d3ca] bg-[rgba(251,250,247,.96)] text-[#57534e]",
  "shadow-[0_16px_40px_rgba(28,25,23,.12)]",
  "dark:border-[#44403c] dark:bg-[rgba(31,29,26,.96)] dark:text-[#d6d3d1]",
  "dark:shadow-[0_18px_45px_rgba(0,0,0,.32)]"
);

export const canvasDockButtonClassName = cn(
  "inline-flex size-8 shrink-0 items-center justify-center rounded-md",
  "text-[#57534e] dark:text-[#d6d3d1]",
  "hover:bg-[#e7e5df] hover:text-[#292524]",
  "dark:hover:bg-[#292524] dark:hover:text-[#f5f5f4]",
  "disabled:pointer-events-none disabled:opacity-35"
);

export const canvasDockButtonActiveClassName = cn(
  "bg-[#e7e5df] text-[#292524] dark:bg-[#3a3631] dark:text-[#f5f5f4]"
);

export const canvasDockDividerClassName =
  "mx-1 h-6 w-px bg-[#d6d3ca] dark:bg-[#44403c]";

export const canvasDockIconClassName = "size-4.5";
