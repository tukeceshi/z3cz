import { UnplugIcon } from "lucide-react";

import { useTranslation } from "@/components/locale-provider";
import { cn } from "@/utils/utils";

interface UnplugButtonProps {
  onClick: () => void;
  label?: string;
  className?: string;
  disabled?: boolean;
}

export function UnplugButton({
  onClick,
  label,
  className = "",
  disabled = false,
}: UnplugButtonProps) {
  const { t } = useTranslation();
  const ariaLabel = label ?? t("workflow.fields.disconnect");

  return (
    <button
      onClick={onClick}
      className={cn(
        "p-1 text-muted-foreground hover:text-foreground",
        disabled && "opacity-50 cursor-not-allowed hover:text-muted-foreground",
        className
      )}
      aria-label={ariaLabel}
      type="button"
      disabled={disabled}
    >
      <UnplugIcon className="h-4 w-4" />
    </button>
  );
}
