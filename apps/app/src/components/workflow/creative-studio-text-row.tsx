import type { Node as ReactFlowNode } from "@xyflow/react";
import { useRef, useState } from "react";

import { useTranslation } from "@/components/locale-provider";
import { cn } from "@/utils/utils";

import { readAiTextResult } from "./ai-text-node-utils";
import { readStudioModelLabel } from "./creative-studio-media-meta";
import {
  SURFACE_CARD_SOFT,
  SURFACE_ROW_ACTIVE,
  SURFACE_ROW_HOVER,
} from "@/components/ui/surface";

import {
  STUDIO_META_ROW,
  STUDIO_META_TAG,
  STUDIO_NODE_LABEL,
  STUDIO_NODE_LABEL_ROW,
  STUDIO_TEXT_CARD_GAP,
} from "./creative-studio-surface";
import { CreativeStudioListItemMenu } from "./creative-studio-list-item-menu";
import { resolveStudioNodeLabel } from "./creative-studio-utils";
import { studioReferenceDragSourceProps } from "./studio-reference-drag";
import type { WorkflowNodeType } from "./workflow-types";

export interface CreativeStudioTextRowProps {
  readonly node: ReactFlowNode<WorkflowNodeType>;
  readonly isActive?: boolean;
  readonly onOpenDetail: () => void;
  readonly onCancelPendingListClick?: () => void;
  readonly referenceDragEnabled?: boolean;
}

export function CreativeStudioTextRow({
  node,
  isActive = false,
  onOpenDetail,
  onCancelPendingListClick,
  referenceDragEnabled = false,
}: CreativeStudioTextRowProps) {
  const { t } = useTranslation();
  const label = resolveStudioNodeLabel(node, t);
  const previewText = (readAiTextResult(node.data.inputs, node.data.outputs) ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
  const modelLabel = readStudioModelLabel(node.data);
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
        "flex h-[168px] w-full flex-col rounded-xl p-3",
        STUDIO_TEXT_CARD_GAP,
        SURFACE_CARD_SOFT,
        SURFACE_ROW_HOVER,
        isActive && SURFACE_ROW_ACTIVE,
        referenceDragEnabled && "cursor-grab",
        isDragging && "opacity-50"
      )}
      {...dragProps}
    >
      <div className={STUDIO_NODE_LABEL_ROW}>
        <button
          type="button"
          className={cn(
            STUDIO_NODE_LABEL,
            "min-w-0 flex-1 truncate text-left text-[13px] leading-none text-foreground/90"
          )}
          title={label}
          onClick={onOpenDetail}
        >
          {label}
        </button>
        <CreativeStudioListItemMenu nodeId={node.id} />
      </div>
      <button
        type="button"
        className="min-h-0 flex-1 overflow-hidden text-left"
        onClick={onOpenDetail}
      >
        {previewText ? (
          <p className="line-clamp-6 text-xs leading-5 text-foreground/80 break-words">
            {previewText}
          </p>
        ) : (
          <p className="text-xs italic leading-5 text-muted-foreground/50">
            {t("workflow.aiTextPanel.cardInputPlaceholder")}
          </p>
        )}
      </button>
      {modelLabel ? (
        <button type="button" className="text-left" onClick={onOpenDetail}>
          <div className={STUDIO_META_ROW}>
            <span className={cn(STUDIO_META_TAG, "truncate")}>{modelLabel}</span>
          </div>
        </button>
      ) : null}
    </div>
  );
}
