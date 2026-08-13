import type {
  PlatformVideoModelBaseline,
  SingleModelCapabilityLimits,
} from "@dafthunk/types";
import {
  normalizeCapabilityLimitsForSave,
  resolveEffectiveCapabilityLimitsForEdit,
} from "@dafthunk/types";
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
import { useAppToast } from "@/hooks/use-app-toast";

import { OrgCapabilityLimitsEditor } from "./org-capability-limits-editor";

interface CapabilityLimitsSettingsDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly modelLabel: string;
  readonly platformBaseline: PlatformVideoModelBaseline | null;
  readonly value: SingleModelCapabilityLimits | null;
  readonly onChange: (value: SingleModelCapabilityLimits | null) => void;
}

export function CapabilityLimitsSettingsDialog({
  open,
  onOpenChange,
  modelLabel,
  platformBaseline,
  value,
  onChange,
}: CapabilityLimitsSettingsDialogProps) {
  const { t } = useTranslation();
  const appToast = useAppToast();
  const [capabilityLimits, setCapabilityLimits] =
    useState<SingleModelCapabilityLimits>({
      supportsTaskCancel: true,
    });

  useEffect(() => {
    if (!open || !platformBaseline) {
      return;
    }

    setCapabilityLimits(
      resolveEffectiveCapabilityLimitsForEdit({
        platformBaseline,
        storedLimits: value,
      })
    );
  }, [open, platformBaseline, value]);

  const handleSave = () => {
    if (!platformBaseline) {
      return;
    }

    if (
      platformBaseline.resolution &&
      (capabilityLimits.resolution?.enumValues?.length ?? 0) === 0
    ) {
      appToast.error("pages.aiInterfaces.singleModel.resolutionLimitRequired");
      return;
    }

    onChange(
      normalizeCapabilityLimitsForSave({
        platformBaseline,
        limits: capabilityLimits,
      })
    );
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {t("pages.aiInterfaces.singleModel.capabilityLimitsSettingsTitle")}
          </DialogTitle>
          <p className="text-muted-foreground text-sm">{modelLabel}</p>
        </DialogHeader>

        <OrgCapabilityLimitsEditor
          platformBaseline={platformBaseline}
          capabilityLimits={capabilityLimits}
          onCapabilityLimitsChange={setCapabilityLimits}
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSave}>{t("common.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
