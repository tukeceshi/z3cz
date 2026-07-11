import type {
  PublicWorkflowScheme,
  WorkflowRuntime,
  WorkflowTrigger,
} from "@dafthunk/types";
import ClipboardList from "lucide-react/icons/clipboard-list";
import Clock from "lucide-react/icons/clock";
import FileText from "lucide-react/icons/file-text";
import Globe from "lucide-react/icons/globe";
import Hash from "lucide-react/icons/hash";
import Inbox from "lucide-react/icons/inbox";
import Layers from "lucide-react/icons/layers";
import Mail from "lucide-react/icons/mail";
import MessageCircle from "lucide-react/icons/message-circle";
import MessageSquare from "lucide-react/icons/message-square";
import Play from "lucide-react/icons/play";
import Send from "lucide-react/icons/send";
import Webhook from "lucide-react/icons/webhook";
import Zap from "lucide-react/icons/zap";
import { DynamicIcon, iconNames } from "lucide-react/dynamic.mjs";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/components/locale-provider";
import { usePublicWorkflowSchemes } from "@/services/workflow-scheme-service";
import { cn } from "@/utils/utils";

const workflowTriggerOptions: {
  trigger: WorkflowTrigger;
  icon: typeof Play;
}[] = [
  { trigger: "manual", icon: Play },
  { trigger: "scheduled", icon: Clock },
  { trigger: "http_webhook", icon: Webhook },
  { trigger: "http_request", icon: Globe },
  { trigger: "form_webhook", icon: ClipboardList },
  { trigger: "form_request", icon: FileText },
  { trigger: "email_message", icon: Mail },
  { trigger: "queue_message", icon: Inbox },
  { trigger: "discord_event", icon: MessageSquare },
  { trigger: "telegram_event", icon: Send },
  { trigger: "whatsapp_event", icon: MessageCircle },
  { trigger: "slack_event", icon: Hash },
];

const runtimeTypeOptions: {
  type: WorkflowRuntime;
  icon: typeof Layers;
}[] = [
  { type: "workflow", icon: Layers },
  { type: "worker", icon: Zap },
];

function SchemeIcon({
  icon,
  className,
}: {
  icon?: string | null;
  className?: string;
}) {
  if (icon && iconNames.includes(icon as (typeof iconNames)[number])) {
    return (
      <DynamicIcon
        name={icon as (typeof iconNames)[number]}
        className={className}
      />
    );
  }
  return <Layers className={className} />;
}

export type CreateWorkflowDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateWorkflow: (
    schemeId: string,
    name: string,
    trigger: WorkflowTrigger,
    description?: string,
    runtime?: WorkflowRuntime
  ) => Promise<void>;
};

export function CreateWorkflowDialog({
  open,
  onOpenChange,
  onCreateWorkflow,
}: CreateWorkflowDialogProps) {
  const { t } = useTranslation();
  const { schemes, isSchemesLoading, schemesError } = usePublicWorkflowSchemes();

  const [step, setStep] = useState<1 | 2>(1);
  const [selectedScheme, setSelectedScheme] =
    useState<PublicWorkflowScheme | null>(null);
  const [newWorkflowName, setNewWorkflowName] = useState("");
  const [newWorkflowDescription, setNewWorkflowDescription] = useState("");
  const [workflowTrigger, setWorkflowTrigger] =
    useState<WorkflowTrigger>("manual");
  const [workflowRuntime, setWorkflowRuntime] =
    useState<WorkflowRuntime>("workflow");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availableTriggers = useMemo(() => {
    if (!selectedScheme) {
      return workflowTriggerOptions;
    }
    return workflowTriggerOptions.filter((option) =>
      selectedScheme.allowedTriggers.includes(option.trigger)
    );
  }, [selectedScheme]);

  const availableRuntimes = useMemo(() => {
    if (!selectedScheme) {
      return runtimeTypeOptions;
    }
    return runtimeTypeOptions.filter((option) =>
      selectedScheme.allowedRuntimes.includes(option.type)
    );
  }, [selectedScheme]);

  const resetForm = () => {
    setStep(1);
    setSelectedScheme(null);
    setNewWorkflowName("");
    setNewWorkflowDescription("");
    setWorkflowTrigger("manual");
    setWorkflowRuntime("workflow");
  };

  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

  useEffect(() => {
    if (!selectedScheme) {
      return;
    }
    if (!selectedScheme.allowedTriggers.includes(workflowTrigger)) {
      setWorkflowTrigger(selectedScheme.allowedTriggers[0] ?? "manual");
    }
    if (!selectedScheme.allowedRuntimes.includes(workflowRuntime)) {
      setWorkflowRuntime(selectedScheme.allowedRuntimes[0] ?? "workflow");
    }
  }, [selectedScheme, workflowTrigger, workflowRuntime]);

  const handleSelectScheme = (scheme: PublicWorkflowScheme) => {
    setSelectedScheme(scheme);
    setStep(2);
  };

  const handleCreateWorkflow = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedScheme) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreateWorkflow(
        selectedScheme.id,
        newWorkflowName,
        workflowTrigger,
        newWorkflowDescription || undefined,
        workflowRuntime
      );
      resetForm();
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[80vw] max-w-[1400px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 1
              ? t("workflowScheme.createTitle")
              : t("workflowScheme.configureTitle")}
          </DialogTitle>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("workflowScheme.createDescription")}
            </p>
            {isSchemesLoading ? (
              <p className="text-sm text-muted-foreground">
                {t("common.loading")}
              </p>
            ) : null}
            {schemesError ? (
              <p className="text-sm text-destructive">{schemesError.message}</p>
            ) : null}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {schemes.map((scheme) => (
                <button
                  key={scheme.id}
                  type="button"
                  className={cn(
                    "border rounded-lg p-4 text-left transition-all hover:bg-muted/50",
                    selectedScheme?.id === scheme.id && "bg-accent border-primary/50"
                  )}
                  onClick={() => handleSelectScheme(scheme)}
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-md bg-primary/10 p-2">
                      <SchemeIcon
                        icon={scheme.icon}
                        className="h-4 w-4 text-primary"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="mb-1 text-sm font-medium">{scheme.name}</h3>
                      {scheme.description ? (
                        <p className="text-xs text-muted-foreground">
                          {scheme.description}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateWorkflow} className="space-y-6">
            {selectedScheme ? (
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-md bg-primary/10 p-2">
                    <SchemeIcon
                      icon={selectedScheme.icon}
                      className="h-4 w-4 text-primary"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{selectedScheme.name}</p>
                    {selectedScheme.description ? (
                      <p className="text-xs text-muted-foreground">
                        {selectedScheme.description}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            <div>
              <Label htmlFor="name">{t("workflowScheme.workflowName")}</Label>
              <Input
                id="name"
                value={newWorkflowName}
                onChange={(event) => setNewWorkflowName(event.target.value)}
                placeholder={t("workflowScheme.workflowNamePlaceholder")}
                className="mt-2"
                required
                minLength={2}
                maxLength={64}
                autoFocus
              />
            </div>

            <div>
              <Label htmlFor="description">
                {t("workflowScheme.workflowDescription")}
              </Label>
              <Textarea
                id="description"
                value={newWorkflowDescription}
                onChange={(event) =>
                  setNewWorkflowDescription(event.target.value)
                }
                placeholder={t("workflowScheme.workflowDescriptionPlaceholder")}
                className="mt-2"
                maxLength={256}
                rows={3}
              />
            </div>

            <div>
              <Label>{t("workflowScheme.triggerType")}</Label>
              <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {availableTriggers.map((triggerOption) => {
                  const IconComponent = triggerOption.icon;
                  return (
                    <div
                      key={triggerOption.trigger}
                      className={cn(
                        "cursor-pointer rounded-lg border p-4 transition-all",
                        workflowTrigger === triggerOption.trigger
                          ? "bg-accent border-primary/50"
                          : "hover:bg-muted/50"
                      )}
                      onClick={() => setWorkflowTrigger(triggerOption.trigger)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="rounded-md bg-primary/10 p-2">
                          <IconComponent className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1">
                          <h3 className="mb-1 text-sm font-medium">
                            {t(
                              `workflowScheme.triggers.${triggerOption.trigger}.title`
                            )}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {t(
                              `workflowScheme.triggers.${triggerOption.trigger}.description`
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <Label>{t("workflowScheme.executionMode")}</Label>
              <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                {availableRuntimes.map((runtime) => {
                  const IconComponent = runtime.icon;
                  return (
                    <div
                      key={runtime.type}
                      className={cn(
                        "cursor-pointer rounded-lg border p-4 transition-all",
                        workflowRuntime === runtime.type
                          ? "bg-accent border-primary/50"
                          : "hover:bg-muted/50"
                      )}
                      onClick={() => setWorkflowRuntime(runtime.type)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="rounded-md bg-primary/10 p-2">
                          <IconComponent className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1">
                          <h3 className="mb-1 text-sm font-medium">
                            {t(`workflowScheme.runtimes.${runtime.type}.title`)}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {t(
                              `workflowScheme.runtimes.${runtime.type}.description`
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setStep(1)}
              >
                {t("workflowScheme.backToSchemes")}
              </Button>
              <Button
                type="submit"
                className="flex-[2]"
                disabled={isSubmitting || !newWorkflowName.trim() || !selectedScheme}
              >
                {isSubmitting
                  ? t("workflowScheme.creating")
                  : t("workflowScheme.createWorkflow")}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
