import type { Node as ReactFlowNode } from "@xyflow/react";
import Music from "lucide-react/icons/music";

import { useTranslation } from "@/components/locale-provider";
import { useMediaDisplayUrl } from "@/hooks/use-media-display-url";
import { cn } from "@/utils/utils";

import { readAiAudioCardAudios } from "./ai-audio-node-utils";
import {
  formatStudioDuration,
  useStudioAudioDuration,
} from "./creative-studio-audio-utils";
import {
  STUDIO_AUDIO_TILE_SQUARE,
  STUDIO_TILE_ACTIVE,
} from "./creative-studio-surface";
import { resolveStudioNodeLabel } from "./creative-studio-utils";
import type { WorkflowNodeType } from "./workflow-types";

export interface CreativeStudioAudioTileProps {
  readonly node: ReactFlowNode<WorkflowNodeType>;
  readonly isActive: boolean;
  readonly onOpenDetail: () => void;
}

export function CreativeStudioAudioTile({
  node,
  isActive,
  onOpenDetail,
}: CreativeStudioAudioTileProps) {
  const { t } = useTranslation();
  const label = resolveStudioNodeLabel(node, t);
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

  return (
    <button
      type="button"
      className="relative flex w-full flex-col gap-1.5 text-left"
      data-studio-focus-id={node.id}
      onClick={onOpenDetail}
    >
      {isActive ? (
        <span className={STUDIO_TILE_ACTIVE} aria-hidden="true" />
      ) : null}
      <div className={cn(STUDIO_AUDIO_TILE_SQUARE, "relative")}>
        <div className="flex h-full w-full flex-col items-center justify-center gap-1">
          <Music className="h-5 w-5 text-muted-foreground" />
          <span className="text-[11px] font-medium tabular-nums text-foreground/90">
            {durationLabel}
          </span>
        </div>
      </div>
      <span className="relative w-full truncate px-0.5 text-center text-[12px] text-muted-foreground">
        {label}
      </span>
    </button>
  );
}
