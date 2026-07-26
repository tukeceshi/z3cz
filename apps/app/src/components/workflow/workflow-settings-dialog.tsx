import ChevronDownIcon from "lucide-react/icons/chevron-down";
import { useState } from "react";

import { useTranslation } from "@/components/locale-provider";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { WorkflowPropertiesForm } from "./workflow-properties-form";
import type { WorkflowExecutionStatus } from "./workflow-types";

export interface WorkflowSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowName?: string;
  workflowDescription?: string;
  onWorkflowUpdate?: (name: string, description?: string) => void;
  disabledWorkflow?: boolean;
  workflowStatus?: WorkflowExecutionStatus;
  workflowErrorMessage?: string;
}

export function WorkflowSettingsDialog({
  open,
  onOpenChange,
  workflowName,
  workflowDescription,
  onWorkflowUpdate,
  disabledWorkflow = false,
  workflowStatus,
  workflowErrorMessage,
}: WorkflowSettingsDialogProps) {
  const { t } = useTranslation();
  const [errorExpanded, setErrorExpanded] = useState(true);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("workflow.settings.title")}</DialogTitle>
        </DialogHeader>

        <WorkflowPropertiesForm
          workflowName={workflowName}
          workflowDescription={workflowDescription}
          onWorkflowUpdate={onWorkflowUpdate}
          disabled={disabledWorkflow}
        />

        {workflowStatus === "error" && workflowErrorMessage ? (
          <div className="border-t border-border pt-4">
            <button
              type="button"
              onClick={() => setErrorExpanded(!errorExpanded)}
              className="group mb-2 flex w-full items-center justify-between"
            >
              <h2 className="text-base font-semibold text-foreground">
                {t("workflow.settings.errorSection")}
              </h2>
              <ChevronDownIcon
                className={`h-4 w-4 text-neutral-400 dark:text-neutral-500 ${
                  errorExpanded ? "rotate-0" : "-rotate-90"
                }`}
              />
            </button>
            {errorExpanded ? (
              <p className="text-sm text-red-600 wrap-break-word dark:text-red-400">
                {workflowErrorMessage}
              </p>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
