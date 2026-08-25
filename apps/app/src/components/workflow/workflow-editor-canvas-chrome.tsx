import Bot from "lucide-react/icons/bot";
import { useEffect, useMemo } from "react";
import { Link } from "react-router";

import { LanguageToggle } from "@/components/language-toggle";
import { useTranslation } from "@/components/locale-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserProfile } from "@/components/user-profile";
import { cn } from "@/utils/utils";

import { canvasChromeChipClassName } from "./canvas-chrome-styles";
import { CanvasViewModeToggle } from "./canvas-view-mode-toggle";
import { useCreativeStudio } from "./creative-studio-context";

export interface WorkflowEditorCanvasChromeProps {
  readonly workflowName: string;
  readonly workflowsListUrl: string;
  readonly readOnly: boolean;
  readonly onOpenWorkflowSettings?: () => void;
  readonly soleSelectedNodeId: string | null;
}

export function WorkflowEditorCanvasChrome({
  workflowName,
  workflowsListUrl,
  readOnly,
  onOpenWorkflowSettings,
  soleSelectedNodeId,
}: WorkflowEditorCanvasChromeProps) {
  const { t, siteSettings } = useTranslation();
  const { viewMode, returnToCanvas, showStudio } = useCreativeStudio();
  const displayName = workflowName || t("pages.editor.defaultName");

  useEffect(() => {
    document.title = `${displayName} - ${siteSettings.siteName}`;
  }, [displayName, siteSettings.siteName]);

  const viewModeToggle = useMemo(
    () => (
      <CanvasViewModeToggle
        viewMode={viewMode}
        className="shrink-0"
        onViewModeChange={(mode) => {
          if (mode === "canvas") {
            returnToCanvas();
            return;
          }
          showStudio(soleSelectedNodeId);
        }}
      />
    ),
    [viewMode, returnToCanvas, showStudio, soleSelectedNodeId]
  );

  return (
    <nav
      className={cn(
        "pointer-events-none absolute inset-x-0 top-0 z-[60] h-14",
        "flex items-center justify-between gap-3 px-4"
      )}
    >
      <div className="pointer-events-auto flex min-w-0 items-center gap-2">
        <Link
          to={workflowsListUrl}
          className={cn(canvasChromeChipClassName, "min-w-0 max-w-[10rem] sm:max-w-[14rem]")}
        >
          <Bot className="size-4 shrink-0" />
          <span className="truncate font-medium">{siteSettings.siteName}</span>
        </Link>
        {readOnly || !onOpenWorkflowSettings ? (
          <span
            className={cn(
              canvasChromeChipClassName,
              "min-w-0 max-w-[8rem] truncate font-medium sm:max-w-[14rem]"
            )}
          >
            {displayName}
          </span>
        ) : (
          <button
            type="button"
            className={cn(
              canvasChromeChipClassName,
              "min-w-0 max-w-[8rem] truncate font-medium sm:max-w-[14rem]"
            )}
            onClick={onOpenWorkflowSettings}
            title={t("pages.editor.workflowSettings")}
            aria-label={t("pages.editor.workflowSettings")}
          >
            {displayName}
          </button>
        )}
        {viewModeToggle}
      </div>

      <div className="pointer-events-auto flex shrink-0 items-center gap-1">
        <LanguageToggle className={canvasChromeChipClassName} />
        <ThemeToggle className={canvasChromeChipClassName} />
        <UserProfile />
      </div>
    </nav>
  );
}
