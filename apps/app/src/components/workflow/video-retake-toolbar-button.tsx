import type { MediaReference } from "@dafthunk/types";
import ClapperboardIcon from "lucide-react/icons/clapperboard";
import { useCallback, type MouseEvent } from "react";

import { useTranslation } from "@/components/locale-provider";

import { cn } from "@/utils/utils";

import {
  GENERATIVE_NODE_PANEL_TOOLBAR_BUTTON_CLASS,
  GENERATIVE_NODE_PANEL_TOOLBAR_ICON_CLASS,
} from "./generative-card-styles";
import { useVideoRetakeSession } from "./video-retake-session-context";
import {
  readVideoSegmentPlaybackSeed,
  useOptionalVideoTrimSession,
} from "./video-trim-session-context";
import { useWorkflow } from "./workflow-context";

export interface VideoRetakeToolbarButtonProps {
  readonly sourceNodeId: string;
  readonly sourceVideo: MediaReference;
  readonly disabled?: boolean;
}

export function VideoRetakeToolbarButton({
  sourceNodeId,
  sourceVideo,
  disabled = false,
}: VideoRetakeToolbarButtonProps) {
  const { t } = useTranslation();
  const { disabled: workflowDisabled } = useWorkflow();
  const trimSessionApi = useOptionalVideoTrimSession();
  const { openRetakeSession, closeRetakeSession, isRetakeActiveForNode } =
    useVideoRetakeSession();
  const active = isRetakeActiveForNode(sourceNodeId);

  const handleClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (active) {
        closeRetakeSession();
        return;
      }
      const seed = readVideoSegmentPlaybackSeed(
        trimSessionApi?.session,
        sourceNodeId
      );
      trimSessionApi?.closeTrimSession();
      openRetakeSession({
        sourceNodeId,
        sourceMedia: sourceVideo,
        seed,
      });
    },
    [
      active,
      closeRetakeSession,
      openRetakeSession,
      sourceNodeId,
      sourceVideo,
      trimSessionApi,
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
      <ClapperboardIcon
        className={GENERATIVE_NODE_PANEL_TOOLBAR_ICON_CLASS}
        strokeWidth={2}
      />
      <span>{t("workflow.videoRetake.action")}</span>
    </button>
  );
}
