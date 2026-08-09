import {
  AI_VIDEO_NODE_TYPE,
  isMediaReference,
} from "@dafthunk/types";
import type { Node as ReactFlowNode } from "@xyflow/react";
import { useMemo, useRef, useState } from "react";

import { useTranslation } from "@/components/locale-provider";
import { useMediaDisplayUrl } from "@/hooks/use-media-display-url";
import { cn } from "@/utils/utils";

import { readAiImageCardImages } from "./ai-image-node-utils";
import { readAiVideoCardVideos } from "./ai-video-node-utils";
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
  STUDIO_MEDIA_CARD_FOOTER,
  STUDIO_META_ROW,
  STUDIO_META_TAG,
  STUDIO_NODE_LABEL,
  STUDIO_NODE_LABEL_ROW,
} from "./creative-studio-surface";
import { GenerativeCardErrorBlock } from "./generative-card-error-block";
import { CreativeStudioListItemMenu } from "./creative-studio-list-item-menu";
import { resolveStudioNodeLabel } from "./creative-studio-utils";
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
  const { t } = useTranslation();
  const label = resolveStudioNodeLabel(node, t);
  const nodeType = node.data.nodeType ?? "";
  const isVideo = nodeType === AI_VIDEO_NODE_TYPE;
  const cardState = readStudioMediaCardState(node.data.metadata, isVideo);

  const primaryMedia = isVideo
    ? readAiVideoCardVideos(
        node.data.inputs,
        node.data.outputs,
        node.data.metadata
      )[0]
    : readAiImageCardImages(
        node.data.inputs,
        node.data.outputs,
        node.data.metadata
      )[0];

  const mediaRef =
    primaryMedia && isMediaReference(primaryMedia) ? primaryMedia : null;

  const { displayUrl, stale } = useMediaDisplayUrl({
    media: mediaRef,
    nodeType: isVideo ? "ai-video" : "ai-image",
    size: isVideo ? "full" : "canvas-m",
  });

  const { displayUrl: fullImageUrl } = useMediaDisplayUrl({
    media: isVideo ? null : mediaRef,
    nodeType: "ai-image",
    size: "full",
  });

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

  const cardRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragProps = studioReferenceDragSourceProps(node, referenceDragEnabled, {
    dragImageRootRef: cardRef,
    onDragStateChange: setIsDragging,
    onDragStart: onCancelPendingListClick,
  });

  return (
    <div
      ref={cardRef}
      className={cn(
        STUDIO_MEDIA_CARD,
        "w-full",
        referenceDragEnabled && "cursor-grab",
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
            busy={cardState.isBusy}
          />
        )}
        {cardState.generateError ? (
          <GenerativeCardErrorBlock error={cardState.generateError} />
        ) : null}
      </button>

      <div className={STUDIO_MEDIA_CARD_FOOTER}>
        <div className={STUDIO_NODE_LABEL_ROW}>
          <button
            type="button"
            className={cn(
              STUDIO_NODE_LABEL,
              "min-w-0 flex-1 truncate text-left text-[13px] leading-none text-foreground/90"
            )}
            onClick={onOpenDetail}
          >
            {label}
          </button>
          <CreativeStudioListItemMenu nodeId={node.id} />
        </div>
        {metaTags.length > 0 ? (
          <button type="button" className="w-full text-left" onClick={onOpenDetail}>
            <div className={STUDIO_META_ROW}>
              {metaTags.map((tag, index) => (
                <span
                  key={`${tag}-${index}`}
                  className={cn(STUDIO_META_TAG, "truncate")}
                >
                  {tag}
                </span>
              ))}
            </div>
          </button>
        ) : null}
      </div>
    </div>
  );
}
