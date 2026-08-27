import {
  isVolcanoMediaKitConfigValid,
  type VolcanoMediaKitSnapshot,
} from "@dafthunk/types";
import Sparkles from "lucide-react/icons/sparkles";
import { useEffect, useState } from "react";

import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAppToast } from "@/hooks/use-app-toast";
import { updateVolcanoMediaKit } from "@/services/organization-ai-interface-service";

import { VolcanoMediaKitStatusDetail } from "./volcano-mediakit-collapsed-summary";
import { VolcanoMediaKitPricingPopover } from "./volcano-mediakit-pricing-popover";
import { VolcanoMediaKitSettingsDialog } from "./volcano-mediakit-settings-dialog";

interface VolcanoMediaKitRowProps {
  readonly organizationId: string;
  readonly interfaceId: string;
  readonly snapshot: VolcanoMediaKitSnapshot;
  readonly onUpdated: () => Promise<void>;
}

export function VolcanoMediaKitRow({
  organizationId,
  interfaceId,
  snapshot,
  onUpdated,
}: VolcanoMediaKitRowProps) {
  const { t } = useTranslation();
  const toast = useAppToast();
  const [config, setConfig] = useState(snapshot);
  const [isSaving, setIsSaving] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    setConfig(snapshot);
  }, [snapshot]);

  const persistConfig = async (next: VolcanoMediaKitSnapshot) => {
    if (!isVolcanoMediaKitConfigValid(next)) {
      return;
    }

    setIsSaving(true);
    try {
      await updateVolcanoMediaKit(organizationId, interfaceId, next);
      await onUpdated();
      toast.success("pages.aiInterfaces.mediaKitEnhance.saved");
    } catch (error) {
      toast.errorRaw(
        error instanceof Error ? error.message : t("pages.aiInterfaces.saveFailed")
      );
      setConfig(snapshot);
    } finally {
      setIsSaving(false);
    }
  };

  const handleMasterToggle = (enabled: boolean) => {
    const next = { ...config, enabled };
    setConfig(next);
    if (!enabled) {
      void persistConfig(next);
      return;
    }
    if (isVolcanoMediaKitConfigValid(next)) {
      void persistConfig(next);
    } else {
      setSettingsOpen(true);
    }
  };

  const handleSettingsSave = async (next: VolcanoMediaKitSnapshot) => {
    const merged = { ...next, enabled: config.enabled };
    setConfig(merged);
    await persistConfig(merged);
  };

  return (
    <>
      <div className="rounded-lg border p-3 space-y-2">
        <div className="flex items-start gap-3">
          <Switch
            checked={config.enabled}
            disabled={isSaving}
            onCheckedChange={handleMasterToggle}
          />
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
                disabled={isSaving}
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
        onSave={handleSettingsSave}
        isSaving={isSaving}
      />
    </>
  );
}
