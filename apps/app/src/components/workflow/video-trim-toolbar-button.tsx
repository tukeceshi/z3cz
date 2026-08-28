import type { MediaReference } from "@dafthunk/types";
import ScissorsIcon from "lucide-react/icons/scissors";
import { useCallback, type MouseEvent } from "react";

import { useTranslation } from "@/components/locale-provider";

import { cn } from "@/utils/utils";

import {
  GENERATIVE_NODE_PANEL_TOOLBAR_BUTTON_CLASS,
  GENERATIVE_NODE_PANEL_TOOLBAR_ICON_CLASS,
} from "./generative-card-styles";
import { useVideoTrimSession } from "./video-trim-session-context";
import { useWorkflow } from "./workflow-context";

export interface VideoTrimToolbarButtonProps {
  readonly sourceNodeId: string;
  readonly sourceVideo: MediaReference;
  readonly disabled?: boolean;
}

export function VideoTrimToolbarButton({
  sourceNodeId,
  sourceVideo,
  disabled = false,
}: VideoTrimToolbarButtonProps) {
  const { t } = useTranslation();
  const { disabled: workflowDisabled } = useWorkflow();
  const { toggleTrimSession, isTrimActiveForNode } = useVideoTrimSession();
  const active = isTrimActiveForNode(sourceNodeId);

  const handleClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      toggleTrimSession({
        sourceNodeId,
        sourceMedia: sourceVideo,
      });
    },
    [sourceNodeId, sourceVideo, toggleTrimSession]
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
      <ScissorsIcon
        className={GENERATIVE_NODE_PANEL_TOOLBAR_ICON_CLASS}
        strokeWidth={2}
      />
      <span>{t("workflow.videoTrim.action")}</span>
    </button>
  );
}
