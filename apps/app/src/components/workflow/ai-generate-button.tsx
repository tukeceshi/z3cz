import ArrowUpIcon from "lucide-react/icons/arrow-up";
import LoaderIcon from "lucide-react/icons/loader";

import { cn } from "@/utils/utils";

interface AiGenerateButtonProps {
  readonly disabled?: boolean;
  readonly isGenerating?: boolean;
  readonly label: string;
  readonly onClick: () => void;
  readonly className?: string;
}

/** LibTV-style generate control: rounded square + up arrow. */
export function AiGenerateButton({
  disabled = false,
  isGenerating = false,
  label,
  onClick,
  className,
}: AiGenerateButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-xl transition",
        "bg-neutral-600 text-neutral-100 hover:bg-neutral-500",
        "dark:bg-neutral-300 dark:text-neutral-800 dark:hover:bg-neutral-200",
        "disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      onClick={onClick}
    >
      {isGenerating ? (
        <LoaderIcon className="size-4 animate-spin" />
      ) : (
        <ArrowUpIcon className="size-4 stroke-[2.5]" />
      )}
    </button>
  );
}
