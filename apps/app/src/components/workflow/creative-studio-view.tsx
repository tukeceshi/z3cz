import {
  AI_AUDIO_NODE_TYPE,
  AI_GENERATIVE_NODE_TYPES,
  AI_IMAGE_NODE_TYPE,
  AI_TEXT_NODE_TYPE,
  AI_VIDEO_NODE_TYPE,
} from "@dafthunk/types";
import { useNodes, type Node as ReactFlowNode } from "@xyflow/react";
import { useEffect, useMemo, useState } from "react";

import { cn } from "@/utils/utils";

import {
  CreativeStudioBoard,
  type CreativeStudioNodesByType,
} from "./creative-studio-board";
import {
  studioBoardTabForNodeType,
  type StudioBoardTab,
} from "./creative-studio-board-tabs";
import { useCreativeStudio } from "./creative-studio-context";
import { CreativeStudioDetailView } from "./creative-studio-detail-view";
import { STUDIO_SHELL } from "./creative-studio-surface";
import type { WorkflowNodeType } from "./workflow-types";

function scrollStudioNodeIntoView(nodeId: string): void {
  requestAnimationFrame(() => {
    document
      .querySelector(`[data-studio-focus-id="${nodeId}"]`)
      ?.scrollIntoView({ block: "nearest" });
  });
}

export function CreativeStudioView() {
  const nodes = useNodes<WorkflowNodeType>();
  const {
    detailNodeId,
    studioNodeId,
    openDetail,
    closeDetail,
    selectStudioNode,
    expandStudioList,
  } = useCreativeStudio();
  const [boardTab, setBoardTab] = useState<StudioBoardTab>("text");

  const generativeNodes = useMemo(
    () =>
      nodes.filter((node) =>
        (AI_GENERATIVE_NODE_TYPES as readonly string[]).includes(
          node.data.nodeType ?? ""
        )
      ),
    [nodes]
  );

  const nodesByType = useMemo((): CreativeStudioNodesByType => {
    const byType = (nodeType: string) =>
      generativeNodes.filter((node) => node.data.nodeType === nodeType);

    return {
      audio: byType(AI_AUDIO_NODE_TYPE),
      text: byType(AI_TEXT_NODE_TYPE),
      image: byType(AI_IMAGE_NODE_TYPE),
      video: byType(AI_VIDEO_NODE_TYPE),
    };
  }, [generativeNodes]);

  const detailNode = useMemo((): ReactFlowNode<WorkflowNodeType> | null => {
    if (!detailNodeId) return null;
    return generativeNodes.find((node) => node.id === detailNodeId) ?? null;
  }, [detailNodeId, generativeNodes]);

  const hasDetail = detailNode != null;

  useEffect(() => {
    if (!studioNodeId || nodes.length === 0) return;

    if (!nodes.some((node) => node.id === studioNodeId)) {
      selectStudioNode(null);
      closeDetail();
      return;
    }

    const node = generativeNodes.find((item) => item.id === studioNodeId);
    if (!node) return;

    const nodeType = node.data.nodeType;
    setBoardTab(studioBoardTabForNodeType(nodeType));
  }, [closeDetail, generativeNodes, nodes, selectStudioNode, studioNodeId]);

  useEffect(() => {
    if (!studioNodeId || nodes.length === 0) return;

    if (detailNodeId && !nodes.some((node) => node.id === detailNodeId)) {
      closeDetail();
      return;
    }

    const node = generativeNodes.find((item) => item.id === studioNodeId);
    if (!node) return;

    scrollStudioNodeIntoView(studioNodeId);
  }, [boardTab, closeDetail, detailNodeId, generativeNodes, nodes, studioNodeId]);

  return (
    <div className={cn("flex h-full min-h-0 flex-col", STUDIO_SHELL)}>
      <div className="flex min-h-0 flex-1">
        <div
          className={cn(
            "min-h-0 overflow-hidden border-border transition-[width]",
            hasDetail ? "w-1/3 shrink-0" : "w-full flex-1"
          )}
        >
          <CreativeStudioBoard
            nodesByType={nodesByType}
            focusedNodeId={studioNodeId}
            onOpenDetail={openDetail}
            onExpandList={expandStudioList}
            compact={hasDetail}
            boardTab={boardTab}
            onBoardTabChange={setBoardTab}
          />
        </div>

        {detailNode ? (
          <div className="min-w-0 w-2/3 flex-1 overflow-hidden">
            <CreativeStudioDetailView node={detailNode} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
