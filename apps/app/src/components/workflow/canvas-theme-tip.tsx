import Monitor from "lucide-react/icons/monitor";
import Moon from "lucide-react/icons/moon";
import Sun from "lucide-react/icons/sun";
import { useCallback, useEffect, useState } from "react";

import { useTranslation } from "@/components/locale-provider";
import { useTheme } from "@/components/theme-provider";
import { TourSpotlight } from "@/components/tour/tour-spotlight";
import { useTour } from "@/components/tour";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/utils";

import {
  dismissCanvasThemeTip,
  isCanvasThemeTipDismissed,
} from "./canvas-theme-tip-storage";

type ThemeChoice = "light" | "dark" | "system";

const THEME_TOGGLE_SELECTOR = '[data-tour="theme-toggle"]';

export function CanvasThemeTip() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { isActive: isTourActive } = useTour();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isCanvasThemeTipDismissed() || isTourActive) {
      return;
    }
    const timerId = window.setTimeout(() => {
      if (!isCanvasThemeTipDismissed() && !isTourActive) {
        setOpen(true);
      }
    }, 600);
    return () => window.clearTimeout(timerId);
  }, [isTourActive]);

  const closeAndDismiss = useCallback(() => {
    dismissCanvasThemeTip();
    setOpen(false);
  }, []);

  const handleSelectTheme = useCallback(
    (next: ThemeChoice) => {
      setTheme(next);
      dismissCanvasThemeTip();
    },
    [setTheme]
  );

  if (!open) {
    return null;
  }

  return (
    <TourSpotlight targetSelector={THEME_TOGGLE_SELECTOR} padding={10}>
      <div
        className={cn(
          "fixed left-1/2 top-1/2 z-60 w-[min(100vw-2rem,22rem)] -translate-x-1/2 -translate-y-1/2",
          "rounded-lg border bg-popover p-4 text-popover-foreground shadow-lg",
          "animate-in fade-in-0 zoom-in-95"
        )}
        role="dialog"
        aria-labelledby="canvas-theme-tip-title"
      >
        <h3
          id="canvas-theme-tip-title"
          className="text-sm font-semibold leading-snug"
        >
          {t("workflow.canvas.themeTipTitle")}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          {t("workflow.canvas.themeTipBody")}
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {(
            [
              { id: "light", icon: Sun, label: t("theme.light") },
              { id: "dark", icon: Moon, label: t("theme.dark") },
              { id: "system", icon: Monitor, label: t("theme.system") },
            ] as const
          ).map((option) => {
            const Icon = option.icon;
            const selected = theme === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => handleSelectTheme(option.id)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-md border px-2 py-3 text-xs transition-colors",
                  selected
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={closeAndDismiss}
          >
            {t("workflow.canvas.themeTipDontShow")}
          </Button>
          <Button type="button" size="sm" onClick={closeAndDismiss}>
            {t("tour.finish")}
          </Button>
        </div>
      </div>
    </TourSpotlight>
  );
}
