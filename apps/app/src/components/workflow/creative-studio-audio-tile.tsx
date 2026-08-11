import type { Node as ReactFlowNode } from "@xyflow/react";
import Music from "lucide-react/icons/music";
import { useRef, useState } from "react";

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
} from "./creative-studio-surface";
import { CreativeStudioListItemFooter } from "./creative-studio-list-item-footer";
import { useCreativeStudio } from "./creative-studio-context";
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
        <div className={STUDIO_AUDIO_TILE_PREVIEW}>
          <div className="flex h-full w-full flex-col items-center justify-center gap-1">
            <Music className="h-5 w-5 text-muted-foreground" />
            <span className="text-[11px] font-medium tabular-nums text-foreground/90">
              {durationLabel}
            </span>
          </div>
        </div>
      </button>

      <CreativeStudioListItemFooter
        node={node}
        onOpenDetail={onOpenDetail}
        metaTags={modelLabel ? [modelLabel] : []}
      />
    </div>
  );
}
