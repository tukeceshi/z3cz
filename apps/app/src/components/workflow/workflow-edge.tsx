import {
  ConnectionLineComponentProps,
  EdgeProps,
  getSmoothStepPath,
  Position,
  useConnection,
  useStore,
  Edge as ReactFlowEdge,
} from "@xyflow/react";
import { memo, useMemo } from "react";

import { cn } from "@/utils/utils";

import {
  snapAiImageOutputBorderPoint,
} from "./ai-image-connection-utils";
import { AI_IMAGE_OUTPUT_ID } from "./ai-image-node-utils";
import {
  buildGenerativeDragPreviewState,
} from "./generative-connection-preview";
import {
  getAiTextEdgePathOffset,
  resolveAiTextEdgeAnchors,
  resolveWorkflowEdgeHandles,
  snapAiTextKeywordsBorderPoint,
  snapAiTextOutputBorderPoint,
} from "./ai-text-connection-utils";
import { GENERATIVE_EDGE_PLUS_BORDER_GAP_PX } from "./generative-edge-connection-config";
import {
  AI_TEXT_KEYWORDS_HANDLE_ID,
  AI_TEXT_OUTPUT_ID,
} from "./ai-text-node-utils";
import { validateWorkflowConnection } from "./workflow-connection-validation";
import { WorkflowEdgeType } from "./workflow-types";
import type { WorkflowNodeType } from "./workflow-types";

interface WorkflowEdgeProps extends EdgeProps<ReactFlowEdge<WorkflowEdgeType>> {
  zIndex?: number;
}

interface SmoothStepPathParams {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: Position;
  targetPosition: Position;
  offset?: number;
}

export function buildWorkflowSmoothStepPath(params: SmoothStepPathParams): string {
  const { offset = 20 } = params;
  const [edgePath] = getSmoothStepPath({
    sourceX: params.sourceX,
    sourceY: params.sourceY,
    targetX: params.targetX,
    targetY: params.targetY,
    sourcePosition: params.sourcePosition,
    targetPosition: params.targetPosition,
    borderRadius: 8,
    offset,
  });
  return edgePath;
}

export function renderWorkflowEdgePath(
  path: string,
  color: string,
  options: {
    readonly isActive?: boolean;
    readonly isSelectionFlow?: boolean;
    readonly zIndex?: number;
  }
) {
  const { isActive = false, isSelectionFlow = false, zIndex } = options;
  return (
    <>
      <path
        d={path}
        className="stroke-12 fill-none pointer-events-stroke"
        style={{
          stroke: "transparent",
          zIndex: zIndex,
        }}
      />
      <path
        d={path}
        className={cn("fill-none", {
          "animate-pulse stroke-1": isActive,
          "workflow-edge-selection-flow stroke-[1.5]": isSelectionFlow,
          "stroke-1": !isActive && !isSelectionFlow,
        })}
        style={{
          stroke: color,
          zIndex: zIndex,
        }}
      />
    </>
  );
}

export const WorkflowEdge = memo(
  ({
    source,
    target,
    sourceHandle,
    targetHandle,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    selected,
    animated = false,
    zIndex,
  }: WorkflowEdgeProps) => {
    const nodeLookup = useStore((state) => state.nodeLookup);

    const pathOffset = useMemo(() => {
      const resolved = resolveWorkflowEdgeHandles({
        sourceHandle,
        targetHandle,
        dataSourceHandle:
          typeof data?.sourceType === "string" ? data.sourceType : null,
        dataTargetHandle:
          typeof data?.targetType === "string" ? data.targetType : null,
      });
      const sourceType = (
        nodeLookup.get(source)?.data as { nodeType?: string } | undefined
      )?.nodeType;
      const targetType = (
        nodeLookup.get(target)?.data as { nodeType?: string } | undefined
      )?.nodeType;
      return getAiTextEdgePathOffset(
        sourceType,
        targetType,
        resolved.sourceHandle ?? null,
        resolved.targetHandle ?? null
      );
    }, [data?.sourceType, data?.targetType, nodeLookup, source, target, sourceHandle, targetHandle]);

    const anchors = useMemo(
      () =>
        resolveAiTextEdgeAnchors({
          sourceX,
          sourceY,
          targetX,
          targetY,
          source,
          target,
          sourceHandle,
          targetHandle,
          dataSourceHandle:
            typeof data?.sourceType === "string" ? data.sourceType : null,
          dataTargetHandle:
            typeof data?.targetType === "string" ? data.targetType : null,
          nodeLookup,
        }),
      [
        data?.sourceType,
        data?.targetType,
        nodeLookup,
        source,
        sourceHandle,
        sourceX,
        sourceY,
        target,
        targetHandle,
        targetX,
        targetY,
      ]
    );

    const edgePath = buildWorkflowSmoothStepPath({
      sourceX: anchors.sourceX,
      sourceY: anchors.sourceY,
      targetX: anchors.targetX,
      targetY: anchors.targetY,
      sourcePosition,
      targetPosition,
      offset: pathOffset,
    });

    const isValid = data?.isValid ?? true;
    const isActive = data?.isActive ?? false;
    const isSelectionFlow = animated && !isActive;

    const getColor = () => {
      if (!isValid) return "#f87171";
      if (isSelectionFlow || selected) return "#3b82f6";
      return "#d4d4d4";
    };

    return renderWorkflowEdgePath(edgePath, getColor(), {
      isActive,
      isSelectionFlow,
      zIndex,
    });
  }
);

WorkflowEdge.displayName = "WorkflowEdge";

export const WorkflowConnectionLine = memo(
  ({
    fromX,
    fromY,
    toX,
    toY,
    fromPosition,
    toPosition,
    connectionStatus,
  }: ConnectionLineComponentProps) => {
    const connection = useConnection();
    const nodeLookup = useStore((state) => state.nodeLookup);
    const edges = useStore((state) => state.edges);
    const domNode = useStore((state) => state.domNode);
    const transform = useStore((state) => state.transform);

    const flowNodes = useMemo(
      () =>
        Array.from(nodeLookup.values()).map((node) => ({
          id: node.id,
          data: node.data as WorkflowNodeType,
          position: node.position,
          type: node.type,
        })),
      [nodeLookup]
    );

    const { previewConnection, snap: generativeSnap, previewAllowed } = useMemo(
      () =>
        buildGenerativeDragPreviewState(
          connection,
          nodeLookup,
          { domNode, transform },
          edges,
          (preview) =>
            validateWorkflowConnection({
              connection: preview,
              nodes: flowNodes,
              edges,
            })
        ),
      [connection, domNode, edges, flowNodes, nodeLookup, transform]
    );

    const snapped = generativeSnap;

    const outboundFromImageOutput = useMemo(() => {
      if (
        connection.fromHandle?.id !== AI_IMAGE_OUTPUT_ID ||
        !connection.fromNode
      ) {
        return null;
      }
      const node = nodeLookup.get(connection.fromNode.id);
      return node ? snapAiImageOutputBorderPoint(node) : null;
    }, [connection.fromHandle, connection.fromNode, nodeLookup]);

    const outboundFromKeywords = useMemo(() => {
      if (
        connection.fromHandle?.type !== "target" ||
        connection.fromHandle.id !== AI_TEXT_KEYWORDS_HANDLE_ID ||
        !connection.fromNode
      ) {
        return null;
      }
      const node = nodeLookup.get(connection.fromNode.id);
      return node ? snapAiTextKeywordsBorderPoint(node) : null;
    }, [connection.fromHandle, connection.fromNode, nodeLookup]);

    const outboundFromOutput = useMemo(() => {
      if (
        connection.fromHandle?.id !== AI_TEXT_OUTPUT_ID ||
        !connection.fromNode
      ) {
        return null;
      }
      const node = nodeLookup.get(connection.fromNode.id);
      return node ? snapAiTextOutputBorderPoint(node) : null;
    }, [connection.fromHandle, connection.fromNode, nodeLookup]);

    const pathOffset = useMemo(() => {
      if (
        snapped ||
        outboundFromKeywords ||
        outboundFromOutput ||
        outboundFromImageOutput
      ) {
        return GENERATIVE_EDGE_PLUS_BORDER_GAP_PX;
      }
      const fromType = (
        connection.fromNode?.data as { nodeType?: string } | undefined
      )?.nodeType;
      return getAiTextEdgePathOffset(
        fromType,
        undefined,
        connection.fromHandle?.id ?? null,
        null
      );
    }, [
      connection.fromHandle,
      connection.fromNode,
      outboundFromKeywords,
      outboundFromOutput,
      outboundFromImageOutput,
      snapped,
    ]);

    const targetX = snapped?.x ?? toX;
    const targetY = snapped?.y ?? toY;
    const targetPosition = snapped
      ? snapped.side === "right"
        ? Position.Right
        : Position.Left
      : toPosition;
    const status =
      previewAllowed === null
        ? connectionStatus
        : previewAllowed
          ? "valid"
          : "invalid";

    const sourceX =
      outboundFromOutput?.x ??
      outboundFromImageOutput?.x ??
      outboundFromKeywords?.x ??
      fromX;
    const sourceY =
      outboundFromOutput?.y ??
      outboundFromImageOutput?.y ??
      outboundFromKeywords?.y ??
      fromY;
    const sourcePosition = outboundFromOutput || outboundFromImageOutput
      ? Position.Right
      : outboundFromKeywords
        ? Position.Left
        : fromPosition;

    const previewTargetId =
      snapped?.nodeId ??
      (outboundFromOutput || outboundFromImageOutput || outboundFromKeywords
        ? ""
        : (connection.toNode?.id ?? ""));

    const snappedTargetHandle = snapped?.targetHandle ?? null;

    const anchors = useMemo(
      () =>
        resolveAiTextEdgeAnchors({
          sourceX,
          sourceY,
          targetX,
          targetY,
          source: connection.fromNode?.id ?? "",
          target: previewTargetId,
          sourceHandle: connection.fromHandle?.id ?? null,
          targetHandle: snappedTargetHandle,
          nodeLookup,
        }),
      [
        connection.fromHandle,
        connection.fromNode,
        nodeLookup,
        previewTargetId,
        snappedTargetHandle,
        sourceX,
        sourceY,
        targetX,
        targetY,
      ]
    );

    const edgePath = buildWorkflowSmoothStepPath({
      sourceX: anchors.sourceX,
      sourceY: anchors.sourceY,
      targetX: anchors.targetX,
      targetY: anchors.targetY,
      sourcePosition,
      targetPosition,
      offset: pathOffset,
    });

    const getColor = () => {
      if (status === "invalid") return "#f87171";
      if (status === "valid") return "#16a34a";
      return "#d4d4d4";
    };

    return renderWorkflowEdgePath(edgePath, getColor(), { zIndex: undefined });
  }
);

WorkflowConnectionLine.displayName = "WorkflowConnectionLine";
