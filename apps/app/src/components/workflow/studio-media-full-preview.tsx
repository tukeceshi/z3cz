import type { MediaReference } from "@dafthunk/types";
import type { GenerativeCardError } from "@dafthunk/types";

import { getResourceIdFromValue } from "@dafthunk/types";
import { useMediaDisplayUrl } from "@/hooks/use-media-display-url";
import { cn } from "@/utils/utils";

import { GenerativeCardErrorBlock } from "./generative-card-error-block";
import {
  GenerativeBusyOverlay,
  type GenerativeBusyModality,
} from "./generative-busy-overlay";
import { useStudioDetailMediaFrameSize } from "./use-studio-detail-media-frame-size";
import { useWorkflowVideoFrameCapture } from "./use-workflow-video-frame-capture";
import { WorkflowMediaVideoPlayer } from "./workflow-media-video-player";

export const STUDIO_DETAIL_MEDIA_FRAME =
  "relative shrink-0 overflow-hidden rounded-xl border border-border/50 dark:border-neutral-700";

const STUDIO_DETAIL_IMAGE_MEDIA = "size-full select-none object-cover";

export interface StudioMediaFullPreviewProps {
  readonly media: MediaReference;
  readonly nodeType: "ai-image" | "ai-video";
  readonly className?: string;
  readonly nodeId: string;
  readonly metadata: Record<string, string> | undefined;
  readonly uploading?: boolean;
  readonly isBusy?: boolean;
  readonly generateError?: GenerativeCardError;
  readonly onVideoExpandView?: () => void;
  readonly displayUrl?: string | null;
}

function readModality(nodeType: "ai-image" | "ai-video"): GenerativeBusyModality {
  return nodeType === "ai-video" ? "video" : "image";
}

function StudioMediaFullItem({
  media,
  nodeType,
  nodeId,
  onNaturalSize,
  onExpandView,
  displayUrl: displayUrlOverride,
}: {
  readonly media: MediaReference;
  readonly nodeType: "ai-image" | "ai-video";
  readonly nodeId: string;
  readonly onNaturalSize?: (width: number, height: number) => void;
  readonly onExpandView?: () => void;
  readonly displayUrl?: string | null;
}) {
  const frameCapture = useWorkflowVideoFrameCapture(
    nodeType === "ai-video" ? nodeId : undefined
  );
  const resolved = useMediaDisplayUrl({
    media: displayUrlOverride === undefined ? media : null,
    nodeType,
    size: "full",
  });
  const displayUrl = displayUrlOverride ?? resolved.displayUrl;
  const stale = displayUrlOverride === undefined ? resolved.stale : false;

  if (stale || !displayUrl) {
    return null;
  }

  if (nodeType === "ai-video") {
    return (
      <WorkflowMediaVideoPlayer
        src={displayUrl}
        variant="card"
        objectFit="contain"
        initialHovered
        className="size-full"
        showFrameCapture={frameCapture.showFrameCapture}
        frameCaptureDisabled={frameCapture.frameCaptureDisabled}
        videoRef={frameCapture.videoRef}
        onFrameCapture={frameCapture.onFrameCapture}
        onExpandView={onExpandView}
        onLoadedMetadata={(video) => {
          onNaturalSize?.(video.videoWidth, video.videoHeight);
        }}
      />
    );
  }

  return (
    <img
      src={displayUrl}
      alt=""
      loading="lazy"
      decoding="async"
      className={STUDIO_DETAIL_IMAGE_MEDIA}
      onLoad={(event) => {
        onNaturalSize?.(
          event.currentTarget.naturalWidth,
          event.currentTarget.naturalHeight
        );
      }}
    />
  );
}

export function StudioMediaFullPreview({
  media,
  nodeType,
  className,
  nodeId,
  metadata,
  uploading = false,
  isBusy = false,
  generateError,
  onVideoExpandView,
  displayUrl,
}: StudioMediaFullPreviewProps) {
  const mediaKey = getResourceIdFromValue(media);
  const { containerRef, displaySize, applyPrimaryNaturalSize } =
    useStudioDetailMediaFrameSize(mediaKey);
  const modality = readModality(nodeType);

  return (
    <div
      ref={containerRef}
      className={cn(
        "box-border flex h-full w-full min-h-0 items-center justify-center overflow-hidden p-4",
        className
      )}
    >
      {displaySize ? (
        <div
          className={cn(
            STUDIO_DETAIL_MEDIA_FRAME,
            nodeType === "ai-video"
              ? "bg-black dark:bg-black"
              : "bg-transparent"
          )}
          style={{
            width: displaySize.width,
            height: displaySize.height,
          }}
        >
          <StudioMediaFullItem
            media={media}
            nodeType={nodeType}
            nodeId={nodeId}
            onNaturalSize={applyPrimaryNaturalSize}
            onExpandView={
              nodeType === "ai-video" ? onVideoExpandView : undefined
            }
            displayUrl={displayUrl}
          />
          <GenerativeBusyOverlay
            visible={isBusy || uploading}
            modality={modality}
            metadata={metadata}
            nodeId={nodeId}
            uploading={uploading}
            roundedClass="rounded-xl"
          />
          {generateError ? <GenerativeCardErrorBlock error={generateError} /> : null}
        </div>
      ) : null}
    </div>
  );
}
