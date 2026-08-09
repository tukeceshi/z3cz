import type { Node as ReactFlowNode } from "@xyflow/react";
import Music from "lucide-react/icons/music";
import { useRef, useState } from "react";

import { useTranslation } from "@/components/locale-provider";
import { useMediaDisplayUrl } from "@/hooks/use-media-display-url";
import { cn } from "@/utils/utils";

import { readAiAudioCardAudios } from "./ai-audio-node-utils";
import {
  formatStudioDuration,
  useStudioAudioDuration,
} from "./creative-studio-audio-utils";
import { readStudioModelLabel } from "./creative-studio-media-meta";
import {
  STUDIO_AUDIO_TILE_PREVIEW,
  STUDIO_MEDIA_CARD,
  STUDIO_MEDIA_CARD_FOOTER,
  STUDIO_META_ROW,
  STUDIO_META_TAG,
  STUDIO_NODE_LABEL,
  STUDIO_NODE_LABEL_ROW,
} from "./creative-studio-surface";
import { CreativeStudioListItemMenu } from "./creative-studio-list-item-menu";
import { resolveStudioNodeLabel } from "./creative-studio-utils";
import { studioReferenceDragSourceProps } from "./studio-reference-drag";
import type { WorkflowNodeType } from "./workflow-types";

export interface CreativeStudioAudioTileProps {
  readonly node: ReactFlowNode<WorkflowNodeType>;
  readonly onOpenDetail: () => void;
  readonly onCancelPendingListClick?: () => void;
  readonly referenceDragEnabled?: boolean;
}

export function CreativeStudioAudioTile({
  node,
  onOpenDetail,
  onCancelPendingListClick,
  referenceDragEnabled = false,
}: CreativeStudioAudioTileProps) {
  const { t } = useTranslation();
  const label = resolveStudioNodeLabel(node, t);
  const modelLabel = readStudioModelLabel(node.data);
  const audios = readAiAudioCardAudios(
    node.data.inputs,
    node.data.outputs,
    node.data.metadata
  );
  const primaryAudio = audios[0] ?? null;

  const { displayUrl } = useMediaDisplayUrl({
    media: primaryAudio,
    nodeType: "ai-audio",
    size: "thumb",
  });

  const duration = useStudioAudioDuration(displayUrl);
  const durationLabel =
    duration != null ? formatStudioDuration(duration) : "--:--";
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
        <div className={STUDIO_AUDIO_TILE_PREVIEW}>
          <div className="flex h-full w-full flex-col items-center justify-center gap-1">
            <Music className="h-5 w-5 text-muted-foreground" />
            <span className="text-[11px] font-medium tabular-nums text-foreground/90">
              {durationLabel}
            </span>
          </div>
        </div>
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
        {modelLabel ? (
          <button type="button" className="w-full text-left" onClick={onOpenDetail}>
            <div className={STUDIO_META_ROW}>
              <span className={cn(STUDIO_META_TAG, "truncate")}>{modelLabel}</span>
            </div>
          </button>
        ) : null}
      </div>
    </div>
  );
}
