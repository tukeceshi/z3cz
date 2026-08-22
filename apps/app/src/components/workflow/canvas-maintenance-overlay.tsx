import { useCallback, useState } from "react";
import RefreshCw from "lucide-react/icons/refresh-cw";

import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/utils";

const REFRESH_SPIN_MS = 600;

interface CanvasMaintenanceOverlayProps {
  readonly message: string | null;
  readonly statusFetchFailed: boolean;
  readonly onRefreshStatus: () => void;
}

export function CanvasMaintenanceOverlay({
  message,
  statusFetchFailed,
  onRefreshStatus,
}: CanvasMaintenanceOverlayProps) {
  const { t } = useTranslation();
  const [isSpinning, setIsSpinning] = useState(false);
  const description =
    message?.trim() || t("maintenance.canvasDefaultMessage");

  const handleRefreshClick = useCallback(() => {
    if (isSpinning) {
      return;
    }

    setIsSpinning(true);
    window.setTimeout(() => {
      onRefreshStatus();
      setIsSpinning(false);
    }, REFRESH_SPIN_MS);
  }, [isSpinning, onRefreshStatus]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-background/20 backdrop-blur-sm p-6"
      role="alertdialog"
      aria-modal="true"
      aria-describedby="canvas-maintenance-description"
    >
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <p
          id="canvas-maintenance-description"
          className="text-sm whitespace-pre-wrap"
        >
          {description}
        </p>
        {statusFetchFailed ? (
          <p className="mt-3 text-sm text-amber-600 dark:text-amber-400">
            {t("maintenance.canvasStatusFetchFailed")}
          </p>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="mt-4 opacity-70 hover:opacity-100"
          aria-label={t("maintenance.canvasStatusRefresh")}
          disabled={isSpinning}
          onClick={handleRefreshClick}
        >
          <RefreshCw
            className={cn(
              "size-5",
              isSpinning && "animate-[spin_0.6s_ease-in-out_1]"
            )}
          />
        </Button>
      </div>
    </div>
  );
}
