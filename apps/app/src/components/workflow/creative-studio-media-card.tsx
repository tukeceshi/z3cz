import {
  AI_VIDEO_NODE_TYPE,
  isWorkflowMediaValue,
} from "@dafthunk/types";
import type { Node as ReactFlowNode } from "@xyflow/react";
import { useMemo, useRef, useState } from "react";

import { useMediaDisplayUrlSet } from "@/hooks/use-media-display-url-set";
import { pickMediaDisplayUrl } from "@/services/resolve-resource-display-url";
import { cn } from "@/utils/utils";

import { readAiImageCardPrimaryImage } from "./ai-image-node-utils";
import { readAiVideoCardPrimaryVideo } from "./ai-video-node-utils";
import {
  readStudioModelLabel,
  readStudioVideoResolution,
} from "./creative-studio-media-meta";
import {
  CreativeStudioMediaPreviewFrame,
  CreativeStudioMediaPreviewPlaceholder,
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
  const nodeType = node.data.nodeType ?? "";
  const isVideo = nodeType === AI_VIDEO_NODE_TYPE;
  const cardState = readStudioMediaCardState(node.data.metadata, isVideo);

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

  const mediaRef =
    primaryMedia && isWorkflowMediaValue(primaryMedia) ? primaryMedia : null;

  const { urlSet, stale } = useMediaDisplayUrlSet({
    media: mediaRef,
    nodeType: isVideo ? "ai-video" : "ai-image",
  });

  const displayUrl = pickMediaDisplayUrl(urlSet, "full");
  const fullImageUrl = displayUrl;

  const canPreview =
    mediaRef != null && displayUrl != null && !stale;

  const mediaUrl = canPreview ? displayUrl : null;

  const imageSize = useStudioImageFileSize(isVideo ? null : fullImageUrl);
  const videoDuration = useStudioVideoFileDuration(isVideo ? mediaUrl : null);
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
        {canPreview ? (
          <CreativeStudioMediaPreviewFrame
            media={mediaRef}
            displayUrl={displayUrl}
            stale={stale}
            isVideo={isVideo}
            referenceDragEnabled={referenceDragEnabled}
            fallbackBusy={cardState.isBusy}
          />
        ) : (
          <CreativeStudioMediaPreviewPlaceholder
            isVideo={isVideo}
            busy={cardState.isBusy || (mediaRef != null && stale)}
          />
        )}
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
