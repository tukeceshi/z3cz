import { cn } from "@/utils/utils";

interface GenerativeCardErrorOverlayProps {
  readonly message: string;
  readonly className?: string;
}

export function GenerativeCardErrorOverlay({
  message,
  className,
}: GenerativeCardErrorOverlayProps) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-20 flex items-start justify-start rounded-md bg-red-500/10 p-2",
        className
      )}
    >
      <p className="line-clamp-4 text-[10px] leading-snug text-red-600 dark:text-red-400">
        {message}
      </p>
    </div>
  );
}
