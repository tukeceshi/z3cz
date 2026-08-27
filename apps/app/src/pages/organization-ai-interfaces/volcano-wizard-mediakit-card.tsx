import {
  createDefaultVolcanoMediaKitConfig,
  isVolcanoMediaKitConfigValid,
  type VolcanoMediaKitConfig,
} from "@dafthunk/types";
import Sparkles from "lucide-react/icons/sparkles";
import { useState } from "react";

import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

import { VolcanoMediaKitStatusDetail } from "./volcano-mediakit-collapsed-summary";
import { VolcanoMediaKitPricingPopover } from "./volcano-mediakit-pricing-popover";
import { VolcanoMediaKitSettingsDialog } from "./volcano-mediakit-settings-dialog";

export type WizardMediaKitConfig = VolcanoMediaKitConfig;

interface VolcanoWizardMediaKitCardProps {
  readonly config: WizardMediaKitConfig;
  readonly onConfigChange: (config: WizardMediaKitConfig) => void;
}

export function createDefaultWizardMediaKitConfig(): WizardMediaKitConfig {
  return createDefaultVolcanoMediaKitConfig();
}

export function isWizardMediaKitConfigValid(
  config: WizardMediaKitConfig
): boolean {
  return isVolcanoMediaKitConfigValid(config);
}

export function VolcanoWizardMediaKitCard({
  config,
  onConfigChange,
}: VolcanoWizardMediaKitCardProps) {
  const { t } = useTranslation();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleMasterToggle = (enabled: boolean) => {
    const next = { ...config, enabled };
    onConfigChange(next);
    if (enabled && !isWizardMediaKitConfigValid(next)) {
      setSettingsOpen(true);
    }
  };

  const handleSettingsSave = async (next: WizardMediaKitConfig) => {
    onConfigChange({ ...next, enabled: config.enabled });
  };

  return (
    <>
      <div className="rounded-lg border p-3 space-y-2">
        <div className="flex items-start gap-3">
          <Switch checked={config.enabled} onCheckedChange={handleMasterToggle} />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Sparkles className="size-4 text-muted-foreground" />
              <span className="font-medium">
                {t("pages.aiInterfaces.mediaKitEnhance.cardTitle")}
              </span>
              <VolcanoMediaKitPricingPopover />
            </div>
            <p className="text-muted-foreground text-xs">
              <VolcanoMediaKitStatusDetail snapshot={config} />
            </p>
            {config.enabled ? (
              <Button
                variant="outline"
                size="sm"
                className="mt-1"
                onClick={() => setSettingsOpen(true)}
              >
                {t("pages.aiInterfaces.mediaKitEnhance.settings")}
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <VolcanoMediaKitSettingsDialog
        open={settingsOpen}
        config={config}
        onOpenChange={setSettingsOpen}
        onSave={async (next) => handleSettingsSave(next)}
        isSaving={false}
      />
    </>
  );
}
