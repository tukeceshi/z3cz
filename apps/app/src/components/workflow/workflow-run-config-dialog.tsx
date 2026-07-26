import type { MainlineRunTrigger, WorkflowRuntime } from "@dafthunk/types";
import Globe from "lucide-react/icons/globe";
import Layers from "lucide-react/icons/layers";
import Play from "lucide-react/icons/play";
import Zap from "lucide-react/icons/zap";
import { useEffect, useState } from "react";

import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/utils/utils";

export interface WorkflowRunConfig {
  runtime: WorkflowRuntime;
  runAs: MainlineRunTrigger;
}

interface WorkflowRunConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialRuntime: WorkflowRuntime;
  onConfirm: (config: WorkflowRunConfig) => void;
}

const RUNTIME_OPTIONS: {
  value: WorkflowRuntime;
  icon: typeof Layers;
}[] = [
  { value: "workflow", icon: Layers },
  { value: "worker", icon: Zap },
];

const RUN_AS_OPTIONS: {
  value: MainlineRunTrigger;
  icon: typeof Play;
}[] = [
  { value: "manual", icon: Play },
  { value: "http_request", icon: Globe },
];

export function WorkflowRunConfigDialog({
  open,
  onOpenChange,
  initialRuntime,
  onConfirm,
}: WorkflowRunConfigDialogProps) {
  const { t } = useTranslation();
  const [runtime, setRuntime] = useState<WorkflowRuntime>(initialRuntime);
  const [runAs, setRunAs] = useState<MainlineRunTrigger>("manual");

  useEffect(() => {
    if (open) {
      setRuntime(initialRuntime);
      setRunAs("manual");
    }
  }, [open, initialRuntime]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("workflow.runConfig.title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <Label>{t("workflow.runConfig.executionMode")}</Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {RUNTIME_OPTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setRuntime(option.value)}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-colors",
                      runtime === option.value
                        ? "border-primary/50 bg-accent"
                        : "hover:bg-muted/50"
                    )}
                  >
                    <Icon className="mb-1 h-4 w-4 text-primary" />
                    <div className="text-sm font-medium">
                      {t(`workflowScheme.runtimes.${option.value}.title`)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t(
                        `workflowScheme.runtimes.${option.value}.description`
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Label>{t("workflow.runConfig.runAs")}</Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {RUN_AS_OPTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setRunAs(option.value)}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-colors",
                      runAs === option.value
                        ? "border-primary/50 bg-accent"
                        : "hover:bg-muted/50"
                    )}
                  >
                    <Icon className="mb-1 h-4 w-4 text-primary" />
                    <div className="text-sm font-medium">
                      {t(`workflow.runConfig.runAsOptions.${option.value}.title`)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t(
                        `workflow.runConfig.runAsOptions.${option.value}.description`
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => onConfirm({ runtime, runAs })}>
            {t("workflow.runConfig.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
