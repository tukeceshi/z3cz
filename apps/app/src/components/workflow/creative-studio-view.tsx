import {

  AI_AUDIO_NODE_TYPE,

  AI_GENERATIVE_NODE_TYPES,

  AI_IMAGE_NODE_TYPE,

  AI_TEXT_NODE_TYPE,

  AI_VIDEO_NODE_TYPE,

} from "@dafthunk/types";

import { useNodes, type Node as ReactFlowNode } from "@xyflow/react";

import { useCallback, useEffect, useMemo, useState } from "react";



import { useTranslation } from "@/components/locale-provider";

import { cn } from "@/utils/utils";



import {

  CreativeStudioBoard,

  type CreativeStudioNodesByType,

} from "./creative-studio-board";

import {

  type StudioBoardTab,

} from "./creative-studio-board-tabs";

import { useCreativeStudio } from "./creative-studio-context";

import { CreativeStudioEmptyAddNode } from "./creative-studio-empty-add-node";

import { CreativeStudioDetailView } from "./creative-studio-detail-view";

import { STUDIO_DETAIL_CARD, STUDIO_SHELL } from "./creative-studio-surface";

import { type StudioListEditorState } from "./studio-list-node-interaction";

import { useStudioListNodeInteractionHandlers } from "./use-studio-list-node-interaction-handlers";

import type { WorkflowNodeType } from "./workflow-types";



function scrollStudioNodeIntoView(nodeId: string): void {

  requestAnimationFrame(() => {

    document

      .querySelector(`[data-studio-focus-id="${nodeId}"]`)

      ?.scrollIntoView({ block: "nearest" });

  });

}



export function CreativeStudioView() {

  const { t } = useTranslation();

  const nodes = useNodes<WorkflowNodeType>();

  const {

    detailNodeId,

    detailPaneOpen,

    secondaryNodeId,

    secondaryPaneOpen,

    studioNodeId,

    openDetail,

    openSecondaryDetail,

    closeSecondaryDetail,

    replacePrimaryFromList,

    clearDetailNode,

    selectStudioNode,

    expandStudioList,

    isPendingStudioNode,

    resolvePendingStudioNode,

  } = useCreativeStudio();

  const [boardTab, setBoardTab] = useState<StudioBoardTab>("all");



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

      generativeNodes

        .filter((node) => node.data.nodeType === nodeType)

        .toReversed();



    return {

      all: generativeNodes.toReversed(),

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



  const secondaryNode = useMemo((): ReactFlowNode<WorkflowNodeType> | null => {

    if (!secondaryNodeId) return null;

    return generativeNodes.find((node) => node.id === secondaryNodeId) ?? null;

  }, [generativeNodes, secondaryNodeId]);



  const hasPrimary = detailPaneOpen;

  const hasSecondary = secondaryPaneOpen;



  const listEditorState = useMemo(

    (): StudioListEditorState => ({

      hasPrimary,

      hasSecondary,

      primaryNodeId: detailNodeId,

    }),

    [detailNodeId, hasPrimary, hasSecondary]

  );



  const listInteraction = useStudioListNodeInteractionHandlers(listEditorState, {

    openPrimary: openDetail,

    openSecondary: openSecondaryDetail,

    replacePrimaryAndCloseSecondary: replacePrimaryFromList,

  });



  const handleExpandedOpenDetail = useCallback(

    (nodeId: string) => {

      openDetail(nodeId);

    },

    [openDetail]

  );



  useEffect(() => {
    if (!detailNodeId || !isPendingStudioNode(detailNodeId)) return;
    if (!nodes.some((node) => node.id === detailNodeId)) return;

    setBoardTab("all");
    resolvePendingStudioNode(detailNodeId);
  }, [detailNodeId, isPendingStudioNode, nodes, resolvePendingStudioNode]);



  useEffect(() => {

    if (!studioNodeId || nodes.length === 0) return;

    if (isPendingStudioNode(studioNodeId)) return;



    if (!nodes.some((node) => node.id === studioNodeId)) {

      if (detailNodeId === studioNodeId) {

        clearDetailNode();

      } else {

        selectStudioNode(null);

      }

    }

  }, [

    clearDetailNode,

    detailNodeId,

    isPendingStudioNode,

    nodes,

    selectStudioNode,

    studioNodeId,

  ]);



  useEffect(() => {

    if (!secondaryNodeId || nodes.length === 0) return;



    if (!nodes.some((node) => node.id === secondaryNodeId)) {

      closeSecondaryDetail();

    }

  }, [closeSecondaryDetail, nodes, secondaryNodeId]);



  useEffect(() => {

    if (detailPaneOpen) return;

    setBoardTab("all");

  }, [detailPaneOpen]);



  useEffect(() => {

    if (!studioNodeId || nodes.length === 0) return;



    if (

      detailNodeId &&

      !nodes.some((node) => node.id === detailNodeId) &&

      !isPendingStudioNode(detailNodeId)

    ) {

      clearDetailNode();

      return;

    }



    const node = generativeNodes.find((item) => item.id === studioNodeId);

    if (!node) return;



    scrollStudioNodeIntoView(studioNodeId);

  }, [

    boardTab,

    clearDetailNode,

    detailNodeId,

    generativeNodes,

    isPendingStudioNode,

    nodes,

    studioNodeId,

  ]);



  if (generativeNodes.length === 0) {

    return (

      <div className={cn("flex h-full min-h-0 flex-col", STUDIO_SHELL)}>

        <CreativeStudioEmptyAddNode />

      </div>

    );

  }



  return (

    <div className={cn("flex h-full min-h-0 flex-col", STUDIO_SHELL)}>

      <div className={cn("flex min-h-0 flex-1", hasPrimary && "gap-3 p-4")}>

        <div

          className={cn(

            "min-h-0 overflow-hidden border-border transition-[width]",

            !hasPrimary && "w-full flex-1",

            hasPrimary && !hasSecondary && "w-1/3 shrink-0",

            hasPrimary && hasSecondary && "min-w-0 flex-1"

          )}

        >

          <CreativeStudioBoard

            nodesByType={nodesByType}

            focusedNodeId={studioNodeId}

            onOpenDetail={handleExpandedOpenDetail}

            onExpandList={expandStudioList}

            compact={hasPrimary}

            referenceDragEnabled={hasPrimary}

            boardTab={boardTab}

            onBoardTabChange={setBoardTab}

            listInteraction={listInteraction}

          />

        </div>



        {hasSecondary ? (

          <div className="min-w-0 flex-1 overflow-hidden">

            {secondaryNode ? (

              <CreativeStudioDetailView node={secondaryNode} role="secondary" />

            ) : null}

          </div>

        ) : null}



        {hasPrimary ? (

          <div

            className={cn(

              "min-w-0 overflow-hidden",

              hasSecondary ? "flex-[2]" : "w-2/3 flex-1"

            )}

          >

            {detailNode ? (

              <CreativeStudioDetailView node={detailNode} role="primary" />

            ) : (

              <div className={cn("flex h-full min-h-0 flex-col", STUDIO_SHELL)}>

                <div

                  className={cn(

                    STUDIO_DETAIL_CARD,

                    "flex min-h-0 flex-1 items-center justify-center"

                  )}

                >

                  <p className="text-sm text-muted-foreground">

                    {t("workflow.studio.pickNode")}

                  </p>

                </div>

              </div>

            )}

          </div>

        ) : null}

      </div>

    </div>

  );

}


