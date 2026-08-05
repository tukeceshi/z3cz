import type { InternalNode, Node } from "@xyflow/react";
import { Position, useStore } from "@xyflow/react";
import { memo, useMemo } from "react";

import { snapAiImageOutputBorderPoint } from "./ai-image-connection-utils";
import { AI_AUDIO_OUTPUT_ID } from "./ai-audio-node-utils";
import { AI_IMAGE_OUTPUT_ID } from "./ai-image-node-utils";
import { AI_VIDEO_OUTPUT_ID } from "./ai-video-node-utils";
import {
  resolveAiTextEdgeAnchors,
  snapAiTextOutputBorderPoint,
} from "./ai-text-connection-utils";
import { GENERATIVE_EDGE_PLUS_BORDER_GAP_PX } from "./generative-edge-connection-config";
import { AI_TEXT_OUTPUT_ID } from "./ai-text-node-utils";
import { snapAiVideoOutputBorderPoint } from "./ai-video-connection-utils";
import { snapGenerativeContentBorderPoint } from "./generative-node-content-geometry";
import type { WorkflowAddNodeMenuState } from "./workflow-add-node-menu";
import {
  buildWorkflowSmoothStepPath,
  renderWorkflowEdgePath,
} from "./workflow-edge";

const ADD_NODE_PREVIEW_LINE_COLOR = "#16a34a";

interface WorkflowAddNodePreviewLineProps {
  readonly menu: WorkflowAddNodeMenuState | null;
}

function resolvePreviewSourceAnchor(
  sourceNode: InternalNode<Node>,
  handleId: string | null | undefined
): { readonly x: number; readonly y: number; readonly position: Position } | null {
  switch (handleId) {
    case AI_TEXT_OUTPUT_ID: {
      const snap = snapAiTextOutputBorderPoint(sourceNode);
      return { x: snap.x, y: snap.y, position: Position.Right };
    }
    case AI_IMAGE_OUTPUT_ID: {
      const snap = snapAiImageOutputBorderPoint(sourceNode);
      return { x: snap.x, y: snap.y, position: Position.Right };
    }
    case AI_VIDEO_OUTPUT_ID: {
      const snap = snapAiVideoOutputBorderPoint(sourceNode);
      return { x: snap.x, y: snap.y, position: Position.Right };
    }
    case AI_AUDIO_OUTPUT_ID: {
      const snap = snapGenerativeContentBorderPoint(sourceNode, "right");
      return { x: snap.x, y: snap.y, position: Position.Right };
    }
    default:
      return null;
  }
}

export const WorkflowAddNodePreviewLine = memo(function WorkflowAddNodePreviewLine({
  menu,
}: WorkflowAddNodePreviewLineProps) {
  const transform = useStore((state) => state.transform);
  const nodeLookup = useStore((state) => state.nodeLookup);

  const edgePath = useMemo(() => {
    const sourceContext = menu?.sourceContext;
    if (!sourceContext) {
      return null;
    }

    const sourceNode = nodeLookup.get(sourceContext.nodeId);
    if (!sourceNode) {
      return null;
    }

    const sourceAnchor = resolvePreviewSourceAnchor(
      sourceNode,
      sourceContext.handle.id
    );
    if (!sourceAnchor) {
      return null;
    }

    const targetX = menu.flowX;
    const targetY = menu.flowY;

    const anchors = resolveAiTextEdgeAnchors({
      sourceX: sourceAnchor.x,
      sourceY: sourceAnchor.y,
      targetX,
      targetY,
      source: sourceContext.nodeId,
      target: "",
      sourceHandle: sourceContext.handle.id ?? null,
      targetHandle: null,
      nodeLookup,
    });

    return buildWorkflowSmoothStepPath({
      sourceX: anchors.sourceX,
      sourceY: anchors.sourceY,
      targetX: anchors.targetX,
      targetY: anchors.targetY,
      sourcePosition: sourceAnchor.position,
      targetPosition: Position.Left,
      offset: GENERATIVE_EDGE_PLUS_BORDER_GAP_PX,
    });
  }, [menu, nodeLookup]);

  if (!edgePath) {
    return null;
  }

  return (
    <svg
      className="pointer-events-none absolute inset-0 overflow-visible"
      style={{ zIndex: 1001 }}
    >
      <g
        transform={`translate(${transform[0]},${transform[1]}) scale(${transform[2]})`}
      >
        {renderWorkflowEdgePath(edgePath, ADD_NODE_PREVIEW_LINE_COLOR, {
          isSelectionFlow: true,
        })}
      </g>
    </svg>
  );
});
