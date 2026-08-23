import {
  AI_AUDIO_NODE_TYPE,
  AI_IMAGE_NODE_TYPE,
  AI_VIDEO_NODE_TYPE,
} from "@dafthunk/types";
import { useStore } from "@xyflow/react";
import Upload from "lucide-react/icons/upload";

import { useTranslation } from "@/components/locale-provider";
import { cn } from "@/utils/utils";

import {
  GENERATIVE_CARD_STATE_LABEL_CLASS,
  GENERATIVE_NODE_CARD_CLASS,
} from "./generative-card-styles";
import {
  formatGenerativeCardUploadFileTypes,
  resolveCanvasFileDropCenterPoint,
  resolveCanvasFileDropNodePosition,
  type CanvasFileDropPreviewState,
  type GenerativeStudioDropKind,
} from "./generative-card-upload-utils";

interface CanvasFileDropPreviewProps {
  readonly preview: CanvasFileDropPreviewState;
}

function previewNodeType(kind: GenerativeStudioDropKind): string {
  if (kind === "video") {
    return AI_VIDEO_NODE_TYPE;
  }
  if (kind === "audio") {
    return AI_AUDIO_NODE_TYPE;
  }
  return AI_IMAGE_NODE_TYPE;
}

export function CanvasFileDropPreview({ preview }: CanvasFileDropPreviewProps) {
  const { t } = useTranslation();
  const transform = useStore((state) => state.transform);

  if (!preview.visible || preview.items.length === 0) {
    return null;
  }

  const [translateX, translateY, zoom] = transform;

  return (
    <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden">
      {preview.items.map((item) => {
        const center = resolveCanvasFileDropCenterPoint({
          baseCenter: preview.baseCenter,
          fileIndex: item.fileIndex,
        });
        const position = resolveCanvasFileDropNodePosition(center, item.cardSize);
        const left = position.x * zoom + translateX;
        const top = position.y * zoom + translateY;

        return (
          <div
            key={`${item.fileIndex}-${item.kind}`}
            className={cn(
              GENERATIVE_NODE_CARD_CLASS,
              "absolute border border-dashed border-primary/50 bg-background/50 shadow-sm backdrop-blur-[1px]"
            )}
            style={{
              left,
              top,
              width: item.cardSize.width * zoom,
              height: item.cardSize.height * zoom,
            }}
            data-node-type={previewNodeType(item.kind)}
          >
            <div className="flex h-full flex-col items-center justify-center gap-2 px-3 opacity-80">
              <Upload className="size-5 shrink-0 text-muted-foreground/80" />
              <p className={cn(GENERATIVE_CARD_STATE_LABEL_CLASS, "text-xs")}>
                {t("workflow.canvas.fileDrop.previewRelease")}
              </p>
              <p className="text-[10px] text-muted-foreground/70">
                {formatGenerativeCardUploadFileTypes(item.kind)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
