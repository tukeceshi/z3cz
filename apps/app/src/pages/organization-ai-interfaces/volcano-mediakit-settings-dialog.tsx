import {
  VOLCANO_MEDIKIT_SUBTITLE_ERASE_MODES,
  VOLCANO_MEDIKIT_VIDEO_ENHANCE_MODES,
  type VolcanoMediaKitConfig,
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
import { Switch } from "@/components/ui/switch";

interface VolcanoMediaKitSettingsDialogProps {
  readonly open: boolean;
  readonly config: VolcanoMediaKitConfig;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSave: (config: VolcanoMediaKitConfig) => Promise<void>;
  readonly isSaving: boolean;
}

function hasSelectedMediaKitFeature(config: VolcanoMediaKitConfig): boolean {
  return (
    VOLCANO_MEDIKIT_VIDEO_ENHANCE_MODES.some((mode) => config.videoEnhance[mode]) ||
    VOLCANO_MEDIKIT_SUBTITLE_ERASE_MODES.some((mode) => config.subtitleErase[mode])
  );
}

export function VolcanoMediaKitSettingsDialog({
  open,
  config,
  onOpenChange,
  onSave,
  isSaving,
}: VolcanoMediaKitSettingsDialogProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(config);

  useEffect(() => {
    if (open) {
      setDraft(config);
    }
  }, [open, config]);

  const handleVideoModeToggle = (
    mode: (typeof VOLCANO_MEDIKIT_VIDEO_ENHANCE_MODES)[number],
    checked: boolean
  ) => {
    setDraft((previous) => ({
      ...previous,
      videoEnhance: {
        ...previous.videoEnhance,
        [mode]: checked,
      },
    }));
  };

  const handleSubtitleModeToggle = (
    mode: (typeof VOLCANO_MEDIKIT_SUBTITLE_ERASE_MODES)[number],
    checked: boolean
  ) => {
    setDraft((previous) => ({
      ...previous,
      subtitleErase: {
        ...previous.subtitleErase,
        [mode]: checked,
      },
    }));
  };

  const handleSave = async () => {
    if (!canSave) {
      return;
    }
    await onSave(draft);
    onOpenChange(false);
  };

  const canSave = hasSelectedMediaKitFeature(draft);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("pages.aiInterfaces.mediaKitEnhance.settingsTitle")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">
              {t("pages.aiInterfaces.mediaKitEnhance.videoEnhanceSection")}
            </p>
            {VOLCANO_MEDIKIT_VIDEO_ENHANCE_MODES.map((mode) => (
              <div
                key={mode}
                className="flex items-center justify-between gap-3"
              >
                <span className="text-sm">
                  {t(`pages.aiInterfaces.mediaKitEnhance.modes.${mode}`)}
                </span>
                <Switch
                  checked={draft.videoEnhance[mode]}
                  disabled={isSaving}
                  onCheckedChange={(checked) =>
                    handleVideoModeToggle(mode, checked)
                  }
                />
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">
              {t("pages.aiInterfaces.mediaKitEnhance.subtitleEraseSection")}
            </p>
            {VOLCANO_MEDIKIT_SUBTITLE_ERASE_MODES.map((mode) => (
              <div
                key={mode}
                className="flex items-center justify-between gap-3"
              >
                <span className="text-sm">
                  {t(
                    `pages.aiInterfaces.mediaKitEnhance.subtitleEraseModes.${mode}`
                  )}
                </span>
                <Switch
                  checked={draft.subtitleErase[mode]}
                  disabled={isSaving}
                  onCheckedChange={(checked) =>
                    handleSubtitleModeToggle(mode, checked)
                  }
                />
              </div>
            ))}
          </div>

          {!canSave ? (
            <p className="text-destructive text-xs">
              {t("pages.aiInterfaces.mediaKitEnhance.modeRequired")}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            disabled={isSaving}
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button disabled={isSaving || !canSave} onClick={() => void handleSave()}>
            {isSaving ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
