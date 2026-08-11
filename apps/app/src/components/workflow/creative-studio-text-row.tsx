import type { Node as ReactFlowNode } from "@xyflow/react";
import FileText from "lucide-react/icons/file-text";
import LoaderIcon from "lucide-react/icons/loader-circle";
import { useRef, useState } from "react";

import { useAuth } from "@/components/auth-context";
import { useResolvedAiText } from "@/hooks/use-resolved-ai-text";
import { cn } from "@/utils/utils";
import { readStudioModelLabel } from "./creative-studio-media-meta";
import { CreativeStudioListItemFooter } from "./creative-studio-list-item-footer";
import {
  STUDIO_MEDIA_CARD,
  STUDIO_TEXT_LIST_PREVIEW,
} from "./creative-studio-surface";
import { useCreativeStudio } from "./creative-studio-context";
import { studioReferenceDragSourceProps } from "./studio-reference-drag";
import type { WorkflowNodeType } from "./workflow-types";

export interface CreativeStudioTextRowProps {
  readonly node: ReactFlowNode<WorkflowNodeType>;
  readonly onOpenDetail: () => void;
  readonly onCancelPendingListClick?: () => void;
  readonly referenceDragEnabled?: boolean;
}

export function CreativeStudioTextRow({
  node,
  onOpenDetail,
  onCancelPendingListClick,
  referenceDragEnabled = false,
}: CreativeStudioTextRowProps) {
  const { organization } = useAuth();
  const { workflowId, isListNodeRenaming } = useCreativeStudio();
  const resolvedText = useResolvedAiText({
    organizationId: organization?.id,
    workflowId,
    inputs: node.data.inputs,
    outputs: node.data.outputs,
  });
  const previewText = (resolvedText.excerpt ?? resolvedText.text)
    .replace(/\s+/g, " ")
    .trim();
  const modelLabel = readStudioModelLabel(node.data);
  const metaTags = modelLabel ? [modelLabel] : [];
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
        <div className={STUDIO_TEXT_LIST_PREVIEW}>
          {previewText ? (
            <p className="line-clamp-6 text-xs leading-5 text-foreground/80 break-words">
              {previewText}
            </p>
          ) : resolvedText.loading ? (
            <div className="flex h-full items-center justify-center text-muted-foreground/50">
              <LoaderIcon className="h-5 w-5 animate-spin opacity-40" aria-hidden />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground/50">
              <FileText className="h-6 w-6 shrink-0 opacity-40" aria-hidden />
            </div>
          )}
        </div>
      </button>

      <CreativeStudioListItemFooter
        node={node}
        onOpenDetail={onOpenDetail}
        metaTags={metaTags}
      />
    </div>
  );
}
