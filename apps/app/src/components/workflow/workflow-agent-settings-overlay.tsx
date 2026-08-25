import Settings from "lucide-react/icons/settings";
import X from "lucide-react/icons/x";
import { useState, type MouseEvent } from "react";

import { ActionBarButton, ActionBarGroup } from "@/components/ui/action-bar";
import { useTranslation } from "@/components/locale-provider";

const settingsButtonClassName =
  "bg-white hover:bg-neutral-50 text-neutral-600 dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200";

export function WorkflowAgentSettingsOverlay() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const titleId = "workflow-agent-settings-title";

  const handleToggle = (event: MouseEvent) => {
    event.stopPropagation();
    setOpen((current) => !current);
  };

  const handleClose = (event: MouseEvent) => {
    event.stopPropagation();
    setOpen(false);
  };

  return (
    <div className="nodrag nowheel flex flex-col items-start gap-2">
      {open ? (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          className="flex min-h-64 w-80 flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-2 border-b border-neutral-200 px-3 py-2 dark:border-neutral-700">
            <h2
              id={titleId}
              className="text-sm font-medium text-neutral-900 dark:text-neutral-100"
            >
              {t("workflow.canvas.agentDialogTitle")}
            </h2>
            <button
              type="button"
              className="inline-flex size-7 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
              onClick={handleClose}
              aria-label={t("workflow.canvas.agentDialogClose")}
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="min-h-48 flex-1" />
        </div>
      ) : null}

      <ActionBarGroup>
        <ActionBarButton
          onClick={handleToggle}
          className={settingsButtonClassName}
          tooltipSide="right"
          tooltip={t("workflow.canvas.agentSettings")}
        >
          <Settings className="size-4!" />
        </ActionBarButton>
      </ActionBarGroup>
    </div>
  );
}
