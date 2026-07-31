import { useMemo } from "react";

import { useTranslation } from "@/components/locale-provider";
import { usePageBreadcrumbs } from "@/hooks/use-page";

import { CanvasViewModeToggle } from "./canvas-view-mode-toggle";
import { useCreativeStudio } from "./creative-studio-context";

export interface WorkflowEditorBreadcrumbEffectProps {
  readonly workflowName: string;
  readonly workflowsListUrl: string;
  readonly readOnly: boolean;
  readonly onOpenWorkflowSettings?: () => void;
  readonly soleSelectedNodeId: string | null;
}

export function WorkflowEditorBreadcrumbEffect({
  workflowName,
  workflowsListUrl,
  readOnly,
  onOpenWorkflowSettings,
  soleSelectedNodeId,
}: WorkflowEditorBreadcrumbEffectProps) {
  const { t } = useTranslation();
  const { viewMode, returnToCanvas, showStudio } = useCreativeStudio();

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

  usePageBreadcrumbs(
    [
      { label: t("pages.workflows.title"), to: workflowsListUrl },
      {
        label: workflowName || t("pages.editor.defaultName"),
        onClick: readOnly ? undefined : onOpenWorkflowSettings,
        onClickTitle: readOnly ? undefined : t("pages.editor.workflowSettings"),
        trailing: viewModeToggle,
      },
    ],
    [
      workflowName,
      workflowsListUrl,
      readOnly,
      onOpenWorkflowSettings,
      viewModeToggle,
      t,
    ]
  );

  return null;
}
