import {
  createDefaultVideoRetakeTrimRange,
  type MediaReference,
  type WorkflowMediaValue,
} from "@dafthunk/types";
import ClapperboardIcon from "lucide-react/icons/clapperboard";
import { useCallback, type MouseEvent } from "react";
import { useParams } from "react-router";

import { useAuth } from "@/components/auth-context";
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
import {
  resolveTrimSourceVideoUrl,
  resolveTrimVideoDurationSec,
} from "./video-trim-utils";
import { useWorkflow } from "./workflow-context";

export interface VideoRetakeToolbarButtonProps {
  readonly sourceNodeId: string;
  readonly sourceVideo: MediaReference;
  readonly disabled?: boolean;
}

async function enrichRetakePlaybackSeed(params: {
  readonly seed: VideoSegmentPlaybackSeed | undefined;
  readonly sourceVideo: MediaReference;
  readonly organizationId: string;
  readonly workflowId: string;
}): Promise<VideoSegmentPlaybackSeed | undefined> {
  if (params.seed?.trimSourceVideoUrl?.trim()) {
    return params.seed;
  }

  const trimSourceVideoUrl = await resolveTrimSourceVideoUrl({
    media: params.sourceVideo,
    organizationId: params.organizationId,
    workflowId: params.workflowId,
  });
  if (!trimSourceVideoUrl) {
    return params.seed;
  }

  let videoDurationSec = params.seed?.videoDurationSec ?? null;
  if (videoDurationSec === null || videoDurationSec <= 0) {
    try {
      videoDurationSec = await resolveTrimVideoDurationSec({
        videoUrl: trimSourceVideoUrl,
        cardVideoDurationSec: params.seed?.videoDurationSec,
      });
    } catch {
      videoDurationSec = null;
    }
  }

  const ready =
    videoDurationSec !== null &&
    videoDurationSec > 0 &&
    trimSourceVideoUrl.trim().length > 0;
  const defaultRange = createDefaultVideoRetakeTrimRange(videoDurationSec ?? 0);

  return {
    videoDurationSec,
    trimSourceVideoUrl,
    committedRange: params.seed?.committedRange ?? defaultRange,
    draftRange: params.seed?.draftRange ?? defaultRange,
    loadPhase: ready ? "ready" : (params.seed?.loadPhase ?? "loading"),
    playbackPaused: params.seed?.playbackPaused ?? false,
  };
}

export function VideoRetakeToolbarButton({
  sourceNodeId,
  sourceVideo,
  disabled = false,
}: VideoRetakeToolbarButtonProps) {
  const { t } = useTranslation();
  const { organization } = useAuth();
  const { id: workflowId } = useParams<{ id: string }>();
  const orgId = organization?.id;
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

      const copy = createLockedRetakeCopyNode(
        sourceVideo as unknown as WorkflowMediaValue
      );
      if (!copy) {
        return;
      }

      void (async () => {
        const seed =
          orgId && workflowId
            ? await enrichRetakePlaybackSeed({
                seed: trimSeed,
                sourceVideo,
                organizationId: orgId,
                workflowId,
              })
            : trimSeed;

        if (!seed || !updateNodeData) {
          return;
        }

        updateNodeData(copy.nodeId, (current) =>
          withAiVideoRetakeDraft(current, {
            videoDurationSec: seed.videoDurationSec,
            trimSourceVideoUrl: seed.trimSourceVideoUrl,
            committedRange: seed.committedRange,
            draftRange: seed.draftRange,
            loadPhase: seed.loadPhase,
            playbackPaused: seed.playbackPaused ?? false,
          })
        );
      })();
    },
    [
      createLockedRetakeCopyNode,
      orgId,
      sourceNodeId,
      sourceVideo,
      trimSessionApi,
      updateNodeData,
      workflowId,
    ]
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
