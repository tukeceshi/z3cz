import type { AiInterfaceChannelId } from "@dafthunk/types";
import { getAiInterfaceChannel } from "@dafthunk/types";
import { useCallback, useState } from "react";

import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePrefetchSingleModelPickerData } from "@/services/platform-ai-model-service";

import { ChannelSelectStep } from "./channel-select-step";
import { SingleModelWizardContent } from "./single-model-wizard-content";
import { VolcanoWizardFlow } from "./volcano-wizard-flow";

interface VolcanoWizardDialogProps {
  open: boolean;
  organizationId: string;
  onOpenChange: (open: boolean) => void;
  onCreated: () => Promise<void>;
}

/** @deprecated Use AddInterfaceWizardDialog */
export function VolcanoWizardDialog(props: VolcanoWizardDialogProps) {
  return <AddInterfaceWizardDialog {...props} />;
}

interface AddInterfaceWizardDialogProps {
  open: boolean;
  organizationId: string;
  onOpenChange: (open: boolean) => void;
  onCreated: () => Promise<void>;
}

type WizardPhase = "channel" | "volcano" | "single-model";

export function AddInterfaceWizardDialog({
  open,
  organizationId,
  onOpenChange,
  onCreated,
}: AddInterfaceWizardDialogProps) {
  const { t } = useTranslation();
  usePrefetchSingleModelPickerData(open ? organizationId : undefined);
  const [phase, setPhase] = useState<WizardPhase>("channel");
  const [channelId, setChannelId] = useState<AiInterfaceChannelId | null>(null);
  const [singleModelStep, setSingleModelStep] = useState(1);
  const [flowKey, setFlowKey] = useState(0);

  const reset = useCallback(() => {
    setPhase("channel");
    setChannelId(null);
    setSingleModelStep(1);
    setFlowKey((current) => current + 1);
  }, []);

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      reset();
    }
    onOpenChange(nextOpen);
  };

  const handleComplete = async () => {
    handleClose(false);
    await onCreated();
  };

  const startChannelWizard = () => {
    if (!channelId) return;
    const channel = getAiInterfaceChannel(channelId);
    if (!channel) return;
    setPhase(channel.wizard);
    setSingleModelStep(1);
  };

  if (!open) {
    return null;
  }

  if (phase === "volcano") {
    return (
      <VolcanoWizardFlow
        key={flowKey}
        open={open}
        organizationId={organizationId}
        onOpenChange={handleClose}
        onBackToChannel={() => setPhase("channel")}
        onCreated={handleComplete}
      />
    );
  }

  if (phase === "single-model") {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {t(
                singleModelStep === 1
                  ? "pages.aiInterfaces.addWizard.singleModelStep1Title"
                  : "pages.aiInterfaces.addWizard.singleModelStep2Title"
              )}
              <span className="text-muted-foreground ml-2 text-sm font-normal">
                {t("pages.aiInterfaces.addWizard.progress", {
                  step: singleModelStep,
                  total: 2,
                })}
              </span>
            </DialogTitle>
          </DialogHeader>
          <SingleModelWizardContent
            key={flowKey}
            organizationId={organizationId}
            step={singleModelStep}
            onStepChange={setSingleModelStep}
            onBackFromFirstStep={() => setPhase("channel")}
            onComplete={handleComplete}
            onCancel={() => handleClose(false)}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {t("pages.aiInterfaces.addWizard.step0Title")}
            <span className="text-muted-foreground ml-2 text-sm font-normal">
              {t("pages.aiInterfaces.addWizard.progress", { step: 1, total: 1 })}
            </span>
          </DialogTitle>
        </DialogHeader>
        <ChannelSelectStep
          organizationId={organizationId}
          selectedChannelId={channelId}
          onSelect={setChannelId}
        />
        <DialogFooter className="gap-2 sm:justify-end">
          <Button variant="outline" onClick={() => handleClose(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={startChannelWizard} disabled={!channelId}>
            {t("common.next")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
