import { AI_IMAGE_NODE_TYPE, AI_TEXT_NODE_TYPE, type ObjectReference, type WorkflowTrigger } from "@dafthunk/types";
import type {
  Connection,
  IsValidConnection,
  NodeChange,
  OnConnect,
  OnConnectEnd,
  OnConnectStart,
  OnEdgesChange,
  OnNodesChange,
  Edge as ReactFlowEdge,
  ReactFlowInstance,
  Node as ReactFlowNode,
} from "@xyflow/react";
import {
  addEdge,
  getConnectedEdges,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ALL_TRIGGER_NODE_TYPE_IDS,
  getTriggerNodeTypes,
} from "./trigger-node-mapping";
import { collectAiTextFirstDegreeEdgeIds } from "./ai-text-edge-selection";
import { collectAiImageFirstDegreeEdgeIds } from "./ai-image-edge-selection";
import {
  buildAiTextReferenceConnectionFromCardDrop,
} from "./ai-text-reference-policy";
import {
  buildAiImageReferenceConnectionFromCardDrop,
} from "./ai-image-reference-policy";
import {
  mergeAiTextNodeCatalogInputs,
} from "./ai-text-node-utils";
import {
  mergeAiImageNodeCatalogInputs,
} from "./ai-image-node-utils";
import { validateWorkflowConnection } from "./workflow-connection-validation";
import type {
  ConnectionValidationState,
  NodeExecutionState,
  NodeExecutionUpdate,
  NodeType,
  WorkflowEdgeType,
  WorkflowNodeType,
  WorkflowParameter,
} from "./workflow-types";

// --- Pure helper functions ---

function updateNodesWithExecutionState(
  nodes: ReactFlowNode<WorkflowNodeType>[],
  nodeId: string,
  state: NodeExecutionState
): ReactFlowNode<WorkflowNodeType>[] {
  return nodes.map((node) =>
    node.id === nodeId
      ? {
          ...node,
          data: {
            ...node.data,
            executionState: state,
            error: state === "error" ? node.data.error : null,
          },
        }
      : node
  );
}

function updateEdgesForNodeExecution(
  edges: ReactFlowEdge<WorkflowEdgeType>[],
  state: NodeExecutionState,
  connectedEdgeIds: string[]
): ReactFlowEdge<WorkflowEdgeType>[] {
  if (state === "executing") {
    return edges.map((edge) => ({
      ...edge,
      data: {
        ...(edge.data || {}),
        isActive: connectedEdgeIds.includes(edge.id),
      },
    }));
  }

  if (state === "completed" || state === "error") {
    return edges.map((edge) => ({
      ...edge,
      data: {
        ...(edge.data || {}),
        isActive: false,
      },
    }));
  }

  return edges;
}

function updateNodesWithExecutionOutputs(
  nodes: ReactFlowNode<WorkflowNodeType>[],
  nodeId: string,
  outputs: Record<string, unknown>
): ReactFlowNode<WorkflowNodeType>[] {
  return nodes.map((node) =>
    node.id === nodeId
      ? {
          ...node,
          data: {
            ...node.data,
            outputs: node.data.outputs.map(
              (output) =>
                ({
                  ...output,
                  value: outputs[output.id] ?? outputs[output.name],
                }) as WorkflowParameter
            ),
          },
        }
      : node
  );
}

function updateNodesWithExecutionError(
  nodes: ReactFlowNode<WorkflowNodeType>[],
  nodeId: string,
  error: string | undefined
): ReactFlowNode<WorkflowNodeType>[] {
  return nodes.map((node) =>
    node.id === nodeId
      ? {
          ...node,
          data: {
            ...node.data,
            error,
          },
        }
      : node
  );
}

function createReactFlowNode(
  nodeType: NodeType,
  position: { x: number; y: number },
  createObjectUrl: (objectReference: ObjectReference) => string,
  id?: string
): ReactFlowNode<WorkflowNodeType> {
  return {
    id: id ?? `${nodeType.type}-${Date.now()}`,
    type: "workflowNode",
    position,
    selected: false,
    data: {
      name: nodeType.name,
      inputs: nodeType.inputs.map((param) => ({ ...param, id: param.name })),
      outputs: nodeType.outputs.map((param) => ({ ...param, id: param.name })),
      executionState: "idle" as NodeExecutionState,
      nodeType: nodeType.type,
      icon: nodeType.icon,
      functionCalling: nodeType.functionCalling,
      asTool: nodeType.asTool,
      metadata: nodeType.metadata ? { ...nodeType.metadata } : undefined,
      createObjectUrl,
    },
  };
}

// --- Hook interface ---

export interface UseGraphOperationsProps {
  initialNodes?: ReactFlowNode<WorkflowNodeType>[];
  initialEdges?: ReactFlowEdge<WorkflowEdgeType>[];
  validateConnection?: (connection: Connection) => boolean;
  createObjectUrl: (objectReference: ObjectReference) => string;
  disabled?: boolean;
  nodeTypes?: NodeType[];
}

export interface UseGraphOperationsReturn {
  // State
  nodes: ReactFlowNode<WorkflowNodeType>[];
  edges: ReactFlowEdge<WorkflowEdgeType>[];
  selectedNodes: ReactFlowNode<WorkflowNodeType>[];
  selectedEdges: ReactFlowEdge<WorkflowEdgeType>[];
  soleSelectedNodeId: string | null;
  connectedHandles: ReadonlySet<string>;
  reactFlowInstance: ReactFlowInstance<
    ReactFlowNode<WorkflowNodeType>,
    ReactFlowEdge<WorkflowEdgeType>
  > | null;
  isNodeSelectorOpen: boolean;
  connectionValidationState: ConnectionValidationState;

  // Setters (needed by sub-hooks and composition)
  setNodes: React.Dispatch<
    React.SetStateAction<ReactFlowNode<WorkflowNodeType>[]>
  >;
  setEdges: React.Dispatch<
    React.SetStateAction<ReactFlowEdge<WorkflowEdgeType>[]>
  >;
  setIsNodeSelectorOpen: (open: boolean) => void;
  setReactFlowInstance: (
    instance: ReactFlowInstance<
      ReactFlowNode<WorkflowNodeType>,
      ReactFlowEdge<WorkflowEdgeType>
    > | null
  ) => void;
  nodesRef: React.RefObject<ReactFlowNode<WorkflowNodeType>[]>;
  edgesRef: React.RefObject<ReactFlowEdge<WorkflowEdgeType>[]>;

  // Event handlers
  onNodesChange: OnNodesChange<ReactFlowNode<WorkflowNodeType>>;
  onEdgesChange: OnEdgesChange<ReactFlowEdge<WorkflowEdgeType>>;
  onConnect: OnConnect;
  onConnectStart: OnConnectStart;
  onConnectEnd: OnConnectEnd;
  onNodeDragStart: () => void;
  onNodeDragStop: (
    event: React.MouseEvent,
    node: ReactFlowNode<WorkflowNodeType>
  ) => void;
  isDraggingRef: React.RefObject<boolean>;
  isValidConnection: IsValidConnection<ReactFlowEdge<WorkflowEdgeType>>;

  // Actions
  handleAddNode: () => void;
  handleNodeSelect: (template: NodeType) => void;
  updateNodeExecution: (nodeId: string, update: NodeExecutionUpdate) => void;
  updateNodeData: (
    nodeId: string,
    data:
      | Partial<WorkflowNodeType>
      | ((current: WorkflowNodeType) => Partial<WorkflowNodeType>)
  ) => void;
  updateEdgeData: (edgeId: string, data: Partial<WorkflowEdgeType>) => void;
  deleteNode: (nodeId: string) => void;
  deleteEdge: (edgeId: string) => void;
  deleteSelected: () => void;
  deselectAll: () => void;
  addTriggerNodes: (trigger: WorkflowTrigger) => void;
  removeTriggerNodes: () => void;
}

const NOOP = () => {};

export function useGraphOperations({
  initialNodes = [],
  initialEdges = [],
  validateConnection = () => true,
  createObjectUrl,
  disabled = false,
  nodeTypes = [],
}: UseGraphOperationsProps): UseGraphOperationsReturn {
  // Core state
  const [nodes, setNodes, onNodesChange] =
    useNodesState<ReactFlowNode<WorkflowNodeType>>(initialNodes);
  const [edges, setEdges, onEdgesChange] =
    useEdgesState<ReactFlowEdge<WorkflowEdgeType>>(initialEdges);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance<
    ReactFlowNode<WorkflowNodeType>,
    ReactFlowEdge<WorkflowEdgeType>
  > | null>(null);
  const [isNodeSelectorOpen, setIsNodeSelectorOpen] = useState(false);
  const [connectionValidationState, setConnectionValidationState] =
    useState<ConnectionValidationState>("default");

  const nodesRef = useRef(initialNodes);
  const edgesRef = useRef(initialEdges);
  const isDraggingRef = useRef(false);

  const selectionFingerprint = useMemo(() => {
    const parts: string[] = [];
    for (const node of nodes) {
      if (node.selected) parts.push(node.id);
    }
    return parts.join(",");
  }, [nodes]);

  const selectedNodes = useMemo(
    () => nodes.filter((node) => node.selected),
    [nodes, selectionFingerprint]
  );

  const edgeSelectionFingerprint = useMemo(() => {
    const parts: string[] = [];
    for (const edge of edges) {
      if (edge.selected) parts.push(edge.id);
    }
    return parts.join(",");
  }, [edges]);

  const selectedEdges = useMemo(
    () => edges.filter((edge) => edge.selected),
    [edges, edgeSelectionFingerprint]
  );

  const soleSelectedNodeId = useMemo(() => {
    let found: string | null = null;
    for (const node of nodes) {
      if (!node.selected) continue;
      if (found !== null) return null;
      found = node.id;
    }
    return found;
  }, [nodes, selectionFingerprint]);

  const connectedHandles = useMemo(() => {
    const set = new Set<string>();
    for (const edge of edges) {
      if (edge.targetHandle) {
        set.add(`${edge.target}:${edge.targetHandle}`);
      }
      if (edge.sourceHandle) {
        set.add(`${edge.source}:${edge.sourceHandle}`);
      }
    }
    return set;
  }, [edges]);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  const edgeTopologyFingerprint = useMemo(
    () =>
      edges
        .map(
          (edge) =>
            `${edge.id}:${edge.source}:${edge.sourceHandle ?? ""}:${edge.target}:${edge.targetHandle ?? ""}`
        )
        .join("|"),
    [edges]
  );

  // AI text sole-select: animate first-degree connected edges (output → input).
  useEffect(() => {
    const selectedNode =
      soleSelectedNodeId !== null
        ? nodes.find((node) => node.id === soleSelectedNodeId)
        : undefined;
    const flowEdgeIds =
      selectedNode?.data.nodeType === AI_TEXT_NODE_TYPE && soleSelectedNodeId
        ? collectAiTextFirstDegreeEdgeIds(soleSelectedNodeId, edges)
        : selectedNode?.data.nodeType === AI_IMAGE_NODE_TYPE && soleSelectedNodeId
          ? collectAiImageFirstDegreeEdgeIds(soleSelectedNodeId, edges)
          : new Set<string>();

    setEdges((current) => {
      let changed = false;
      const next = current.map((edge) => {
        const animated = flowEdgeIds.has(edge.id);
        const nextZIndex = animated ? 1 : 0;
        if (edge.animated === animated && edge.zIndex === nextZIndex) {
          return edge;
        }
        changed = true;
        return { ...edge, animated, zIndex: nextZIndex };
      });
      return changed ? next : current;
    });
  }, [edgeTopologyFingerprint, nodes, selectionFingerprint, soleSelectedNodeId, setEdges]);

  // Sync initialNodes prop
  useEffect(() => {
    if (isDraggingRef.current) {
      return;
    }

    const newNodesWithCreateObjectUrl = initialNodes.map((node) => {
      const catalog = nodeTypes.find((entry) => entry.type === node.data.nodeType);
      const inputs = mergeAiImageNodeCatalogInputs(
        node.data.nodeType,
        mergeAiTextNodeCatalogInputs(
          node.data.nodeType,
          node.data.inputs,
          catalog
        ),
        catalog
      );

      return {
        ...node,
        data: {
          ...node.data,
          inputs,
          createObjectUrl,
        },
      };
    });

    if (!disabled && initialNodes.length === 0 && nodesRef.current.length > 0) {
      return;
    }

    const newNodesStrippedForCompare = newNodesWithCreateObjectUrl.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: { ...n.data, createObjectUrl: undefined },
    }));
    const currentNodesStrippedForCompare = nodesRef.current.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: { ...n.data, createObjectUrl: undefined },
    }));

    const newNodesStructurallyDifferent =
      JSON.stringify(newNodesStrippedForCompare) !==
      JSON.stringify(currentNodesStrippedForCompare);

    const anyCurrentNodeMissingFunction =
      newNodesWithCreateObjectUrl.length > 0 &&
      nodesRef.current.some(
        (n) => typeof n.data.createObjectUrl !== "function"
      );

    if (newNodesStructurallyDifferent || anyCurrentNodeMissingFunction) {
      const currentNodesById = new Map(nodesRef.current.map((n) => [n.id, n]));
      const updatedNodes = newNodesWithCreateObjectUrl.map((newNode) => {
        const currentNode = currentNodesById.get(newNode.id);
        if (currentNode) {
          return {
            ...newNode,
            selected: currentNode.selected,
            dragging: currentNode.dragging,
          };
        }
        return newNode;
      });

      setNodes(updatedNodes);
    }
  }, [initialNodes, disabled, setNodes, createObjectUrl, nodeTypes]);

  // Sync initialEdges prop
  useEffect(() => {
    if (!disabled && initialEdges.length === 0 && edgesRef.current.length > 0) {
      return;
    }
    if (JSON.stringify(edgesRef.current) !== JSON.stringify(initialEdges)) {
      setEdges(initialEdges);
    }
  }, [initialEdges, disabled, setEdges]);

  // In disabled mode, only allow selection changes.
  // Always prevent removal of trigger nodes (use trigger type selector instead).
  const handleNodesChangeInternal = useCallback(
    (changes: NodeChange<ReactFlowNode<WorkflowNodeType>>[]) => {
      if (disabled) {
        const selectionChanges = changes.filter(
          (change) => change.type === "select"
        );
        if (selectionChanges.length > 0) {
          onNodesChange(selectionChanges);
        }
        return;
      }

      const filtered = changes.filter((change) => {
        if (isDraggingRef.current && change.type === "position") {
          return false;
        }
        if (change.type !== "remove") return true;
        const node = nodesRef.current.find((n) => n.id === change.id);
        return !(
          node?.data.nodeType &&
          ALL_TRIGGER_NODE_TYPE_IDS.has(node.data.nodeType)
        );
      });

      if (filtered.length > 0) {
        onNodesChange(filtered);
      }
    },
    [onNodesChange, disabled, nodesRef]
  );

  // Connection event handlers
  const onConnectStart = useCallback(() => {
    if (disabled) return;
    setConnectionValidationState("default");
  }, [disabled]);

  // Connection validation
  const isValidConnection: IsValidConnection<ReactFlowEdge<WorkflowEdgeType>> =
    useCallback(
      (connection) => {
        if (!connection.source || !connection.target) return false;

        const conn: Connection = {
          source: connection.source,
          target: connection.target,
          sourceHandle: connection.sourceHandle ?? null,
          targetHandle: connection.targetHandle ?? null,
        };

        const valid = validateWorkflowConnection({
          connection: conn,
          nodes,
          edges,
          extraValidate: validateConnection,
          disabled,
        });

        setConnectionValidationState(valid ? "valid" : "invalid");
        return valid;
      },
      [nodes, edges, validateConnection, disabled]
    );

  // Handle connection
  const onConnect = useCallback(
    (connection: Connection) => {
      if (disabled) return;
      if (!connection.source || !connection.target) return;
      if (!isValidConnection(connection)) return;

      const sourceNode = nodes.find((node) => node.id === connection.source);
      const targetNode = nodes.find((node) => node.id === connection.target);
      if (!sourceNode || !targetNode) return;

      const targetInput = targetNode.data.inputs.find(
        (input) => input.id === connection.targetHandle
      );
      const sourceInput = sourceNode.data.inputs.find(
        (input) => input.id === connection.sourceHandle
      );

      const inputNodeId = targetInput ? connection.target : connection.source;
      const inputHandleId = targetInput
        ? connection.targetHandle
        : connection.sourceHandle;
      const acceptsMultipleConnections =
        targetInput?.repeated || sourceInput?.repeated || false;

      const newEdge: ReactFlowEdge<WorkflowEdgeType> = {
        ...connection,
        id: `${connection.source}-${connection.sourceHandle}-${connection.target}-${connection.targetHandle}-${Date.now()}`,
        type: "workflowEdge",
        data: {
          isValid: true,
          isActive: false,
          sourceType: connection.sourceHandle ?? undefined,
          targetType: connection.targetHandle ?? undefined,
          createObjectUrl,
        },
        zIndex: 0,
      };

      setEdges((eds) => {
        let filteredEdges = eds;

        if (!acceptsMultipleConnections) {
          filteredEdges = eds.filter(
            (edge) =>
              !(
                (edge.target === inputNodeId &&
                  edge.targetHandle === inputHandleId) ||
                (edge.source === inputNodeId &&
                  edge.sourceHandle === inputHandleId)
              )
          );
        }

        return addEdge(
          newEdge,
          filteredEdges.map((edge) => ({ ...edge, zIndex: 0 }))
        );
      });
    },
    [setEdges, isValidConnection, disabled, createObjectUrl, nodes]
  );

  const onConnectEnd = useCallback<OnConnectEnd>(
    (event, connectionState) => {
      if (disabled) {
        setConnectionValidationState("default");
        return;
      }

      if (!connectionState.isValid && connectionState.fromNode && "clientX" in event) {
        const topEl = document.elementFromPoint(event.clientX, event.clientY);
        const nodeEl = topEl?.closest(
          ".react-flow__node"
        ) as HTMLElement | null;
        const hoveredNodeId = nodeEl?.getAttribute("data-id");
        if (hoveredNodeId) {
          const policyNodes = nodesRef.current.map((node) => ({
            id: node.id,
            data: node.data,
          }));
          const drop =
            buildAiTextReferenceConnectionFromCardDrop({
              dragFromNodeId: connectionState.fromNode.id,
              dragFromHandle: connectionState.fromHandle,
              hoveredNodeId,
              nodes: policyNodes,
            }) ??
            buildAiImageReferenceConnectionFromCardDrop({
              dragFromNodeId: connectionState.fromNode.id,
              dragFromHandle: connectionState.fromHandle,
              hoveredNodeId,
              nodes: policyNodes,
            });
          if (
            drop &&
            validateWorkflowConnection({
              connection: drop,
              nodes: nodesRef.current,
              edges: edgesRef.current,
              disabled,
            })
          ) {
            onConnect(drop);
          }
        }
      }

      setConnectionValidationState("default");
    },
    [disabled, onConnect, edgesRef, nodesRef]
  );

  // Node management
  const handleAddNode = useCallback(() => {
    if (disabled) return;
    setIsNodeSelectorOpen(true);
  }, [disabled]);

  const handleNodeSelect = useCallback(
    (nodeType: NodeType) => {
      if (!reactFlowInstance) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });

      const newNode = createReactFlowNode(nodeType, position, createObjectUrl);
      newNode.selected = true;

      setNodes((nds) => [
        ...nds.map((node) => ({ ...node, selected: false })),
        newNode,
      ]);
    },
    [reactFlowInstance, setNodes, createObjectUrl]
  );

  // Update node execution data
  const updateNodeExecution = useCallback(
    (nodeId: string, update: NodeExecutionUpdate) => {
      const { state, outputs, error } = update;

      setNodes((nds) => {
        let updatedNodes = nds;

        if (state !== undefined) {
          updatedNodes = updateNodesWithExecutionState(
            updatedNodes,
            nodeId,
            state
          );
        }

        if (outputs !== undefined) {
          updatedNodes = updateNodesWithExecutionOutputs(
            updatedNodes,
            nodeId,
            outputs
          );
        }

        if (error !== undefined) {
          updatedNodes = updateNodesWithExecutionError(
            updatedNodes,
            nodeId,
            error
          );
        }

        return [...updatedNodes];
      });

      if (state !== undefined) {
        setEdges((eds) => {
          const nodeEdges = getConnectedEdges(
            [{ id: nodeId } as ReactFlowNode<WorkflowNodeType>],
            eds
          );
          const connectedEdgeIds = nodeEdges.map((edge) => edge.id);
          return [...updateEdgesForNodeExecution(eds, state, connectedEdgeIds)];
        });
      }
    },
    [setNodes, setEdges]
  );

  const updateNodeData = useCallback(
    (
      nodeId: string,
      dataOrFn:
        | Partial<WorkflowNodeType>
        | ((current: WorkflowNodeType) => Partial<WorkflowNodeType>)
    ) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id !== nodeId) return node;
          const update =
            typeof dataOrFn === "function" ? dataOrFn(node.data) : dataOrFn;
          return {
            ...node,
            data: {
              ...node.data,
              ...update,
            },
          };
        })
      );
    },
    [setNodes]
  );

  const updateEdgeData = useCallback(
    (edgeId: string, data: Partial<WorkflowEdgeType>) => {
      setEdges((eds) =>
        eds.map((edge) =>
          edge.id === edgeId
            ? {
                ...edge,
                data: {
                  ...edge.data,
                  ...data,
                },
              }
            : edge
        )
      );
    },
    [setEdges]
  );

  // Delete nodes and their connected edges (trigger nodes are protected)
  const deleteNodes = useCallback(
    (nodeIds: string[]) => {
      if (disabled || nodeIds.length === 0) return;

      const nodesToDelete = nodesRef.current.filter(
        (n) =>
          nodeIds.includes(n.id) &&
          !(n.data.nodeType && ALL_TRIGGER_NODE_TYPE_IDS.has(n.data.nodeType))
      );
      if (nodesToDelete.length === 0) return;

      const nodeEdges = getConnectedEdges(nodesToDelete, edgesRef.current);
      const edgeIdsToRemove = nodeEdges.map((edge) => edge.id);

      if (edgeIdsToRemove.length > 0) {
        setEdges((eds) =>
          eds.filter((edge) => !edgeIdsToRemove.includes(edge.id))
        );
      }

      setNodes((nds) => nds.filter((node) => !nodeIds.includes(node.id)));
    },
    [disabled, nodesRef, setEdges, setNodes]
  );

  const deleteNode = useCallback(
    (nodeId: string) => deleteNodes([nodeId]),
    [deleteNodes]
  );

  const deleteEdge = useCallback(
    (edgeId: string) => {
      if (disabled) return;
      setEdges((eds) => eds.filter((edge) => edge.id !== edgeId));
    },
    [disabled, setEdges]
  );

  const deleteSelected = useCallback(() => {
    if (disabled) return;

    if (selectedNodes.length > 0) {
      deleteNodes(selectedNodes.map((n) => n.id));
    } else if (selectedEdges.length > 0) {
      const edgeIds = selectedEdges.map((e) => e.id);
      setEdges((eds) => eds.filter((edge) => !edgeIds.includes(edge.id)));
    }
  }, [disabled, selectedNodes, selectedEdges, deleteNodes, setEdges]);

  const deselectAll = useCallback(() => {
    setNodes((nds) => nds.map((node) => ({ ...node, selected: false })));
    setEdges((eds) => eds.map((edge) => ({ ...edge, selected: false })));
  }, [setNodes, setEdges]);

  const removeTriggerNodes = useCallback(() => {
    const triggerNodes = nodesRef.current.filter(
      (n) => n.data.nodeType && ALL_TRIGGER_NODE_TYPE_IDS.has(n.data.nodeType)
    );
    if (triggerNodes.length === 0) return;

    const triggerNodeIds = new Set(triggerNodes.map((n) => n.id));
    const edgeIdsToRemove = getConnectedEdges(
      triggerNodes,
      edgesRef.current
    ).map((e) => e.id);

    if (edgeIdsToRemove.length > 0) {
      setEdges((eds) => eds.filter((e) => !edgeIdsToRemove.includes(e.id)));
    }
    setNodes((nds) => nds.filter((n) => !triggerNodeIds.has(n.id)));
  }, [nodesRef, edgesRef, setNodes, setEdges]);

  const addTriggerNodes = useCallback(
    (trigger: WorkflowTrigger) => {
      const nodeTypeIds = getTriggerNodeTypes(trigger);
      if (nodeTypeIds.length === 0) return;

      const newNodes = nodeTypeIds.flatMap((nodeTypeId, i) => {
        const nodeType = nodeTypes.find((nt) => nt.type === nodeTypeId);
        if (!nodeType) return [];
        return createReactFlowNode(
          nodeType,
          { x: i * 400, y: 0 },
          createObjectUrl,
          `${nodeType.type}-${Date.now()}-${i}`
        );
      });

      if (newNodes.length > 0) {
        setNodes((nds) => [...nds, ...newNodes]);
      }
    },
    [nodeTypes, setNodes, createObjectUrl]
  );

  return {
    nodes,
    edges,
    selectedNodes,
    selectedEdges,
    soleSelectedNodeId,
    connectedHandles,
    reactFlowInstance,
    isNodeSelectorOpen,
    connectionValidationState,
    setNodes,
    setEdges,
    setIsNodeSelectorOpen,
    setReactFlowInstance,
    nodesRef,
    edgesRef,
    onNodesChange: handleNodesChangeInternal,
    onEdgesChange: disabled ? NOOP : onEdgesChange,
    onConnect,
    onConnectStart,
    onConnectEnd,
    onNodeDragStart: useCallback(() => {
      isDraggingRef.current = true;
    }, []),
    onNodeDragStop: useCallback(() => {
      isDraggingRef.current = false;
      if (!reactFlowInstance) return;

      const liveNodes = reactFlowInstance.getNodes();
      const posById = new Map(liveNodes.map((n) => [n.id, n.position]));

      setNodes((prev) => {
        const updated = prev.map((n) => {
          const pos = posById.get(n.id);
          return pos ? { ...n, position: pos } : n;
        });
        nodesRef.current = updated;
        return updated;
      });
    }, [reactFlowInstance, setNodes, nodesRef]),
    isDraggingRef,
    isValidConnection,
    handleAddNode,
    handleNodeSelect,
    updateNodeExecution,
    updateNodeData,
    updateEdgeData: disabled ? NOOP : updateEdgeData,
    deleteNode: disabled ? NOOP : deleteNode,
    deleteEdge: disabled ? NOOP : deleteEdge,
    deleteSelected: disabled ? NOOP : deleteSelected,
    deselectAll,
    addTriggerNodes: disabled ? NOOP : addTriggerNodes,
    removeTriggerNodes: disabled ? NOOP : removeTriggerNodes,
  };
}
