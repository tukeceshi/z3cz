import type { ObjectReference } from "@dafthunk/types";
import type {
  Edge as ReactFlowEdge,
  Node as ReactFlowNode,
} from "@xyflow/react";
import { useCallback, useState } from "react";

import type {
  NodeExecutionState,
  WorkflowEdgeType,
  WorkflowNodeType,
} from "./workflow-types";

interface ClipboardData {
  nodes: ReactFlowNode<WorkflowNodeType>[];
  edges: ReactFlowEdge<WorkflowEdgeType>[];
  isCut: boolean;
}

interface UseClipboardProps {
  nodes: ReactFlowNode<WorkflowNodeType>[];
  edges: ReactFlowEdge<WorkflowEdgeType>[];
  selectedNodes: ReactFlowNode<WorkflowNodeType>[];
  selectedEdges: ReactFlowEdge<WorkflowEdgeType>[];
  setNodes: React.Dispatch<
    React.SetStateAction<ReactFlowNode<WorkflowNodeType>[]>
  >;
  setEdges: React.Dispatch<
    React.SetStateAction<ReactFlowEdge<WorkflowEdgeType>[]>
  >;
  removeNodesWithoutConfirm: (nodeIds: readonly string[]) => void;
  disabled: boolean;
  createObjectUrl: (objectReference: ObjectReference) => string;
  captureHistory: () => void;
}

interface UseClipboardReturn {
  copySelected: () => void;
  cutSelected: () => void;
  pasteFromClipboard: () => void;
  duplicateNode: (nodeId: string) => void;
  duplicateSelected: () => void;
  hasClipboardData: boolean;
}

export function useClipboard({
  nodes,
  edges,
  selectedNodes,
  selectedEdges,
  setNodes,
  setEdges,
  removeNodesWithoutConfirm,
  disabled,
  createObjectUrl,
  captureHistory,
}: UseClipboardProps): UseClipboardReturn {
  const [clipboardData, setClipboardData] = useState<ClipboardData | null>(
    null
  );

  // Duplicate a single node
  const duplicateNode = useCallback(
    (nodeId: string) => {
      if (disabled) return;
      const nodeToDuplicate = nodes.find((n) => n.id === nodeId);
      if (!nodeToDuplicate) return;

      captureHistory();

      const newNode: ReactFlowNode<WorkflowNodeType> = {
        ...nodeToDuplicate,
        id: `${nodeToDuplicate.data.nodeType || "node"}-${Date.now()}`,
        position: {
          x: nodeToDuplicate.position.x + 250,
          y: nodeToDuplicate.position.y + 50,
        },
        selected: true,
        data: {
          ...nodeToDuplicate.data,
          executionState: "idle" as NodeExecutionState,
          error: undefined,
          outputs: nodeToDuplicate.data.outputs.map((output) => ({
            ...output,
            value: undefined,
          })),
          inputs: nodeToDuplicate.data.inputs,
        },
      };

      setNodes((nds) => [
        ...nds.map((n) => ({ ...n, selected: false })),
        newNode,
      ]);

      setEdges((eds) =>
        eds.map((edge) => ({
          ...edge,
          selected: false,
          zIndex: 0,
        }))
      );
    },
    [captureHistory, disabled, nodes, setNodes, setEdges]
  );

  // Duplicate selected elements (nodes and edges)
  const duplicateSelected = useCallback(() => {
    if (disabled || (selectedNodes.length === 0 && selectedEdges.length === 0))
      return;

    captureHistory();

    if (selectedNodes.length > 0) {
      const selectedNodeIds = selectedNodes.map((node) => node.id);
      const connectedEdges = edges.filter(
        (edge) =>
          selectedNodeIds.includes(edge.source) &&
          selectedNodeIds.includes(edge.target)
      );

      const allSelectedEdges = [
        ...new Set([...connectedEdges, ...selectedEdges]),
      ];

      const duplicateOffset = { x: 50, y: 50 };
      const timestamp = Date.now();

      const nodeIdMap = new Map<string, string>();

      const newNodes = selectedNodes.map((node, index) => {
        const newId = `${node.data.nodeType || "node"}-${timestamp}-${index}`;
        nodeIdMap.set(node.id, newId);

        return {
          ...node,
          id: newId,
          position: {
            x: node.position.x + duplicateOffset.x,
            y: node.position.y + duplicateOffset.y,
          },
          selected: true,
          data: {
            ...node.data,
            executionState: "idle" as NodeExecutionState,
            error: undefined,
            outputs: node.data.outputs.map((output) => ({
              ...output,
              value: undefined,
            })),
            inputs: node.data.inputs,
          },
        };
      });

      const newEdges = allSelectedEdges
        .filter(
          (edge) => nodeIdMap.has(edge.source) && nodeIdMap.has(edge.target)
        )
        .map((edge) => ({
          ...edge,
          id: `${nodeIdMap.get(edge.source)}-${edge.sourceHandle}-${nodeIdMap.get(edge.target)}-${edge.targetHandle}`,
          source: nodeIdMap.get(edge.source)!,
          target: nodeIdMap.get(edge.target)!,
          selected: true,
          data: {
            ...edge.data,
            createObjectUrl,
          },
        }));

      setNodes((nds) => [
        ...nds.map((n) => ({ ...n, selected: false })),
        ...newNodes,
      ]);

      setEdges((eds) => [
        ...eds.map((e) => ({ ...e, selected: false })),
        ...newEdges,
      ]);
    }
  }, [
    captureHistory,
    disabled,
    selectedNodes,
    selectedEdges,
    edges,
    setNodes,
    setEdges,
    createObjectUrl,
  ]);

  // Copy selected elements to clipboard
  const copySelected = useCallback(() => {
    if (disabled || (selectedNodes.length === 0 && selectedEdges.length === 0))
      return;

    const selectedNodeIds = selectedNodes.map((node) => node.id);
    const connectedEdges = edges.filter(
      (edge) =>
        selectedNodeIds.includes(edge.source) &&
        selectedNodeIds.includes(edge.target)
    );

    const allSelectedEdges = [
      ...new Set([...connectedEdges, ...selectedEdges]),
    ];

    setClipboardData({
      nodes: selectedNodes.map((node) => ({
        ...node,
        selected: false,
      })),
      edges: allSelectedEdges.map((edge) => ({
        ...edge,
        selected: false,
      })),
      isCut: false,
    });
  }, [disabled, selectedNodes, selectedEdges, edges]);

  // Cut selected elements
  const cutSelected = useCallback(() => {
    if (disabled || (selectedNodes.length === 0 && selectedEdges.length === 0))
      return;

    const selectedNodeIds = selectedNodes.map((node) => node.id);
    const connectedEdges = edges.filter(
      (edge) =>
        selectedNodeIds.includes(edge.source) &&
        selectedNodeIds.includes(edge.target)
    );
    const allSelectedEdges = [
      ...new Set([...connectedEdges, ...selectedEdges]),
    ];

    setClipboardData({
      nodes: selectedNodes.map((node) => ({ ...node, selected: false })),
      edges: allSelectedEdges.map((edge) => ({ ...edge, selected: false })),
      isCut: true,
    });

    if (selectedNodes.length > 0) {
      removeNodesWithoutConfirm(selectedNodes.map((node) => node.id));
    } else if (selectedEdges.length > 0) {
      captureHistory();
      const edgeIds = new Set(selectedEdges.map((edge) => edge.id));
      setEdges((eds) => eds.filter((edge) => !edgeIds.has(edge.id)));
    }
  }, [
    captureHistory,
    disabled,
    selectedNodes,
    selectedEdges,
    edges,
    removeNodesWithoutConfirm,
    setEdges,
  ]);

  // Paste from clipboard
  const pasteFromClipboard = useCallback(() => {
    if (disabled || !clipboardData || clipboardData.nodes.length === 0) return;

    captureHistory();

    const pasteOffset = { x: 50, y: 50 };

    const nodeIdMap = new Map<string, string>();
    const timestamp = Date.now();

    const newNodes = clipboardData.nodes.map((node, index) => {
      const newId = `${node.data.nodeType || "node"}-${timestamp}-${index}`;
      nodeIdMap.set(node.id, newId);

      return {
        ...node,
        id: newId,
        position: {
          x: node.position.x + pasteOffset.x,
          y: node.position.y + pasteOffset.y,
        },
        selected: true,
        data: {
          ...node.data,
          executionState: "idle" as NodeExecutionState,
          error: undefined,
          outputs: node.data.outputs.map((output) => ({
            ...output,
            value: undefined,
          })),
          inputs: node.data.inputs,
          createObjectUrl,
        },
      };
    });

    const newEdges = clipboardData.edges
      .filter(
        (edge) => nodeIdMap.has(edge.source) && nodeIdMap.has(edge.target)
      )
      .map((edge) => ({
        ...edge,
        id: `${nodeIdMap.get(edge.source)}-${edge.sourceHandle}-${nodeIdMap.get(edge.target)}-${edge.targetHandle}`,
        source: nodeIdMap.get(edge.source)!,
        target: nodeIdMap.get(edge.target)!,
        selected: true,
        data: {
          ...edge.data,
          createObjectUrl,
        },
      }));

    setNodes((nds) => [
      ...nds.map((n) => ({ ...n, selected: false })),
      ...newNodes,
    ]);

    setEdges((eds) => [
      ...eds.map((e) => ({ ...e, selected: false })),
      ...newEdges,
    ]);

    if (clipboardData.isCut) {
      setClipboardData(null);
    }
  }, [captureHistory, disabled, clipboardData, setNodes, setEdges, createObjectUrl]);

  return {
    copySelected,
    cutSelected,
    pasteFromClipboard,
    duplicateNode,
    duplicateSelected,
    hasClipboardData: !!clipboardData && clipboardData.nodes.length > 0,
  };
}
