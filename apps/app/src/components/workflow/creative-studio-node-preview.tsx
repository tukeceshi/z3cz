import {
  AI_AUDIO_NODE_TYPE,
  AI_IMAGE_NODE_TYPE,
  AI_TEXT_NODE_TYPE,
  AI_VIDEO_NODE_TYPE,
  getMediaReferenceKey,
  isMediaReference,
  type MediaReference,
} from "@dafthunk/types";
import { useNodes, type Node as ReactFlowNode } from "@xyflow/react";
import Music from "lucide-react/icons/music";
import Play from "lucide-react/icons/play";
import Type from "lucide-react/icons/type";
import LoaderIcon from "lucide-react/icons/loader-circle";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useTranslation } from "@/components/locale-provider";
import { useMediaDisplayUrl } from "@/hooks/use-media-display-url";
import { useReferenceThumbUrl } from "@/hooks/use-reference-thumb-url";
import { cn } from "@/utils/utils";

import { readAiAudioCardAudios } from "./ai-audio-node-utils";
import { collectAiImageUnifiedReferenceChips } from "./ai-image-prompt-reference";
import { readAiImageCardImages } from "./ai-image-node-utils";
import { readAiTextResult } from "./ai-text-node-utils";
import { collectAiVideoUnifiedReferenceChips } from "./ai-video-prompt-reference";
import { readAiVideoCardVideos } from "./ai-video-node-utils";
import { fitStudioDetailSize } from "./creative-studio-detail-size";
import { StudioMediaEmptyPreview } from "./creative-studio-media-preview-frame";
import { readStudioMediaCardState } from "./studio-media-card-state";
import {
  STUDIO_MEDIA_PREVIEW_MEDIA,
  STUDIO_PREVIEW_MEDIA_FALLBACK,
  STUDIO_REFERENCE_THUMB,
  STUDIO_REFERENCE_THUMB_FALLBACK,
  STUDIO_REFERENCE_THUMB_ROW,
  STUDIO_SCROLL,
} from "./creative-studio-surface";
import { MediaImageField } from "./fields/media-image-field";
import { WorkflowMediaAudioPlayer } from "./workflow-media-audio-player";
import { WorkflowMediaVideoPlayer } from "./workflow-media-video-player";
import type { WorkflowNodeType } from "./workflow-types";
import { useWorkflow } from "./workflow-context";

export interface CreativeStudioNodePreviewProps {
  readonly nodeId: string;
  readonly data: WorkflowNodeType;
  readonly variant?: "card" | "detail";
  readonly className?: string;
}

const DEFAULT_DETAIL_ASPECT_RATIO = 16 / 9;

const STUDIO_DETAIL_MEDIA_FRAME =
  "relative shrink-0 overflow-hidden rounded-xl border border-border/50 bg-card dark:border-neutral-700 dark:bg-neutral-800";

interface StudioDetailBounds {
  readonly width: number;
  readonly height: number;
}

interface StudioMediaIntrinsicSize {
  readonly width: number;
  readonly height: number;
}

function applyDetailMediaSize(
  width: number,
  height: number,
  setAspectRatio: (ratio: number) => void,
  setNaturalSize: (size: StudioMediaIntrinsicSize) => void
) {
  if (width > 0 && height > 0) {
    setAspectRatio(width / height);
    setNaturalSize({ width, height });
  }
}

function readStudioDetailContentBounds(element: HTMLDivElement): StudioDetailBounds {
  const style = getComputedStyle(element);
  const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
  const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);

  return {
    width: Math.max(0, element.clientWidth - padX),
    height: Math.max(0, element.clientHeight - padY),
  };
}

function useStudioDetailPreviewBounds() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState<StudioDetailBounds>({ width: 0, height: 0 });

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const updateBounds = (width: number, height: number) => {
      setBounds({ width, height });
    };

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      updateBounds(entry.contentRect.width, entry.contentRect.height);
    });

    observer.observe(element);
    const initialBounds = readStudioDetailContentBounds(element);
    updateBounds(initialBounds.width, initialBounds.height);

    return () => {
      observer.disconnect();
    };
  }, []);

  return { containerRef, bounds };
}

function StudioDetailMediaFrame({
  aspectRatio,
  naturalSize,
  isVideo,
  className,
  children,
}: {
  readonly aspectRatio: number;
  readonly naturalSize: StudioMediaIntrinsicSize | null;
  readonly isVideo: boolean;
  readonly className?: string;
  readonly children: ReactNode;
}) {
  const { containerRef, bounds } = useStudioDetailPreviewBounds();

  const displaySize = useMemo(
    () =>
      fitStudioDetailSize(
        bounds.width,
        bounds.height,
        aspectRatio,
        naturalSize?.width,
        naturalSize?.height
      ),
    [aspectRatio, bounds.height, bounds.width, naturalSize]
  );

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
            isVideo ? "dark:bg-black" : undefined
          )}
          style={{
            width: displaySize.width,
            height: displaySize.height,
          }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

function StudioDetailImagePreview({
  media,
  className,
}: {
  readonly media: MediaReference;
  readonly className?: string;
}) {
  const [aspectRatio, setAspectRatio] = useState(DEFAULT_DETAIL_ASPECT_RATIO);
  const [naturalSize, setNaturalSize] = useState<StudioMediaIntrinsicSize | null>(
    null
  );

  const { displayUrl, stale } = useMediaDisplayUrl({
    media,
    nodeType: "ai-image",
    size: "full",
  });

  if (stale || !displayUrl) {
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center",
          STUDIO_PREVIEW_MEDIA_FALLBACK,
          className
        )}
      />
    );
  }

  return (
    <StudioDetailMediaFrame
      aspectRatio={aspectRatio}
      naturalSize={naturalSize}
      isVideo={false}
      className={className}
    >
      <img
        src={displayUrl}
        alt=""
        loading="lazy"
        decoding="async"
        className={STUDIO_MEDIA_PREVIEW_MEDIA}
        onLoad={(event) => {
          applyDetailMediaSize(
            event.currentTarget.naturalWidth,
            event.currentTarget.naturalHeight,
            setAspectRatio,
            setNaturalSize
          );
        }}
      />
    </StudioDetailMediaFrame>
  );
}

function StudioDetailVideoPreview({
  media,
  className,
}: {
  readonly media: MediaReference;
  readonly className?: string;
}) {
  const [aspectRatio, setAspectRatio] = useState(DEFAULT_DETAIL_ASPECT_RATIO);
  const [naturalSize, setNaturalSize] = useState<StudioMediaIntrinsicSize | null>(
    null
  );

  const { displayUrl, stale } = useMediaDisplayUrl({
    media,
    nodeType: "ai-video",
    size: "full",
  });

  if (stale || !displayUrl) {
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center",
          STUDIO_PREVIEW_MEDIA_FALLBACK,
          className
        )}
      >
        <Play className="h-8 w-8 opacity-40" />
      </div>
    );
  }

  return (
    <StudioDetailMediaFrame
      aspectRatio={aspectRatio}
      naturalSize={naturalSize}
      isVideo
      className={className}
    >
      <video
        src={displayUrl}
        className={STUDIO_MEDIA_PREVIEW_MEDIA}
        controls
        playsInline
        preload="metadata"
        onLoadedMetadata={(event) => {
          applyDetailMediaSize(
            event.currentTarget.videoWidth,
            event.currentTarget.videoHeight,
            setAspectRatio,
            setNaturalSize
          );
        }}
      />
    </StudioDetailMediaFrame>
  );
}

function StudioVideoPreview({
  media,
  variant,
  className,
}: {
  readonly media: MediaReference;
  readonly variant: "card" | "detail";
  readonly className?: string;
}) {
  const { displayUrl, stale } = useMediaDisplayUrl({
    media,
    nodeType: "ai-video",
    size: variant === "card" ? "thumb" : "full",
  });

  if (stale || !displayUrl) {
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center",
          STUDIO_PREVIEW_MEDIA_FALLBACK,
          className
        )}
      >
        <Play className="h-8 w-8 opacity-40" />
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div className={cn("relative h-full w-full overflow-hidden bg-card dark:bg-black", className)}>
        <video
          src={displayUrl}
          className="h-full w-full object-contain"
          muted
          playsInline
          preload="metadata"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <Play className="h-6 w-6 text-white/90" />
        </div>
      </div>
    );
  }

  return (
    <WorkflowMediaVideoPlayer
      src={displayUrl}
      className={cn("h-full w-full", className)}
      objectFit="contain"
      variant="card"
    />
  );
}

function StudioAudioPreview({
  media,
  variant,
  className,
}: {
  readonly media: MediaReference;
  readonly variant: "card" | "detail";
  readonly className?: string;
}) {
  const { displayUrl, stale } = useMediaDisplayUrl({
    media,
    nodeType: "ai-audio",
    size: variant === "card" ? "thumb" : "full",
  });

  if (stale || !displayUrl) {
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center gap-2",
          STUDIO_PREVIEW_MEDIA_FALLBACK,
          className
        )}
      >
        <Music className="h-5 w-5" />
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center gap-2 bg-muted text-muted-foreground",
          className
        )}
      >
        <Music className="h-5 w-5 shrink-0" />
        <span className="truncate text-xs">{getMediaReferenceKey(media)}</span>
      </div>
    );
  }

  return (
    <WorkflowMediaAudioPlayer
      src={displayUrl}
      className={cn("mx-auto h-full w-full max-w-lg", className)}
      variant="card"
      waveformCacheKey={getMediaReferenceKey(media) ?? undefined}
    />
  );
}

function StudioDetailImageContent({
  media,
  metadata,
  className,
}: {
  readonly media: MediaReference | undefined;
  readonly metadata: Record<string, string> | undefined;
  readonly className?: string;
}) {
  const { t } = useTranslation();
  const cardState = readStudioMediaCardState(metadata, false);
  const { displayUrl, stale } = useMediaDisplayUrl({
    media: media ?? null,
    nodeType: "ai-image",
    size: "full",
  });
  const canPreview = media != null && displayUrl != null && !stale;

  if (!canPreview) {
    return (
      <StudioMediaEmptyPreview
        layout="detail"
        isVideo={false}
        message={t(cardState.placeholderKey)}
        busy={cardState.isBusy}
        className={className}
      />
    );
  }

  return <StudioDetailImagePreview media={media} className={className} />;
}

function StudioDetailVideoContent({
  media,
  metadata,
  className,
}: {
  readonly media: MediaReference | undefined;
  readonly metadata: Record<string, string> | undefined;
  readonly className?: string;
}) {
  const { t } = useTranslation();
  const cardState = readStudioMediaCardState(metadata, true);
  const { displayUrl, stale } = useMediaDisplayUrl({
    media: media ?? null,
    nodeType: "ai-video",
    size: "full",
  });
  const canPreview = media != null && displayUrl != null && !stale;

  if (!canPreview) {
    return (
      <StudioMediaEmptyPreview
        layout="detail"
        isVideo
        message={t(cardState.placeholderKey)}
        busy={cardState.isBusy}
        className={className}
      />
    );
  }

  return <StudioDetailVideoPreview media={media} className={className} />;
}

export function CreativeStudioNodePreview({
  data,
  variant = "detail",
  className,
}: CreativeStudioNodePreviewProps) {
  const { t } = useTranslation();
  const nodeType = data.nodeType ?? "";

  const text = readAiTextResult(data.inputs, data.outputs)?.trim() ?? "";
  const images = readAiImageCardImages(data.inputs, data.outputs, data.metadata);
  const videos = readAiVideoCardVideos(data.inputs, data.outputs, data.metadata);
  const audios = readAiAudioCardAudios(data.inputs, data.outputs, data.metadata);

  const primaryImage = images[0];
  const primaryVideo = videos[0];
  const primaryAudio = audios[0];

  if (nodeType === AI_TEXT_NODE_TYPE) {
    return (
      <div
        className={cn(
          "h-full w-full overflow-auto p-4",
          STUDIO_SCROLL,
          className
        )}
      >
        {text ? (
          <p
            className={cn(
              "w-full whitespace-pre-wrap text-foreground/90",
              variant === "detail"
                ? "text-base leading-relaxed"
                : "line-clamp-4 text-xs leading-relaxed"
            )}
          >
            {text}
          </p>
        ) : (
          <EmptyPreview variant={variant} message={t("workflow.studio.emptyMedia")} />
        )}
      </div>
    );
  }

  if (nodeType === AI_IMAGE_NODE_TYPE) {
    if (variant === "detail") {
      return (
        <StudioDetailImageContent
          media={primaryImage}
          metadata={data.metadata}
          className={className}
        />
      );
    }
    if (!primaryImage) {
      const cardState = readStudioMediaCardState(data.metadata, false);
      return (
        <StudioMediaEmptyPreview
          layout="list"
          isVideo={false}
          message={t(cardState.placeholderKey)}
          busy={cardState.isBusy}
          className={className}
        />
      );
    }
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center overflow-hidden",
          className
        )}
      >
        <MediaImageField
          value={primaryImage}
          size="thumb"
          className="h-full w-full"
          imageClassName="object-contain"
        />
      </div>
    );
  }

  if (nodeType === AI_VIDEO_NODE_TYPE) {
    if (variant === "detail") {
      return (
        <StudioDetailVideoContent
          media={primaryVideo}
          metadata={data.metadata}
          className={className}
        />
      );
    }
    if (!primaryVideo) {
      const cardState = readStudioMediaCardState(data.metadata, true);
      return (
        <StudioMediaEmptyPreview
          layout="list"
          isVideo
          message={t(cardState.placeholderKey)}
          busy={cardState.isBusy}
          className={className}
        />
      );
    }
    return (
      <StudioVideoPreview media={primaryVideo} variant={variant} className={className} />
    );
  }

  if (nodeType === AI_AUDIO_NODE_TYPE) {
    if (!primaryAudio) {
      return (
        <EmptyPreview
          variant={variant}
          message={t("workflow.studio.emptyMedia")}
          className={className}
        />
      );
    }
    return (
      <StudioAudioPreview media={primaryAudio} variant={variant} className={className} />
    );
  }

  return null;
}

function EmptyPreview({
  variant,
  message,
  busy = false,
  className,
}: {
  readonly variant: "card" | "detail";
  readonly message: string;
  readonly busy?: boolean;
  readonly className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground/50",
        variant === "card" ? "text-[11px] italic" : "text-sm",
        className
      )}
    >
      {busy ? (
        <LoaderIcon className="size-5 animate-spin text-yellow-500" aria-hidden />
      ) : null}
      {message}
    </div>
  );
}

export interface CreativeStudioReferenceThumbsProps {
  readonly nodeId: string;
  readonly data: WorkflowNodeType;
  readonly max?: number;
}

export function CreativeStudioReferenceThumbs({
  nodeId,
  data,
  max = 3,
}: CreativeStudioReferenceThumbsProps) {
  const { edges = [] } = useWorkflow();
  const nodes = useNodes<WorkflowNodeType>();

  const typedNodes = nodes as unknown as readonly ReactFlowNode<WorkflowNodeType>[];
  const nodeType = data.nodeType ?? "";

  const chips = useMemo(() => {
    if (nodeType === AI_IMAGE_NODE_TYPE) {
      return collectAiImageUnifiedReferenceChips({
        nodeId,
        edges,
        nodes: typedNodes,
      }).filter((chip) => chip.kind === "image");
    }
    if (nodeType === AI_VIDEO_NODE_TYPE) {
      return collectAiVideoUnifiedReferenceChips({
        nodeId,
        edges,
        nodes: typedNodes,
      }).filter((chip) => chip.kind === "image");
    }
    return [];
  }, [edges, nodeId, nodeType, typedNodes]);

  const visible = chips.slice(0, max);
  if (visible.length === 0) {
    return null;
  }

  return (
    <div className={STUDIO_REFERENCE_THUMB_ROW}>
      {visible.map((chip) => (
        <ReferenceThumb key={chip.edgeId} chip={chip} />
      ))}
    </div>
  );
}

function ReferenceThumb({
  chip,
}: {
  readonly chip: { readonly media?: MediaReference };
}) {
  const media =
    chip.media && isMediaReference(chip.media) ? chip.media : null;
  const thumbUrl = useReferenceThumbUrl({
    media,
    nodeType: "ai-image",
  });

  if (thumbUrl) {
    return (
      <img
        src={thumbUrl}
        alt=""
        className={STUDIO_REFERENCE_THUMB}
      />
    );
  }

  return (
    <div className={STUDIO_REFERENCE_THUMB_FALLBACK}>
      <Type className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}
