import { useTranslation } from "@/components/locale-provider";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { WorkflowPropertiesForm } from "./workflow-properties-form";

export interface WorkflowSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowName?: string;
  workflowDescription?: string;
  onWorkflowUpdate?: (name: string, description?: string) => void;
  disabledWorkflow?: boolean;
}

export function WorkflowSettingsDialog({
  open,
  onOpenChange,
  workflowName,
  workflowDescription,
  onWorkflowUpdate,
  disabledWorkflow = false,
}: WorkflowSettingsDialogProps) {
  const { t } = useTranslation();

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
      </DialogContent>
    </Dialog>
  );
}
