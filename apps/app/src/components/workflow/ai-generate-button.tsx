import ArrowUpIcon from "lucide-react/icons/arrow-up";
import LoaderIcon from "lucide-react/icons/loader";
import SquareIcon from "lucide-react/icons/square";

import { cn } from "@/utils/utils";

interface AiGenerateButtonProps {
  readonly disabled?: boolean;
  readonly isGenerating?: boolean;
  readonly isCancelling?: boolean;
  readonly canCancel?: boolean;
  readonly label: string;
  readonly cancelLabel?: string;
  readonly onClick: () => void;
  readonly onCancel?: () => void;
  readonly className?: string;
}

/** LibTV-style generate control: rounded square + up arrow. */
export function AiGenerateButton({
  disabled = false,
  isGenerating = false,
  isCancelling = false,
  canCancel = false,
  label,
  cancelLabel,
  onClick,
  onCancel,
  className,
}: AiGenerateButtonProps) {
  const showStop = isGenerating && canCancel && !isCancelling;

  return (
    <button
      type="button"
      disabled={
        isCancelling ||
        (disabled && !(isGenerating && canCancel))
      }
      aria-label={
        isCancelling
          ? label
          : showStop
            ? (cancelLabel ?? label)
            : label
      }
      title={
        isCancelling
          ? label
          : showStop
            ? (cancelLabel ?? label)
            : label
      }
      className={cn(
        "group/generate inline-flex size-9 shrink-0 items-center justify-center rounded-xl transition",
        "bg-neutral-600 text-neutral-100 hover:bg-neutral-500",
        "dark:bg-neutral-300 dark:text-neutral-800 dark:hover:bg-neutral-200",
        "disabled:pointer-events-none disabled:opacity-50",
        showStop &&
          "bg-red-600 text-white hover:bg-red-500 dark:bg-red-500 dark:hover:bg-red-400",
        className
      )}
      onClick={() => {
        if (isCancelling) {
          return;
        }
        if (showStop && onCancel) {
          onCancel();
          return;
        }
        onClick();
      }}
    >
      {isCancelling || (isGenerating && !showStop) ? (
        <LoaderIcon className="size-4 animate-spin" />
      ) : showStop ? (
        <SquareIcon className="size-3.5 fill-current" />
      ) : (
        <ArrowUpIcon className="size-4 stroke-[2.5]" />
      )}
    </button>
  );
}
