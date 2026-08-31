import {
  createDefaultVideoRetakeTrimRange,
  resolveRetakeDefaultResolutionFromSource,
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
  resolveRetakeVideoDimensions,
  resolveRetakeVideoDurationSec,
} from "./video-trim-utils";
import { useWorkflow } from "./workflow-context";

export interface VideoRetakeToolbarButtonProps {
  readonly sourceNodeId: string;
  readonly sourceVideo: MediaReference;
  readonly disabled?: boolean;
}

type RetakeDraftSeed = Pick<
  VideoSegmentPlaybackSeed,
  | "videoDurationSec"
  | "committedRange"
  | "draftRange"
  | "loadPhase"
  | "playbackPaused"
> & {
  readonly sourceVideoWidth: number | null;
  readonly sourceVideoHeight: number | null;
  readonly generationParams: Readonly<Record<string, unknown>>;
};

async function enrichRetakeDraftSeed(params: {
  readonly seed: VideoSegmentPlaybackSeed | undefined;
  readonly sourceVideo: MediaReference;
  readonly organizationId: string;
  readonly workflowId: string;
}): Promise<RetakeDraftSeed | undefined> {
  const [videoDurationSec, dimensions] = await Promise.all([
    resolveRetakeVideoDurationSec({
      media: params.sourceVideo,
      organizationId: params.organizationId,
      workflowId: params.workflowId,
      knownDurationSec: params.seed?.videoDurationSec,
    }),
    resolveRetakeVideoDimensions({
      media: params.sourceVideo,
      organizationId: params.organizationId,
      workflowId: params.workflowId,
    }),
  ]);

  if (videoDurationSec === null && !params.seed) {
    return undefined;
  }

  const defaultRange = createDefaultVideoRetakeTrimRange(videoDurationSec ?? 0);
  const ready = videoDurationSec !== null && videoDurationSec > 0;
  const sourceVideoWidth = dimensions?.width ?? null;
  const sourceVideoHeight = dimensions?.height ?? null;
  const sourceResolution = resolveRetakeDefaultResolutionFromSource({
    width: sourceVideoWidth,
    height: sourceVideoHeight,
  });

  return {
    videoDurationSec,
    committedRange: params.seed?.committedRange ?? defaultRange,
    draftRange: params.seed?.draftRange ?? defaultRange,
    loadPhase: ready ? "ready" : (params.seed?.loadPhase ?? "loading"),
    playbackPaused: params.seed?.playbackPaused ?? false,
    sourceVideoWidth,
    sourceVideoHeight,
    generationParams:
      sourceResolution !== null ? { resolution: sourceResolution } : {},
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
            ? await enrichRetakeDraftSeed({
                seed: trimSeed,
                sourceVideo,
                organizationId: orgId,
                workflowId,
              })
            : trimSeed
              ? {
                  videoDurationSec: trimSeed.videoDurationSec,
                  committedRange: trimSeed.committedRange,
                  draftRange: trimSeed.draftRange,
                  loadPhase: trimSeed.loadPhase,
                  playbackPaused: trimSeed.playbackPaused,
                  sourceVideoWidth: null,
                  sourceVideoHeight: null,
                  generationParams: {},
                }
              : undefined;

        if (!seed || !updateNodeData) {
          return;
        }

        updateNodeData(copy.nodeId, (current) =>
          withAiVideoRetakeDraft(current, {
            videoDurationSec: seed.videoDurationSec,
            committedRange: seed.committedRange,
            draftRange: seed.draftRange,
            loadPhase: seed.loadPhase,
            playbackPaused: seed.playbackPaused ?? false,
            sourceVideoWidth: seed.sourceVideoWidth,
            sourceVideoHeight: seed.sourceVideoHeight,
            generationParams: seed.generationParams,
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
