import { useState, type DragEvent, type ReactNode } from "react";

import { useTranslation } from "@/components/locale-provider";
import { cn } from "@/utils/utils";

import {
  AI_GENERATIVE_PANEL_HEIGHT_PX,
  AI_GENERATIVE_PANEL_WIDTH_PX,
} from "./ai-generative-panel-utils";
import { GENERATIVE_NODE_PANEL_CLASS } from "./generative-card-styles";
import { armGenerativePanelPointerGuard } from "./generative-panel-pointer-guard";
import {
  STUDIO_DOCK_PROMPT_BOX,
  STUDIO_SCROLL,
} from "./creative-studio-surface";
import { STUDIO_DOCK_PROMPT_HEIGHT_PX } from "./generative-studio-dock-layout";
import {
  clearStudioReferenceDragSession,
  hasStudioReferenceDrag,
  resolveStudioReferenceDragPayloadFromTransfer,
} from "./studio-reference-drag";
import type { StudioReferenceDropPreview } from "./generative-reference-utils";

export type GenerativeConfigPanelLayout = "attached" | "studio" | "studio-dock";

export interface GenerativeConfigPanelShellProps {
  readonly nodeId: string;
  readonly zoom: number;
  readonly layout?: GenerativeConfigPanelLayout;
  readonly dropDisabled?: boolean;
  readonly previewStudioReferenceDrop?: (
    sourceNodeId: string,
    sourceHandle: string
  ) => StudioReferenceDropPreview;
  readonly onStudioReferenceDrop?: (
    sourceNodeId: string,
    sourceHandle: string
  ) => void;
  readonly children: ReactNode;
}

/** Shared bottom editor shell for AI text / AI image nodes. */
export function GenerativeConfigPanelShell({
  nodeId,
  zoom,
  layout = "attached",
  dropDisabled = false,
  previewStudioReferenceDrop,
  onStudioReferenceDrop,
  children,
}: GenerativeConfigPanelShellProps) {
  const { t } = useTranslation();
  const [dropPreview, setDropPreview] = useState<StudioReferenceDropPreview | null>(
    null
  );

  if (layout === "studio-dock") {
    const dropEnabled =
      Boolean(onStudioReferenceDrop && previewStudioReferenceDrop) && !dropDisabled;

    const resolveDropPreview = (
      dataTransfer: DataTransfer
    ): StudioReferenceDropPreview | null => {
      if (!dropEnabled || !hasStudioReferenceDrag(dataTransfer)) return null;
      const payload = resolveStudioReferenceDragPayloadFromTransfer(dataTransfer);
      if (!payload || !previewStudioReferenceDrop) return null;
      return previewStudioReferenceDrop(payload.nodeId, payload.outputId);
    };

    const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
      if (!dropEnabled || !hasStudioReferenceDrag(event.dataTransfer)) return;
      event.preventDefault();
    };

    const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
      if (!dropEnabled || !hasStudioReferenceDrag(event.dataTransfer)) return;
      event.preventDefault();
      const preview = resolveDropPreview(event.dataTransfer);
      if (!preview) return;
      event.dataTransfer.dropEffect = preview === "valid" ? "copy" : "none";
      setDropPreview(preview);
    };

    const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
      if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
        return;
      }
      setDropPreview(null);
    };

    const handleDrop = (event: DragEvent<HTMLDivElement>) => {
      if (!dropEnabled || !onStudioReferenceDrop) return;
      event.preventDefault();
      const preview = resolveDropPreview(event.dataTransfer);
      setDropPreview(null);
      clearStudioReferenceDragSession();
      if (preview !== "valid") return;
      const payload = resolveStudioReferenceDragPayloadFromTransfer(
        event.dataTransfer
      );
      if (!payload) return;
      onStudioReferenceDrop(payload.nodeId, payload.outputId);
    };

    return (
      <div
        className={cn(
          "nodrag nopan nowheel relative",
          STUDIO_DOCK_PROMPT_BOX,
          STUDIO_SCROLL
        )}
        style={{ height: STUDIO_DOCK_PROMPT_HEIGHT_PX }}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onPointerDownCapture={() => {
          armGenerativePanelPointerGuard(nodeId);
        }}
        onMouseDown={(event) => event.stopPropagation()}
        onDragEnter={dropEnabled ? handleDragEnter : undefined}
        onDragOver={dropEnabled ? handleDragOver : undefined}
        onDragLeave={dropEnabled ? handleDragLeave : undefined}
        onDrop={dropEnabled ? handleDrop : undefined}
      >
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          {children}
        </div>
        {dropEnabled && dropPreview ? (
          <div
            className={cn(
              "pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg border-2 border-dashed",
              dropPreview === "valid"
                ? "border-green-500/60"
                : "border-red-500/60"
            )}
            aria-hidden="true"
          >
            <p
              className={cn(
                "px-4 text-center text-sm font-medium",
                dropPreview === "valid"
                  ? "text-green-700 dark:text-green-400"
                  : "text-red-700 dark:text-red-400"
              )}
            >
              {t(
                dropPreview === "valid"
                  ? "workflow.studio.dropReferenceOk"
                  : dropPreview === "already_connected"
                    ? "workflow.studio.dropReferenceAlreadyConnected"
                    : "workflow.studio.dropReferenceRejected"
              )}
            </p>
          </div>
        ) : null}
      </div>
    );
  }

  if (layout === "studio") {
    return (
      <div
        className="nodrag nopan nowheel flex h-full min-h-0 flex-col overflow-hidden px-4 py-3"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onPointerDownCapture={() => {
          armGenerativePanelPointerGuard(nodeId);
        }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    );
  }

  const panelZoom = zoom > 0 ? zoom : 1;

  return (
    <div
      className={cn(
        "nodrag nopan nowheel absolute top-full left-1/2 z-20 -mt-px",
        "overflow-hidden border border-t-0 border-border/70",
        "bg-neutral-50/95 shadow-[0_8px_24px_rgba(0,0,0,0.08)]",
        GENERATIVE_NODE_PANEL_CLASS
      )}
      style={{
        width: AI_GENERATIVE_PANEL_WIDTH_PX,
        height: AI_GENERATIVE_PANEL_HEIGHT_PX,
        transform: `translateX(-50%) scale(${1 / panelZoom})`,
        transformOrigin: "top center",
      }}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerDownCapture={() => {
        armGenerativePanelPointerGuard(nodeId);
      }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="flex h-full min-h-0 flex-col overflow-y-auto px-3 pb-3 pt-2 thin-scrollbar">{children}</div>
    </div>
  );
}
