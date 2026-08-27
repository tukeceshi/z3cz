import {
  AI_VIDEO_NODE_TYPE,
  isWorkflowMediaValue,
} from "@dafthunk/types";
import type { Node as ReactFlowNode } from "@xyflow/react";
import { useMemo, useRef, useState } from "react";

import { useMediaDisplayUrlSet } from "@/hooks/use-media-display-url-set";
import { resolveMediaDisplay } from "@/services/media-display-readiness";
import { cn } from "@/utils/utils";

import { readAiImageCardPrimaryImage } from "./ai-image-node-utils";
import { readAiVideoCardPrimaryVideo } from "./ai-video-node-utils";
import {
  readStudioModelLabel,
  readStudioVideoResolution,
} from "./creative-studio-media-meta";
import {
  CreativeStudioMediaPreviewFrame,
} from "./creative-studio-media-preview-frame";
import {
  STUDIO_MEDIA_CARD,
} from "./creative-studio-surface";
import { GenerativeCardErrorBlock } from "./generative-card-error-block";
import { CreativeStudioListItemFooter } from "./creative-studio-list-item-footer";
import { useCreativeStudio } from "./creative-studio-context";
import { readStudioMediaCardState } from "./studio-media-card-state";
import {
  useStudioImageFileSize,
  useStudioVideoFileDuration,
} from "./studio-media-file-meta";
import { studioReferenceDragSourceProps } from "./studio-reference-drag";
import { useGenerativeNodeCardHydrate } from "./use-generative-node-card-hydrate";
import type { WorkflowNodeType } from "./workflow-types";

export interface CreativeStudioMediaCardProps {
  readonly node: ReactFlowNode<WorkflowNodeType>;
  readonly onOpenDetail: () => void;
  readonly onCancelPendingListClick?: () => void;
  readonly referenceDragEnabled?: boolean;
}

export function CreativeStudioMediaCard({
  node,
  onOpenDetail,
  onCancelPendingListClick,
  referenceDragEnabled = false,
}: CreativeStudioMediaCardProps) {
  useGenerativeNodeCardHydrate(node);
  const nodeType = node.data.nodeType ?? "";
  const isVideo = nodeType === AI_VIDEO_NODE_TYPE;
  const primaryMedia = isVideo
    ? readAiVideoCardPrimaryVideo(
        node.data.inputs,
        node.data.outputs,
        node.data.metadata
      )
    : readAiImageCardPrimaryImage(
        node.data.inputs,
        node.data.outputs,
        node.data.metadata
      );
  const cardState = readStudioMediaCardState(
    node.data.metadata,
    isVideo,
    primaryMedia ? [primaryMedia] : undefined
  );

  const mediaRef =
    primaryMedia && isWorkflowMediaValue(primaryMedia) ? primaryMedia : null;

  const { urlSet, stale } = useMediaDisplayUrlSet({
    media: mediaRef,
    nodeType: isVideo ? "ai-video" : "ai-image",
  });

  const previewDisplay = useMemo(
    () =>
      resolveMediaDisplay({
        media: mediaRef,
        urlSet,
        size: "thumb",
        stale,
      }),
    [mediaRef, stale, urlSet]
  );
  const fullDisplay = useMemo(
    () =>
      resolveMediaDisplay({
        media: mediaRef,
        urlSet,
        size: "full",
        stale,
      }),
    [mediaRef, stale, urlSet]
  );

  const metaProbeUrl =
    fullDisplay.phase === "ready" ? fullDisplay.displayUrl : null;

  const imageSize = useStudioImageFileSize(isVideo ? null : metaProbeUrl);
  const videoDuration = useStudioVideoFileDuration(isVideo ? metaProbeUrl : null);
  const modelLabel = readStudioModelLabel(node.data);
  const videoResolution = isVideo
    ? readStudioVideoResolution(node.data)
    : null;

  const metaTags = useMemo(() => {
    const tags: string[] = [];
    if (modelLabel) {
      tags.push(modelLabel);
    }
    if (isVideo) {
      if (videoDuration) {
        tags.push(videoDuration);
      }
      if (videoResolution) {
        tags.push(videoResolution);
      }
    } else if (imageSize) {
      tags.push(imageSize);
    }
    return tags;
  }, [
    imageSize,
    isVideo,
    modelLabel,
    videoDuration,
    videoResolution,
  ]);

  const { isListNodeRenaming } = useCreativeStudio();
  const isRenaming = isListNodeRenaming(node.id);
  const cardRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragProps = studioReferenceDragSourceProps(
    node,
    referenceDragEnabled && !isRenaming,
    {
      dragImageRootRef: cardRef,
      onDragStateChange: setIsDragging,
      onDragStart: onCancelPendingListClick,
    }
  );

  return (
    <div
      ref={cardRef}
      className={cn(
        STUDIO_MEDIA_CARD,
        "w-full",
        referenceDragEnabled && !isRenaming && "cursor-grab",
        isDragging && "opacity-50"
      )}
      {...dragProps}
    >
      <button
        type="button"
        className="relative w-full text-left"
        onClick={onOpenDetail}
      >
        <CreativeStudioMediaPreviewFrame
          media={mediaRef}
          displayUrl={previewDisplay.displayUrl}
          phase={previewDisplay.phase}
          isVideo={isVideo}
          referenceDragEnabled={referenceDragEnabled}
          fallbackBusy={cardState.isBusy}
        />
        {cardState.generateError ? (
          <GenerativeCardErrorBlock error={cardState.generateError} />
        ) : null}
      </button>

      <CreativeStudioListItemFooter
        node={node}
        onOpenDetail={onOpenDetail}
        metaTags={metaTags}
      />
    </div>
  );
}
