import { createDefaultVideoRetakeTrimRange } from "@dafthunk/types";
import ClapperboardIcon from "lucide-react/icons/clapperboard";
import { useCallback, type MouseEvent } from "react";

import { useTranslation } from "@/components/locale-provider";

import {
  GENERATIVE_NODE_PANEL_TOOLBAR_BUTTON_CLASS,
  GENERATIVE_NODE_PANEL_TOOLBAR_ICON_CLASS,
} from "./generative-card-styles";
import { withAiVideoRetakeDraft } from "./ai-video-retake-node-utils";
import { useCreateLockedRetakeCopyNode } from "./use-video-trim-to-sibling-node";
import {
  readVideoSegmentPlaybackSeed,
  useOptionalVideoTrimSession,
  type VideoSegmentPlaybackSeed,
} from "./video-trim-session-context";
import { useWorkflow } from "./workflow-context";

export interface VideoRetakeToolbarButtonProps {
  readonly sourceNodeId: string;
  readonly disabled?: boolean;
}

function buildRetakeRangeSeed(trimSeed: VideoSegmentPlaybackSeed | undefined) {
  const defaultRange = createDefaultVideoRetakeTrimRange(0);
  return {
    committedRange: trimSeed?.committedRange ?? defaultRange,
    draftRange: trimSeed?.draftRange ?? defaultRange,
    playbackPaused: trimSeed?.playbackPaused ?? false,
    loadPhase: "loading" as const,
  };
}

export function VideoRetakeToolbarButton({
  sourceNodeId,
  disabled = false,
}: VideoRetakeToolbarButtonProps) {
  const { t } = useTranslation();
  const { disabled: workflowDisabled, updateNodeData } = useWorkflow();
  const trimSessionApi = useOptionalVideoTrimSession();
  const { createLockedRetakeCopyNode } =
    useCreateLockedRetakeCopyNode(sourceNodeId);

  const handleClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();

      const trimSeed = readVideoSegmentPlaybackSeed(
        trimSessionApi?.session,
        sourceNodeId
      );
      trimSessionApi?.closeTrimSession();

      const copy = createLockedRetakeCopyNode();
      if (!copy || !updateNodeData) {
        return;
      }

      updateNodeData(copy.nodeId, (current) =>
        withAiVideoRetakeDraft(current, buildRetakeRangeSeed(trimSeed))
      );
    },
    [createLockedRetakeCopyNode, sourceNodeId, trimSessionApi, updateNodeData]
  );

  return (
    <button
      type="button"
      disabled={disabled || workflowDisabled}
      className={GENERATIVE_NODE_PANEL_TOOLBAR_BUTTON_CLASS}
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
