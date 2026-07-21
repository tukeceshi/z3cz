import { AI_IMAGE_NODE_TYPE, AI_TEXT_NODE_TYPE, AI_VIDEO_NODE_TYPE } from "@dafthunk/types";
import { useCallback } from "react";
import {
  useStore,
  type Edge as ReactFlowEdge,
  type InternalNode,
  type Node,
} from "@xyflow/react";

import {
  buildGenerativeDragPreviewState,
  type FlowConnectionLike,
} from "./generative-connection-preview";
import type { AiTextConnectionContext } from "./ai-text-connection-utils";
import { validateWorkflowConnection } from "./workflow-connection-validation";
import type { WorkflowEdgeType, WorkflowNodeType } from "./workflow-types";

function readNodeType(node: InternalNode<Node> | undefined): string | undefined {
  return (node?.data as { nodeType?: string } | undefined)?.nodeType;
}

function flowNodesFromLookup(
  nodeLookup: Map<string, InternalNode<Node>>
): readonly {
  id: string;
  data: WorkflowNodeType;
  position: { x: number; y: number };
  type?: string;
}[] {
  return Array.from(nodeLookup.values()).map((node) => ({
    id: node.id,
    data: node.data as WorkflowNodeType,
    position: node.position,
    type: node.type,
  }));
}

/** Valid generative drop target — same rules as green preview line. */
export function findGenerativeConnectionHighlightTargetId(
  connection: FlowConnectionLike,
  context: AiTextConnectionContext,
  nodeLookup: Map<string, InternalNode<Node>>,
  edges: readonly Pick<
    ReactFlowEdge<WorkflowEdgeType>,
    "source" | "target" | "sourceHandle" | "targetHandle"
  >[]
): string | null {
  if (!connection.inProgress || !connection.fromNode) return null;

  const flowNodes = flowNodesFromLookup(nodeLookup);
  const { previewConnection, previewAllowed } = buildGenerativeDragPreviewState(
    connection,
    nodeLookup,
    context,
    edges,
    (preview) =>
      validateWorkflowConnection({
        connection: preview,
        nodes: flowNodes,
        edges,
      })
  );

  if (!previewAllowed || !previewConnection) return null;

  const targetType = readNodeType(nodeLookup.get(previewConnection.target));
  if (
    targetType !== AI_TEXT_NODE_TYPE &&
    targetType !== AI_IMAGE_NODE_TYPE &&
    targetType !== AI_VIDEO_NODE_TYPE
  ) {
    return null;
  }

  return previewConnection.target;
}

/** Border glow for AI text / AI image — only when preview line is valid (green). */
export function useGenerativeConnectionHighlight(
  nodeId: string,
  enabled: boolean
): boolean {
  return useStore(
    useCallback(
      (state) => {
        if (!enabled) return false;

        if (
          state.connection.fromNode?.id === nodeId ||
          !state.connection.inProgress
        ) {
          return false;
        }

        const highlightTargetId = findGenerativeConnectionHighlightTargetId(
          state.connection,
          { domNode: state.domNode, transform: state.transform },
          state.nodeLookup,
          state.edges
        );
        return highlightTargetId === nodeId;
      },
      [enabled, nodeId]
    )
  );
}
