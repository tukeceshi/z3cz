import { useTranslation } from "@/components/locale-provider";
import { cn } from "@/utils/utils";

import type { WorkflowEditorViewMode } from "./creative-studio-context";

interface CanvasViewModeToggleProps {
  readonly viewMode: WorkflowEditorViewMode;
  readonly onViewModeChange: (mode: WorkflowEditorViewMode) => void;
  readonly className?: string;
}

export function CanvasViewModeToggle({
  viewMode,
  onViewModeChange,
  className,
}: CanvasViewModeToggleProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "inline-flex rounded-lg border border-neutral-200 bg-white p-0.5 shadow-xs dark:border-neutral-700 dark:bg-neutral-900",
        className
      )}
    >
      <button
        type="button"
        className={cn(
          "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
          viewMode === "canvas"
            ? "bg-neutral-100 text-foreground dark:bg-neutral-800"
            : "text-muted-foreground hover:text-foreground"
        )}
        onClick={() => onViewModeChange("canvas")}
      >
        {t("workflow.studio.canvas")}
      </button>
      <button
        type="button"
        className={cn(
          "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
          viewMode === "studio"
            ? "bg-neutral-100 text-foreground dark:bg-neutral-800"
            : "text-muted-foreground hover:text-foreground"
        )}
        onClick={() => onViewModeChange("studio")}
      >
        {t("workflow.studio.title")}
      </button>
    </div>
  );
}
