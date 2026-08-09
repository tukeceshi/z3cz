import { cn } from "@/utils/utils";

export interface StudioDockPromptCharCountProps {
  readonly count: number;
  readonly maxLength: number;
  readonly className?: string;
}

/** Prompt char count for creative-studio dock footer (no shell; matches model chip text-xs). */
export function StudioDockPromptCharCount({
  count,
  maxLength,
  className,
}: StudioDockPromptCharCountProps) {
  const isOverLimit = count > maxLength;

  return (
    <span
      className={cn(
        "inline-flex h-8 shrink-0 items-center select-none self-end tabular-nums text-xs leading-none",
        isOverLimit ? "text-destructive" : "text-muted-foreground",
        className
      )}
      aria-hidden="true"
    >
      {count} / {maxLength}
    </span>
  );
}
