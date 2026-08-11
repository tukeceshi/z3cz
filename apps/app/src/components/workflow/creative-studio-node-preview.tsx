import {
  AI_AUDIO_NODE_TYPE,
  AI_IMAGE_NODE_TYPE,
  AI_TEXT_NODE_TYPE,
  AI_VIDEO_NODE_TYPE,
  getMediaReferenceKey,
  isWorkflowMediaValue,
  type GenerativeCardError,
  type MediaReference,
} from "@dafthunk/types";
import { useNodes, type Node as ReactFlowNode } from "@xyflow/react";
import Music from "lucide-react/icons/music";
import Play from "lucide-react/icons/play";
import Type from "lucide-react/icons/type";
import LoaderIcon from "lucide-react/icons/loader-circle";
import { useMemo } from "react";

import { useTranslation } from "@/components/locale-provider";
import { useAuth } from "@/components/auth-context";
import { useMediaDisplayUrl } from "@/hooks/use-media-display-url";
import { useReferenceThumbUrl } from "@/hooks/use-reference-thumb-url";
import { useResolvedAiText } from "@/hooks/use-resolved-ai-text";
import { cn } from "@/utils/utils";

import { readAiAudioCardAudios, isAiAudioGenerating } from "./ai-audio-node-utils";
import { collectAiImageUnifiedReferenceChips } from "./ai-image-prompt-reference";
import { readAiImageCardPrimaryImage } from "./ai-image-node-utils";
import { collectAiVideoUnifiedReferenceChips } from "./ai-video-prompt-reference";
import { readAiVideoCardPrimaryVideo } from "./ai-video-node-utils";
import { GenerativeBusyOverlay } from "./generative-busy-overlay";
import { GenerativeCardErrorBlock } from "./generative-card-error-block";
import { GenerativeCardEmptyUploadSlot } from "./generative-card-empty-upload-slot";
import type { GenerativeCardUploadKind } from "./generative-card-upload-utils";
import { StudioMediaEmptyPreview } from "./creative-studio-media-preview-frame";
import { readStudioMediaCardState } from "./studio-media-card-state";
import { StudioMediaFullPreview } from "./studio-media-full-preview";
import { useCreativeStudio } from "./creative-studio-context";
import {
  STUDIO_PREVIEW_MEDIA_FALLBACK,
  STUDIO_REFERENCE_THUMB,
  STUDIO_REFERENCE_THUMB_FALLBACK,
  STUDIO_REFERENCE_THUMB_ROW,
  STUDIO_SCROLL,
} from "./creative-studio-surface";
import { MediaImageField } from "./fields/media-image-field";
import { WorkflowMediaAudioPlayer } from "./workflow-media-audio-player";
import {
  WorkflowMediaVideoPlayer,
} from "./workflow-media-video-player";
import type { WorkflowNodeType } from "./workflow-types";
import { useWorkflow } from "./workflow-context";

export interface CreativeStudioEmptyUploadConfig {
  readonly kind: GenerativeCardUploadKind;
  readonly canUpload: boolean;
  readonly onUploadClick: () => void;
}

export interface CreativeStudioNodePreviewProps {
  readonly nodeId: string;
  readonly data: WorkflowNodeType;
  readonly variant?: "card" | "detail";
  readonly className?: string;
  readonly uploading?: boolean;
  readonly generateError?: GenerativeCardError;
  readonly onVideoExpandView?: () => void;
  readonly emptyUpload?: CreativeStudioEmptyUploadConfig;
  readonly detailDisplayUrl?: string | null;
  readonly detailDisplayStale?: boolean;
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
  displayUrl: displayUrlOverride,
  stale: staleOverride,
}: {
  readonly media: MediaReference;
  readonly variant: "card" | "detail";
  readonly className?: string;
  readonly displayUrl?: string | null;
  readonly stale?: boolean;
}) {
  const resolved = useMediaDisplayUrl({
    media: displayUrlOverride === undefined ? media : null,
    nodeType: "ai-audio",
    size: variant === "card" ? "thumb" : "full",
  });
  const displayUrl = displayUrlOverride ?? resolved.displayUrl;
  const stale = staleOverride ?? resolved.stale;

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

interface StudioDetailMediaPreviewProps {
  readonly media: MediaReference | undefined;
  readonly isVideo: boolean;
  readonly metadata: Record<string, string> | undefined;
  readonly nodeId: string;
  readonly uploading?: boolean;
  readonly generateError?: GenerativeCardError;
  readonly className?: string;
  readonly onVideoExpandView?: () => void;
  readonly emptyUpload?: CreativeStudioEmptyUploadConfig;
  readonly detailDisplayUrl?: string | null;
  readonly detailDisplayStale?: boolean;
}

function StudioDetailMediaPreview({
  media,
  isVideo,
  metadata,
  nodeId,
  uploading = false,
  generateError,
  className,
  onVideoExpandView,
  emptyUpload,
  detailDisplayUrl,
  detailDisplayStale,
}: StudioDetailMediaPreviewProps) {
  const { t } = useTranslation();
  const cardState = readStudioMediaCardState(metadata, isVideo);
  const modality = isVideo ? "video" : "image";
  const resolved = useMediaDisplayUrl({
    media: detailDisplayUrl === undefined ? (media ?? null) : null,
    nodeType: isVideo ? "ai-video" : "ai-image",
    size: "full",
  });
  const displayUrl = detailDisplayUrl ?? resolved.displayUrl;
  const stale = detailDisplayStale ?? resolved.stale;
  const canPreview = media != null && displayUrl != null && !stale;
  const isBusy = cardState.isBusy || uploading;

  const busyOverlay = (
    <GenerativeBusyOverlay
      visible={isBusy}
      modality={modality}
      metadata={metadata}
      nodeId={nodeId}
      uploading={uploading}
      roundedClass="rounded-xl"
    />
  );

  if (media == null || !canPreview) {
    if (emptyUpload && !isBusy) {
      return (
        <div
          className={cn(
            "flex h-full w-full items-center justify-center p-4",
            className
          )}
        >
          <div className="relative w-full max-w-2xl overflow-hidden rounded-xl border border-border/50 bg-card dark:border-neutral-700 dark:bg-neutral-800">
            <GenerativeCardEmptyUploadSlot
              kind={emptyUpload.kind}
              size="studio-detail"
              canUpload={emptyUpload.canUpload}
              onUploadClick={emptyUpload.onUploadClick}
              className="py-8"
            />
            {generateError ? (
              <GenerativeCardErrorBlock error={generateError} />
            ) : null}
          </div>
        </div>
      );
    }

    return (
      <StudioMediaEmptyPreview
        layout="detail"
        isVideo={isVideo}
        message={t(cardState.placeholderKey)}
        busy={cardState.isBusy}
        className={className}
        busyOverlay={
          <>
            {busyOverlay}
            {generateError ? (
              <GenerativeCardErrorBlock error={generateError} />
            ) : null}
          </>
        }
      />
    );
  }

  return (
    <StudioMediaFullPreview
      media={media}
      nodeType={isVideo ? "ai-video" : "ai-image"}
      className={className}
      nodeId={nodeId}
      metadata={metadata}
      uploading={uploading}
      isBusy={cardState.isBusy}
      generateError={generateError}
      onVideoExpandView={isVideo ? onVideoExpandView : undefined}
      displayUrl={displayUrl}
    />
  );
}

export function CreativeStudioNodePreview({
  data,
  variant = "detail",
  className,
  nodeId,
  uploading = false,
  generateError,
  onVideoExpandView,
  emptyUpload,
  detailDisplayUrl,
  detailDisplayStale,
}: CreativeStudioNodePreviewProps) {
  const { t } = useTranslation();
  const { organization } = useAuth();
  const { workflowId } = useCreativeStudio();
  const nodeType = data.nodeType ?? "";
  const resolvedText = useResolvedAiText({
    organizationId: organization?.id,
    workflowId,
    inputs: data.inputs,
    outputs: data.outputs,
  });
  const textPreview = (resolvedText.excerpt ?? resolvedText.text).trim();

  const primaryImage = readAiImageCardPrimaryImage(
    data.inputs,
    data.outputs,
    data.metadata
  );
  const primaryVideo = readAiVideoCardPrimaryVideo(
    data.inputs,
    data.outputs,
    data.metadata
  );
  const audios = readAiAudioCardAudios(data.inputs, data.outputs, data.metadata);

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
        {textPreview ? (
          <p
            className={cn(
              "w-full whitespace-pre-wrap text-foreground/90",
              variant === "detail"
                ? "text-base leading-relaxed"
                : "line-clamp-4 text-xs leading-relaxed"
            )}
          >
            {textPreview}
          </p>
        ) : resolvedText.loading ? (
          <div className="flex h-full w-full items-center justify-center">
            <LoaderIcon className="size-5 animate-spin text-muted-foreground/50" />
          </div>
        ) : (
          <EmptyPreview variant={variant} message={t("workflow.studio.emptyMedia")} />
        )}
      </div>
    );
  }

  if (nodeType === AI_IMAGE_NODE_TYPE) {
    if (variant === "detail") {
      return (
        <StudioDetailMediaPreview
          media={primaryImage}
          isVideo={false}
          metadata={data.metadata}
          nodeId={nodeId}
          uploading={uploading}
          generateError={generateError}
          className={className}
          emptyUpload={emptyUpload?.kind === "image" ? emptyUpload : undefined}
          detailDisplayUrl={detailDisplayUrl}
          detailDisplayStale={detailDisplayStale}
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
        <StudioDetailMediaPreview
          media={primaryVideo}
          isVideo
          metadata={data.metadata}
          nodeId={nodeId}
          uploading={uploading}
          generateError={generateError}
          className={className}
          onVideoExpandView={onVideoExpandView}
          emptyUpload={emptyUpload?.kind === "video" ? emptyUpload : undefined}
          detailDisplayUrl={detailDisplayUrl}
          detailDisplayStale={detailDisplayStale}
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
      const audioBusy = isAiAudioGenerating(data.metadata) || uploading;
      if (
        variant === "detail" &&
        emptyUpload?.kind === "audio" &&
        !audioBusy
      ) {
        return (
          <div
            className={cn(
              "flex h-full w-full items-center justify-center p-4",
              className
            )}
          >
            <GenerativeCardEmptyUploadSlot
              kind="audio"
              size="studio-detail"
              canUpload={emptyUpload.canUpload}
              onUploadClick={emptyUpload.onUploadClick}
              className="py-8"
            />
          </div>
        );
      }
      return (
        <EmptyPreview
          variant={variant}
          message={t("workflow.studio.emptyMedia")}
          busy={audioBusy}
          className={className}
        />
      );
    }
    return (
      <StudioAudioPreview
        media={primaryAudio}
        variant={variant}
        className={className}
        displayUrl={variant === "detail" ? detailDisplayUrl : undefined}
        stale={variant === "detail" ? detailDisplayStale : undefined}
      />
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
    chip.media && isWorkflowMediaValue(chip.media) ? chip.media : null;
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
