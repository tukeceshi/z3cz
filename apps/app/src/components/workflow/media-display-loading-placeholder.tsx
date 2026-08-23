import { cn } from "@/utils/utils";

export function MediaDisplayLoadingPlaceholder({
  className,
}: {
  readonly className?: string;
}) {
  return (
    <div
      className={cn("bg-muted/30 animate-pulse", className)}
      aria-hidden
    />
  );
}
