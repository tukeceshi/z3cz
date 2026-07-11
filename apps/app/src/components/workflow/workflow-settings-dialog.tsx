import type {
  WorkflowBillingMode,
  WorkflowRuntime,
  WorkflowTrigger,
} from "@dafthunk/types";
import ChevronDownIcon from "lucide-react/icons/chevron-down";
import { useState } from "react";

import { useTranslation } from "@/components/locale-provider";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { WorkflowCriteriaManager } from "./workflow-criteria-manager";
import { WorkflowFeedbackSection } from "./workflow-feedback-section";
import { WorkflowPropertiesForm } from "./workflow-properties-form";
import type { WorkflowExecutionStatus } from "./workflow-types";

export interface WorkflowSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowId?: string;
  workflowName?: string;
  workflowDescription?: string;
  workflowTrigger?: WorkflowTrigger;
  workflowRuntime?: WorkflowRuntime;
  workflowBillingMode?: WorkflowBillingMode;
  onWorkflowUpdate?: (
    name: string,
    description?: string,
    trigger?: WorkflowTrigger,
    runtime?: WorkflowRuntime,
    billingMode?: WorkflowBillingMode
  ) => void;
  disabledWorkflow?: boolean;
  disabledFeedback?: boolean;
  workflowStatus?: WorkflowExecutionStatus;
  workflowErrorMessage?: string;
  executionId?: string;
  isEnabled?: boolean;
  isTogglingEnabled?: boolean;
  onToggleEnabled?: (checked: boolean) => void;
  onTriggerChange?: (newTrigger: WorkflowTrigger) => void;
}

export function WorkflowSettingsDialog({
  open,
  onOpenChange,
  workflowId,
  workflowName,
  workflowDescription,
  workflowTrigger,
  workflowRuntime,
  workflowBillingMode,
  onWorkflowUpdate,
  disabledWorkflow = false,
  disabledFeedback = false,
  workflowStatus,
  workflowErrorMessage,
  executionId,
  isEnabled,
  isTogglingEnabled,
  onToggleEnabled,
  onTriggerChange,
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
          workflowTrigger={workflowTrigger}
          workflowRuntime={workflowRuntime}
          workflowBillingMode={workflowBillingMode}
          onWorkflowUpdate={onWorkflowUpdate}
          disabled={disabledWorkflow}
          isEnabled={isEnabled}
          isTogglingEnabled={isTogglingEnabled}
          onToggleEnabled={onToggleEnabled}
          onTriggerChange={onTriggerChange}
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

        <div className="border-t border-border pt-4">
          {executionId && workflowStatus === "completed" ? (
            <WorkflowFeedbackSection
              executionId={executionId}
              workflowId={workflowId}
              disabled={disabledFeedback}
            />
          ) : (
            workflowId &&
            !disabledWorkflow && (
              <WorkflowCriteriaManager workflowId={workflowId} />
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
