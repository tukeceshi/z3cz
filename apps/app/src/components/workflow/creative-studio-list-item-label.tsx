import type { Node as ReactFlowNode } from "@xyflow/react";
import { type DragEvent, type MouseEvent, useEffect } from "react";

import { useTranslation } from "@/components/locale-provider";
import { Textarea } from "@/components/ui/textarea";

import { useCreativeStudio } from "./creative-studio-context";
import { CreativeStudioListItemMenu } from "./creative-studio-list-item-menu";
import { resolveStudioNodeLabel } from "./creative-studio-utils";
import {
  STUDIO_NODE_LABEL,
  STUDIO_NODE_LABEL_ROW,
  STUDIO_NODE_LABEL_ROW_EDITING,
} from "./creative-studio-surface";
import { useStudioNodeRename } from "./use-studio-node-rename";
import { useWorkflow } from "./workflow-context";
import type { WorkflowNodeType } from "./workflow-types";

function stopRenameInteractionBubble(event: MouseEvent<HTMLElement>) {
  event.stopPropagation();
}

function stopRenameDrag(event: DragEvent<HTMLElement>) {
  event.preventDefault();
  event.stopPropagation();
}

export interface CreativeStudioListItemLabelProps {
  readonly node: ReactFlowNode<WorkflowNodeType>;
  readonly onOpenDetail: () => void;
}

export function CreativeStudioListItemLabel({
  node,
  onOpenDetail,
}: CreativeStudioListItemLabelProps) {
  const { t } = useTranslation();
  const { updateNodeData, disabled = false } = useWorkflow();
  const {
    renamingListNodeId,
    finishListNodeRename,
    registerListNodeRenameCommit,
  } = useCreativeStudio();
  const label = resolveStudioNodeLabel(node, t);
  const editing = renamingListNodeId === node.id;
  const { draft, setDraft, textareaRef, commit, handleKeyDown } =
    useStudioNodeRename({
      nodeId: node.id,
      label,
      editing,
      onFinishEditing: finishListNodeRename,
      updateNodeData,
      disabled,
      wrap: true,
    });

  useEffect(() => {
    if (!editing) {
      return;
    }
    registerListNodeRenameCommit(commit);
    return () => registerListNodeRenameCommit(null);
  }, [commit, editing, registerListNodeRenameCommit]);

  return (
    <div className={editing ? STUDIO_NODE_LABEL_ROW_EDITING : STUDIO_NODE_LABEL_ROW}>
      {editing ? (
        <div
          className="min-w-0 flex-1"
          onPointerDown={stopRenameInteractionBubble}
          onMouseDown={stopRenameInteractionBubble}
          onClick={stopRenameInteractionBubble}
          onDoubleClick={stopRenameInteractionBubble}
          onDragStart={stopRenameDrag}
        >
          <Textarea
            ref={textareaRef}
            rows={1}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            aria-label={t("workflow.studio.renameNode")}
            className="min-h-7 max-h-[5.25rem] min-w-0 w-full resize-none overflow-hidden rounded-sm border-border/60 bg-background px-2 py-1 text-[13px] leading-snug shadow-none focus-visible:ring-1"
          />
        </div>
      ) : (
        <button
          type="button"
          className={STUDIO_NODE_LABEL}
          title={label}
          onClick={onOpenDetail}
        >
          {label}
        </button>
      )}
      {!editing ? (
        <CreativeStudioListItemMenu nodeId={node.id} />
      ) : null}
    </div>
  );
}
