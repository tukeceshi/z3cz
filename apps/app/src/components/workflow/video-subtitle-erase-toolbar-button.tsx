import {
  parseVideoSubtitleEraseNodeConfig,
  withVideoSubtitleEraseRefinedDefaults,
  isResourceIdReference,
  isUnloadedResourceRef,
  type MediaReference,
} from "@dafthunk/types";
import EraserIcon from "lucide-react/icons/eraser";
import { useCallback, type MouseEvent } from "react";

import { useAuth } from "@/components/auth-context";
import { useTranslation } from "@/components/locale-provider";
import { useAppToast } from "@/hooks/use-app-toast";
import { useOrgVolcanoMediaKitConfig } from "@/hooks/use-volcano-mediakit-config";

import { cn } from "@/utils/utils";
import {
  GENERATIVE_NODE_PANEL_TOOLBAR_BUTTON_CLASS,
  GENERATIVE_NODE_PANEL_TOOLBAR_ICON_CLASS,
} from "./generative-card-styles";
import { useSubtitleEraseSession } from "./video-subtitle-erase-session-context";
import { useWorkflow } from "./workflow-context";
import type { WorkflowNodeType } from "./workflow-types";

export interface VideoSubtitleEraseToolbarButtonProps {
  readonly sourceNodeId: string;
  readonly sourceNodeData: WorkflowNodeType;
  readonly sourceVideo: MediaReference;
  readonly disabled?: boolean;
}

export function VideoSubtitleEraseToolbarButton({
  sourceNodeId,
  sourceNodeData,
  sourceVideo,
  disabled = false,
}: VideoSubtitleEraseToolbarButtonProps) {
  const { t } = useTranslation();
  const toast = useAppToast();
  const { organization } = useAuth();
  const orgId = organization?.id;
  const { disabled: workflowDisabled } = useWorkflow();
  const { openSubtitleEraseSession, closeSubtitleEraseSession, session } =
    useSubtitleEraseSession();
  const { config: mediaKitConfig, isLoading: isMediaKitLoading } =
    useOrgVolcanoMediaKitConfig(orgId);

  const active = session?.sourceNodeId === sourceNodeId;
  const enabledModes = mediaKitConfig?.enabledSubtitleEraseModes ?? [];

  const handleClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (active) {
        closeSubtitleEraseSession();
        return;
      }
      if (
        !orgId ||
        (mediaKitConfig &&
          !isMediaKitLoading &&
          (!mediaKitConfig.active ||
            enabledModes.length === 0 ||
            !mediaKitConfig.hasApiKey))
      ) {
        toast.error("workflow.subtitleErase.notConfiguredHint");
        return;
      }

      const sourceMedia =
        isResourceIdReference(sourceVideo) && !isUnloadedResourceRef(sourceVideo)
          ? sourceVideo
          : null;
      if (!sourceMedia) {
        toast.error("workflow.subtitleErase.sourceMissing");
        return;
      }

      const storedConfig = parseVideoSubtitleEraseNodeConfig(
        sourceNodeData.metadata
      );
      const draftConfig = withVideoSubtitleEraseRefinedDefaults(
        storedConfig ?? { mode: enabledModes[0] ?? "standard" }
      );
      openSubtitleEraseSession({
        sourceNodeId,
        sourceMedia,
        draftConfig,
      });
    },
    [
      active,
      closeSubtitleEraseSession,
      enabledModes,
      isMediaKitLoading,
      mediaKitConfig,
      openSubtitleEraseSession,
      orgId,
      sourceNodeData.metadata,
      sourceNodeId,
      sourceVideo,
      toast,
    ]
  );

  return (
    <button
      type="button"
      disabled={disabled || workflowDisabled}
      aria-pressed={active}
      className={cn(
        GENERATIVE_NODE_PANEL_TOOLBAR_BUTTON_CLASS,
        active &&
          "bg-neutral-200/70 text-foreground dark:bg-neutral-700/70 dark:text-neutral-100"
      )}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={handleClick}
    >
      <EraserIcon
        className={GENERATIVE_NODE_PANEL_TOOLBAR_ICON_CLASS}
        strokeWidth={2}
      />
      <span>{t("workflow.subtitleErase.action")}</span>
    </button>
  );
}
