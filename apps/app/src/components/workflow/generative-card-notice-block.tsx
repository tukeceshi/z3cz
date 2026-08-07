import { Button } from "@/components/ui/button";
import { cn } from "@/utils/utils";

interface GenerativeCardNoticeBlockProps {
  readonly message: string;
  readonly dismissLabel: string;
  readonly onDismiss: () => void;
  readonly className?: string;
}

export function GenerativeCardNoticeBlock({
  message,
  dismissLabel,
  onDismiss,
  className,
}: GenerativeCardNoticeBlockProps) {
  return (
    <div
      className={cn(
        "absolute inset-0 z-40 flex flex-col overflow-hidden border border-border bg-muted/95 p-3 dark:bg-muted/90",
        className
      )}
    >
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        <p className="whitespace-pre-wrap break-words text-center text-sm font-bold leading-5 text-foreground">
          {message}
        </p>
      </div>
      <div className="mt-2 flex shrink-0 justify-center">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="nodrag nopan nowheel pointer-events-auto h-7 text-xs"
          onClick={(event) => {
            event.stopPropagation();
            onDismiss();
          }}
        >
          {dismissLabel}
        </Button>
      </div>
    </div>
  );
}
