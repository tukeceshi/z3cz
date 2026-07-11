import { Trash2Icon } from "lucide-react";

import { useTranslation } from "@/components/locale-provider";
import { cn } from "@/utils/utils";

interface ClearButtonProps {
  onClick: () => void;
  label?: string;
  className?: string;
  disabled?: boolean;
}

export function ClearButton({
  onClick,
  label,
  className = "",
  disabled = false,
}: ClearButtonProps) {
  const { t } = useTranslation();
  const ariaLabel = label ?? t("workflow.fields.clearValue");

  return (
    <button
      onClick={onClick}
      className={cn(
        "p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300",
        disabled &&
          "opacity-50 cursor-not-allowed hover:text-neutral-400 dark:hover:text-neutral-400",
        className
      )}
      aria-label={ariaLabel}
      type="button"
      disabled={disabled}
    >
      <Trash2Icon className="h-4 w-4" />
    </button>
  );
}
