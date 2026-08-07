import {
  AI_VIDEO_NODE_TYPE,
  isMediaReference,
} from "@dafthunk/types";
import type { Node as ReactFlowNode } from "@xyflow/react";
import { useMemo } from "react";

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
  hasStudioMediaContent,
} from "./creative-studio-media-preview-frame";
import {
  STUDIO_MEDIA_CARD,
  STUDIO_META_ROW,
  STUDIO_META_TAG,
  STUDIO_NODE_LABEL,
} from "./creative-studio-surface";
import { resolveStudioNodeLabel } from "./creative-studio-utils";
import {
  useStudioImageFileSize,
  useStudioVideoFileDuration,
} from "./studio-media-file-meta";
import type { WorkflowNodeType } from "./workflow-types";

export interface CreativeStudioMediaCardProps {
  readonly node: ReactFlowNode<WorkflowNodeType>;
  readonly onOpenDetail: () => void;
}

export function CreativeStudioMediaCard({
  node,
  onOpenDetail,
}: CreativeStudioMediaCardProps) {
  const { t } = useTranslation();
  const label = resolveStudioNodeLabel(node, t);
  const nodeType = node.data.nodeType ?? "";
  const isVideo = nodeType === AI_VIDEO_NODE_TYPE;
  const hasMedia = hasStudioMediaContent(node.data, isVideo);

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

  const mediaUrl =
    hasMedia && displayUrl && !stale ? displayUrl : null;

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

  return (
    <button
      type="button"
      className={cn(STUDIO_MEDIA_CARD, "w-full")}
      onClick={onOpenDetail}
    >
      {hasMedia ? (
        <CreativeStudioMediaPreviewFrame
          media={mediaRef}
          displayUrl={displayUrl}
          stale={stale}
          isVideo={isVideo}
        />
      ) : (
        <CreativeStudioMediaPreviewPlaceholder
          isVideo={isVideo}
          message={t("workflow.studio.emptyMedia")}
        />
      )}

      <div className="space-y-1">
        <p className={cn(STUDIO_NODE_LABEL, "truncate text-[13px] text-foreground/90")}>
          {label}
        </p>
        {metaTags.length > 0 ? (
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
        ) : null}
      </div>
    </button>
  );
}
