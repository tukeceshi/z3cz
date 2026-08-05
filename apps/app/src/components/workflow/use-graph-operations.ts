import { AI_AUDIO_NODE_TYPE, AI_GENERATIVE_NODE_TYPES, AI_IMAGE_NODE_TYPE, AI_TEXT_NODE_TYPE, AI_VIDEO_NODE_TYPE, type AiGenerativeNodeType, type ObjectReference, type WorkflowEditorViewport, type WorkflowGenerativeDefaults, type WorkflowTrigger } from "@dafthunk/types";
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
  getConnectedEdges,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import type { RefObject, MouseEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useTranslation } from "@/components/locale-provider";
import { useAppToast } from "@/hooks/use-app-toast";

import {
  ALL_TRIGGER_NODE_TYPE_IDS,
  getTriggerNodeTypes,
} from "./trigger-node-mapping";
import { collectAiTextFirstDegreeEdgeIds } from "./ai-text-edge-selection";
import { collectAiImageFirstDegreeEdgeIds } from "./ai-image-edge-selection";
import { collectAiAudioFirstDegreeEdgeIds } from "./ai-audio-edge-selection";
import { collectAiVideoFirstDegreeEdgeIds } from "./ai-video-edge-selection";
import { shouldSuppressGenerativePanelDeselect } from "./generative-panel-pointer-guard";
import {
  buildAiTextReferenceConnectionFromCardDrop,
} from "./ai-text-reference-policy";
import {
  buildAiImageReferenceConnectionFromCardDrop,
} from "./ai-image-reference-policy";
import { buildAiImagePromptReferenceConnectionFromCardDrop } from "./ai-image-prompt-reference";
import {
  buildAiVideoReferenceConnectionFromCardDrop,
} from "./ai-video-reference-policy";
import { buildAiAudioPromptReferenceConnectionFromCardDrop } from "./ai-audio-prompt-reference";
import { buildAiVideoPromptReferenceConnectionFromCardDrop } from "./ai-video-prompt-reference";
import {
  mergeAiTextNodeCatalogInputs,
} from "./ai-text-node-utils";
import {
  mergeAiImageNodeCatalogInputs,
} from "./ai-image-node-utils";
import {
  mergeAiAudioNodeCatalogInputs,
} from "./ai-audio-node-utils";
import {
  mergeAiVideoNodeCatalogInputs,
} from "./ai-video-node-utils";
import {
  validateWorkflowConnection,
} from "./workflow-connection-validation";
import { buildReferenceConnectionToNewNode } from "./workflow-add-node-connection";
import { withGenerativeCardGenerateError } from "./generative-card-error-utils";
import { prepareGenerativeCardError } from "./prepare-generative-card-error";
import { resolveGenerativeNodeDefaultBaseName, resolveGenerativeNodeDisplayName } from "./generative-node-naming";
import {
  generativeModalityForNodeType,
  readWorkflowGenerativeDefault,
} from "./generative-workflow-defaults";
import { persistGenerativeBindingWithParams } from "./org-model-selection-utils";
import {
  mergePreparedWorkflowEdge,
  prepareWorkflowConnectionAppend,
} from "./workflow-connection-commit";
import {
  resolveAddNodeReferenceModel,
} from "./workflow-add-node-model";
import type { WorkflowAddNodeMenuState } from "./workflow-add-node-menu";
import {
  findOpenNodePosition,
  findOpenNodePositionFromSource,
  findOpenNodePositionNearPoint,
  resolveWorkflowNodeDimensions,
} from "./workflow-node-placement";
import { computeViewportForFlowCenter } from "./workflow-viewport-utils";
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

function isGenerativeAiNodeType(nodeType: string | undefined): boolean {
  return (
    nodeType !== undefined &&
    (AI_GENERATIVE_NODE_TYPES as readonly string[]).includes(nodeType)
  );
}

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
            metadata:
              state !== "error" && isGenerativeAiNodeType(node.data.nodeType)
                ? withGenerativeCardGenerateError(node.data.metadata, null)
                : node.data.metadata,
          },
        }
      : node
  );
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
            metadata: isGenerativeAiNodeType(node.data.nodeType)
              ? withGenerativeCardGenerateError(
                  node.data.metadata,
                  error ? prepareGenerativeCardError(error) : null
                )
              : node.data.metadata,
          },
        }
      : node
  );
}

function keepLocalInputValues(
  incoming: readonly WorkflowParameter[],
  local: readonly WorkflowParameter[] | undefined
): WorkflowParameter[] {
  if (!local?.length) {
    return [...incoming];
  }

  const localValues = new Map(
    local
      .filter((input) => input.value != null && input.value !== "")
      .map((input) => [input.id, input.value])
  );

  return incoming.map((input) =>
    localValues.has(input.id)
      ? ({ ...input, value: localValues.get(input.id) } as WorkflowParameter)
      : input
  );
}

function mergeGenerativeNodeCatalogInputs(
  nodeType: string | undefined,
  inputs: readonly WorkflowParameter[],
  catalog: NodeType | undefined
): WorkflowParameter[] {
  return mergeAiAudioNodeCatalogInputs(
    nodeType,
    mergeAiVideoNodeCatalogInputs(
      nodeType,
      mergeAiImageNodeCatalogInputs(
        nodeType,
        mergeAiTextNodeCatalogInputs(nodeType, inputs, catalog),
        catalog
      ),
      catalog
    ),
    catalog
  );
}

function applyGenerativeDefaultsOnCreate(
  nodeType: string | undefined,
  inputs: WorkflowParameter[],
  generativeDefaults: WorkflowGenerativeDefaults | undefined
): WorkflowParameter[] {
  const modality = generativeModalityForNodeType(nodeType);
  if (!modality) {
    return inputs;
  }
  const entry = readWorkflowGenerativeDefault(generativeDefaults, modality);
  if (!entry) {
    return inputs;
  }
  return persistGenerativeBindingWithParams(
    inputs,
    {
      canonicalId: entry.canonicalId,
      interfaceId: entry.interfaceId,
    },
    entry.params ?? {}
  );
}

function createReactFlowNode(
  nodeType: NodeType,
  position: { x: number; y: number },
  createObjectUrl: (objectReference: ObjectReference) => string,
  existingNodes: ReadonlyArray<ReactFlowNode<WorkflowNodeType>>,
  t: (key: string) => string,
  _orgId: string | undefined,
  generativeDefaults: WorkflowGenerativeDefaults | undefined,
  id?: string
): ReactFlowNode<WorkflowNodeType> {
  const mergedInputs = mergeGenerativeNodeCatalogInputs(
    nodeType.type,
    nodeType.inputs.map((param) => ({ ...param, id: param.name })),
    nodeType
  );
  const inputs = applyGenerativeDefaultsOnCreate(
    nodeType.type,
    mergedInputs,
    generativeDefaults
  );

  return {
    id: id ?? `${nodeType.type}-${Date.now()}`,
    type: "workflowNode",
    position,
    selected: false,
    data: {
      name: resolveGenerativeNodeDisplayName({
        nodeType: nodeType.type,
        baseName: resolveGenerativeNodeDefaultBaseName(
          nodeType.type,
          nodeType.name,
          t
        ),
        existingNodes,
      }),
      inputs,
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
  allowedNodeTypes?: ReadonlySet<string>;
  nodeTypes?: NodeType[];
  orgId?: string;
  generativeDefaults?: WorkflowGenerativeDefaults;
  commitEditorViewport?: (viewport: WorkflowEditorViewport) => void;
  suppressViewportPersistEndRef?: RefObject<boolean>;
}

export interface UseGraphOperationsReturn {
  // State
  nodes: ReactFlowNode<WorkflowNodeType>[];
  edges: ReactFlowEdge<WorkflowEdgeType>[];
  selectedNodes: ReactFlowNode<WorkflowNodeType>[];
  selectedEdges: ReactFlowEdge<WorkflowEdgeType>[];
  soleSelectedNodeId: string | null;
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
  batchUpdateNodeExecutions: (
    updates: Readonly<Record<string, NodeExecutionUpdate>>
  ) => void;
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
  selectNode: (nodeId: string) => void;
  addTriggerNodes: (trigger: WorkflowTrigger) => void;
  removeTriggerNodes: () => void;
  addNodeMenu: WorkflowAddNodeMenuState | null;
  closeAddNodeMenu: () => void;
  handlePaneClick: () => void;
  handlePaneContextMenu: (event: MouseEvent) => void;
  handleAddNodeMenuSelect: (
    nodeType: AiGenerativeNodeType,
    menu: WorkflowAddNodeMenuState
  ) => void;
}

const NOOP = () => {};

export function useGraphOperations({
  initialNodes = [],
  initialEdges = [],
  validateConnection = () => true,
  createObjectUrl,
  disabled: readOnlyDisabled = false,
  allowedNodeTypes,
  nodeTypes = [],
  orgId,
  generativeDefaults,
  commitEditorViewport,
  suppressViewportPersistEndRef,
}: UseGraphOperationsProps): UseGraphOperationsReturn {
  const { t } = useTranslation();
  const toast = useAppToast();
  // Core state
  const [nodes, setNodes, onNodesChange] =
    useNodesState<ReactFlowNode<WorkflowNodeType>>(initialNodes);
  const [edges, setEdges, onEdgesChange] =
    useEdgesState<ReactFlowEdge<WorkflowEdgeType>>(initialEdges);

  const graphEditBlocked = readOnlyDisabled;
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance<
    ReactFlowNode<WorkflowNodeType>,
    ReactFlowEdge<WorkflowEdgeType>
  > | null>(null);
  const [isNodeSelectorOpen, setIsNodeSelectorOpen] = useState(false);
  const [connectionValidationState, setConnectionValidationState] =
    useState<ConnectionValidationState>("default");
  const [addNodeMenu, setAddNodeMenu] =
    useState<WorkflowAddNodeMenuState | null>(null);
  const addNodeMenuDismissGuardRef = useRef(false);

  const openAddNodeMenu = useCallback((menu: WorkflowAddNodeMenuState) => {
    addNodeMenuDismissGuardRef.current = true;
    setAddNodeMenu(menu);
    requestAnimationFrame(() => {
      addNodeMenuDismissGuardRef.current = false;
    });
  }, []);

  const closeAddNodeMenu = useCallback(() => {
    if (addNodeMenuDismissGuardRef.current) {
      return;
    }
    setAddNodeMenu(null);
  }, []);

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
          : selectedNode?.data.nodeType === AI_VIDEO_NODE_TYPE && soleSelectedNodeId
            ? collectAiVideoFirstDegreeEdgeIds(soleSelectedNodeId, edges)
            : selectedNode?.data.nodeType === AI_AUDIO_NODE_TYPE && soleSelectedNodeId
              ? collectAiAudioFirstDegreeEdgeIds(soleSelectedNodeId, edges)
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
      const inputs = mergeGenerativeNodeCatalogInputs(
        node.data.nodeType,
        node.data.inputs,
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

    if (!graphEditBlocked && initialNodes.length === 0 && nodesRef.current.length > 0) {
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
            data: {
              ...newNode.data,
              inputs: keepLocalInputValues(
                newNode.data.inputs,
                currentNode.data.inputs
              ),
            },
            selected: currentNode.selected,
            dragging: currentNode.dragging,
          };
        }
        return newNode;
      });

      setNodes(updatedNodes);
    }
  }, [initialNodes, graphEditBlocked, setNodes, createObjectUrl, nodeTypes]);

  // Sync initialEdges prop
  useEffect(() => {
    if (!graphEditBlocked && initialEdges.length === 0 && edgesRef.current.length > 0) {
      return;
    }
    if (JSON.stringify(edgesRef.current) !== JSON.stringify(initialEdges)) {
      setEdges(initialEdges);
    }
  }, [initialEdges, graphEditBlocked, setEdges]);

  // In graphEditBlocked mode, only allow selection changes.
  // Always prevent removal of trigger nodes (use trigger type selector instead).
  const handleNodesChangeInternal = useCallback(
    (changes: NodeChange<ReactFlowNode<WorkflowNodeType>>[]) => {
      if (graphEditBlocked) {
        const selectionChanges = changes.filter(
          (change) =>
            change.type === "select" &&
            !(
              change.selected === false &&
              shouldSuppressGenerativePanelDeselect(change.id)
            )
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
        if (
          change.type === "select" &&
          change.selected === false &&
          shouldSuppressGenerativePanelDeselect(change.id)
        ) {
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
    [graphEditBlocked, onNodesChange, nodesRef]
  );

  // Connection event handlers
  const onConnectStart = useCallback(() => {
    if (graphEditBlocked) return;
    setConnectionValidationState("default");
  }, [graphEditBlocked]);

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
          disabled: graphEditBlocked,
        });

        setConnectionValidationState(valid ? "valid" : "invalid");
        return valid;
      },
      [nodes, edges, validateConnection, graphEditBlocked]
    );

  // Handle connection
  const appendWorkflowConnection = useCallback(
    (
      connection: Connection,
      nodesSnapshot: readonly ReactFlowNode<WorkflowNodeType>[],
      edgesSnapshot: readonly ReactFlowEdge<WorkflowEdgeType>[]
    ): boolean => {
      const prepared = prepareWorkflowConnectionAppend({
        connection,
        nodes: nodesSnapshot,
        edges: edgesSnapshot,
        createObjectUrl,
        extraValidate: validateConnection,
        disabled: graphEditBlocked,
      });
      if (!prepared) {
        return false;
      }

      setEdges((currentEdges) => {
        const nextEdges = mergePreparedWorkflowEdge(currentEdges, prepared);
        edgesRef.current = nextEdges;
        return nextEdges;
      });
      return true;
    },
    [createObjectUrl, graphEditBlocked, setEdges, validateConnection]
  );

  const commitNodesAndConnection = useCallback(
    (
      nextNodes: ReactFlowNode<WorkflowNodeType>[],
      connection: Connection | null
    ) => {
      nodesRef.current = nextNodes;
      setNodes(nextNodes);

      if (!connection) {
        return;
      }

      appendWorkflowConnection(connection, nextNodes, edgesRef.current);
    },
    [appendWorkflowConnection, setNodes]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (graphEditBlocked) return;
      if (!connection.source || !connection.target) return;
      appendWorkflowConnection(connection, nodes, edges);
    },
    [appendWorkflowConnection, edges, graphEditBlocked, nodes]
  );

  const onConnectEnd = useCallback<OnConnectEnd>(
    (event, connectionState) => {
      if (graphEditBlocked) {
        setConnectionValidationState("default");
        return;
      }

      if (!connectionState.isValid && connectionState.fromNode && "clientX" in event) {
        const topEl = document.elementFromPoint(event.clientX, event.clientY);
        const nodeEl = topEl?.closest(
          ".react-flow__node"
        ) as HTMLElement | null;
        const hoveredNodeId = nodeEl?.getAttribute("data-id");

        if (
          !hoveredNodeId &&
          connectionState.fromHandle?.type === "source" &&
          isGenerativeAiNodeType(
            (connectionState.fromNode.data as WorkflowNodeType).nodeType
          ) &&
          reactFlowInstance
        ) {
          const flowPoint = reactFlowInstance.screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
          });
          openAddNodeMenu({
            screenX: event.clientX,
            screenY: event.clientY,
            flowX: flowPoint.x,
            flowY: flowPoint.y,
            sourceContext: {
              nodeId: connectionState.fromNode.id,
              handle: {
                type: connectionState.fromHandle.type,
                id: connectionState.fromHandle.id,
              },
            },
          });
          setConnectionValidationState("default");
          return;
        }

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
            buildAiImagePromptReferenceConnectionFromCardDrop({
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
            }) ??
            buildAiVideoPromptReferenceConnectionFromCardDrop({
              dragFromNodeId: connectionState.fromNode.id,
              dragFromHandle: connectionState.fromHandle,
              hoveredNodeId,
              nodes: policyNodes,
            }) ??
            buildAiVideoReferenceConnectionFromCardDrop({
              dragFromNodeId: connectionState.fromNode.id,
              dragFromHandle: connectionState.fromHandle,
              hoveredNodeId,
              nodes: policyNodes,
            }) ??
            buildAiAudioPromptReferenceConnectionFromCardDrop({
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
              disabled: graphEditBlocked,
            })
          ) {
            onConnect(drop);
          }
        }
      }

      setConnectionValidationState("default");
    },
    [graphEditBlocked, onConnect, edgesRef, nodesRef, openAddNodeMenu, reactFlowInstance]
  );

  const handlePaneClick = useCallback(() => {
    if (addNodeMenu) {
      closeAddNodeMenu();
    }
  }, [addNodeMenu, closeAddNodeMenu]);

  const handlePaneContextMenu = useCallback(
    (event: MouseEvent) => {
      if (graphEditBlocked || !reactFlowInstance) {
        return;
      }
      event.preventDefault();
      if (addNodeMenu) {
        setAddNodeMenu(null);
        return;
      }
      const flowPoint = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      openAddNodeMenu({
        screenX: event.clientX,
        screenY: event.clientY,
        flowX: flowPoint.x,
        flowY: flowPoint.y,
      });
    },
    [addNodeMenu, graphEditBlocked, openAddNodeMenu, reactFlowInstance]
  );

  const handleAddNodeMenuSelect = useCallback(
    (targetType: AiGenerativeNodeType, menu: WorkflowAddNodeMenuState) => {
      if (graphEditBlocked || !reactFlowInstance) {
        return;
      }

      setAddNodeMenu(null);

      const template = nodeTypes.find((entry) => entry.type === targetType);
      if (!template) {
        toast.error("workflow.canvas.nodeTypeUnavailable");
        return;
      }

      const existingNodes = nodesRef.current;
      const sourceContext = menu.sourceContext;
      let position: { x: number; y: number };

      if (sourceContext) {
        const sourceNode = existingNodes.find(
          (node) => node.id === sourceContext.nodeId
        );
        if (!sourceNode) {
          return;
        }
        position = findOpenNodePositionFromSource({
          sourceNode,
          targetNodeType: targetType,
          existingNodes,
          dropFlowY: menu.flowY,
        });
      } else {
        position = findOpenNodePositionNearPoint({
          flowPoint: { x: menu.flowX, y: menu.flowY },
          nodeType: targetType,
          existingNodes,
        });
      }

      const newNode = createReactFlowNode(
        template,
        position,
        createObjectUrl,
        existingNodes,
        t,
        orgId,
        generativeDefaults
      );
      newNode.selected = true;

      const deselectAndAppend = (
        node: ReactFlowNode<WorkflowNodeType>
      ): ReactFlowNode<WorkflowNodeType>[] => [
        ...existingNodes.map((entry) => ({ ...entry, selected: false })),
        node,
      ];

      if (!sourceContext) {
        commitNodesAndConnection(deselectAndAppend(newNode), null);
        return;
      }

      const sourceNode = existingNodes.find(
        (node) => node.id === sourceContext.nodeId
      );
      if (!sourceNode) {
        commitNodesAndConnection(deselectAndAppend(newNode), null);
        return;
      }

      const nodesWithNew = [...existingNodes, newNode];
      const policyNodes = nodesWithNew.map((node) => ({
        id: node.id,
        data: node.data,
      }));
      const connection = buildReferenceConnectionToNewNode({
        dragFromNodeId: sourceContext.nodeId,
        dragFromHandle: sourceContext.handle,
        targetNodeId: newNode.id,
        nodes: policyNodes,
      });

      if (!connection) {
        commitNodesAndConnection(deselectAndAppend(newNode), null);
        return;
      }

      void (async () => {
        try {
          const modelResult = await resolveAddNodeReferenceModel({
            orgId,
            targetType,
            targetNodeData: newNode.data,
            connection,
            sourceNodeType: sourceNode.data.nodeType,
            generativeDefaults,
          });

          if (!modelResult.canConnect) {
            toast.warning("workflow.canvas.referenceConnectFailed", {
              targetName: newNode.data.name ?? targetType,
              sourceName: sourceNode.data.name ?? sourceContext.nodeId,
            });
            return;
          }

          const finalNode = {
            ...newNode,
            data: modelResult.nodeData,
          };
          const nodesWithPrepared = [...existingNodes, finalNode];

          if (
            !validateWorkflowConnection({
              connection,
              nodes: nodesWithPrepared,
              edges: edgesRef.current,
              disabled: graphEditBlocked,
            })
          ) {
            toast.warning("workflow.canvas.referenceConnectFailed", {
              targetName: newNode.data.name ?? targetType,
              sourceName: sourceNode.data.name ?? sourceContext.nodeId,
            });
            return;
          }

          commitNodesAndConnection(
            deselectAndAppend(finalNode),
            connection
          );
        } catch {
          toast.error("workflow.canvas.referenceConnectModelError");
        }
      })();
    },
    [
      commitNodesAndConnection,
      createObjectUrl,
      generativeDefaults,
      graphEditBlocked,
      nodeTypes,
      orgId,
      reactFlowInstance,
      t,
      toast,
    ]
  );

  // Node management
  const handleAddNode = useCallback(() => {
    if (graphEditBlocked) return;
    setIsNodeSelectorOpen(true);
  }, [graphEditBlocked]);

  const handleNodeSelect = useCallback(
    (nodeType: NodeType) => {
      if (!reactFlowInstance) return;

      const placement = findOpenNodePosition({
        reactFlowInstance,
        nodeType: nodeType.type,
        existingNodes: nodesRef.current,
      });

      const newNode = createReactFlowNode(
        nodeType,
        placement.position,
        createObjectUrl,
        nodesRef.current,
        t,
        orgId,
        generativeDefaults
      );
      newNode.selected = true;

      setNodes((nds) => [
        ...nds.map((node) => ({ ...node, selected: false })),
        newNode,
      ]);

      if (placement.shouldPanIntoView) {
        const { width, height } = resolveWorkflowNodeDimensions(nodeType.type);
        const centerX = placement.position.x + width / 2;
        const centerY = placement.position.y + height / 2;
        const { zoom } = reactFlowInstance.getViewport();

        commitEditorViewport?.(
          computeViewportForFlowCenter(
            reactFlowInstance,
            centerX,
            centerY,
            zoom
          )
        );
        if (suppressViewportPersistEndRef) {
          suppressViewportPersistEndRef.current = true;
        }

        reactFlowInstance.setCenter(centerX, centerY, { zoom, duration: 200 });
      }
    },
    [
      reactFlowInstance,
      setNodes,
      createObjectUrl,
      nodesRef,
      t,
      orgId,
      generativeDefaults,
      commitEditorViewport,
      suppressViewportPersistEndRef,
    ]
  );

  // Update node execution data (batched for multi-node execution ticks)
  const batchUpdateNodeExecutions = useCallback(
    (updates: Readonly<Record<string, NodeExecutionUpdate>>) => {
      const entries = Object.entries(updates);
      if (entries.length === 0) {
        return;
      }

      setNodes((nds) => {
        let updatedNodes = nds;
        for (const [nodeId, update] of entries) {
          if (update.state !== undefined) {
            updatedNodes = updateNodesWithExecutionState(
              updatedNodes,
              nodeId,
              update.state
            );
          }
          if (update.outputs !== undefined) {
            updatedNodes = updateNodesWithExecutionOutputs(
              updatedNodes,
              nodeId,
              update.outputs
            );
          }
          if (update.error !== undefined) {
            updatedNodes = updateNodesWithExecutionError(
              updatedNodes,
              nodeId,
              update.error
            );
          }
        }
        return updatedNodes;
      });

      setEdges((eds) => {
        const executingNodeIds = entries
          .filter(([, update]) => update.state === "executing")
          .map(([nodeId]) => nodeId);

        if (executingNodeIds.length > 0) {
          const activeEdgeIds = new Set<string>();
          for (const nodeId of executingNodeIds) {
            for (const edge of getConnectedEdges(
              [{ id: nodeId } as ReactFlowNode<WorkflowNodeType>],
              eds
            )) {
              activeEdgeIds.add(edge.id);
            }
          }
          return eds.map((edge) => ({
            ...edge,
            data: {
              ...(edge.data || {}),
              isActive: activeEdgeIds.has(edge.id),
            },
          }));
        }

        const hasTerminalState = entries.some(
          ([, update]) =>
            update.state === "completed" ||
            update.state === "error" ||
            update.state === "idle"
        );
        if (hasTerminalState) {
          return eds.map((edge) => ({
            ...edge,
            data: {
              ...(edge.data || {}),
              isActive: false,
            },
          }));
        }

        return eds;
      });
    },
    [setNodes, setEdges]
  );

  const updateNodeExecution = useCallback(
    (nodeId: string, update: NodeExecutionUpdate) => {
      batchUpdateNodeExecutions({ [nodeId]: update });
    },
    [batchUpdateNodeExecutions]
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
      if (readOnlyDisabled || nodeIds.length === 0) return;

      const nodesToDelete = nodesRef.current.filter((n) => {
        if (!nodeIds.includes(n.id)) {
          return false;
        }
        if (n.data.nodeType && ALL_TRIGGER_NODE_TYPE_IDS.has(n.data.nodeType)) {
          return false;
        }
        return true;
      });
      if (nodesToDelete.length === 0) return;

      const idsToDelete = nodesToDelete.map((node) => node.id);
      const nodeEdges = getConnectedEdges(nodesToDelete, edgesRef.current);
      const edgeIdsToRemove = nodeEdges.map((edge) => edge.id);

      if (edgeIdsToRemove.length > 0) {
        setEdges((eds) =>
          eds.filter((edge) => !edgeIdsToRemove.includes(edge.id))
        );
      }

      setNodes((nds) => nds.filter((node) => !idsToDelete.includes(node.id)));
    },
    [edgesRef, nodesRef, readOnlyDisabled, setEdges, setNodes]
  );

  const deleteNode = useCallback(
    (nodeId: string) => deleteNodes([nodeId]),
    [deleteNodes]
  );

  const deleteEdge = useCallback(
    (edgeId: string) => {
      if (graphEditBlocked) return;
      setEdges((eds) => eds.filter((edge) => edge.id !== edgeId));
    },
    [graphEditBlocked, setEdges]
  );

  const deleteSelected = useCallback(() => {
    if (readOnlyDisabled) return;

    if (selectedNodes.length > 0) {
      deleteNodes(selectedNodes.map((n) => n.id));
    } else if (selectedEdges.length > 0) {
      const edgeIds = selectedEdges.map((e) => e.id);
      setEdges((eds) => eds.filter((edge) => !edgeIds.includes(edge.id)));
    }
  }, [deleteNodes, readOnlyDisabled, selectedEdges, selectedNodes, setEdges]);

  const deselectAll = useCallback(() => {
    setNodes((nds) => nds.map((node) => ({ ...node, selected: false })));
    setEdges((eds) => eds.map((edge) => ({ ...edge, selected: false })));
  }, [setNodes, setEdges]);

  const selectNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) =>
        nds.map((node) => ({
          ...node,
          selected: node.id === nodeId,
        }))
      );
      setEdges((eds) => eds.map((edge) => ({ ...edge, selected: false })));
    },
    [setNodes, setEdges]
  );

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
          nodesRef.current,
          t,
          orgId,
          generativeDefaults,
          `${nodeType.type}-${Date.now()}-${i}`
        );
      });

      if (newNodes.length > 0) {
        setNodes((nds) => [...nds, ...newNodes]);
      }
    },
    [nodeTypes, setNodes, createObjectUrl, t, orgId, generativeDefaults]
  );

  return {
    nodes,
    edges,
    selectedNodes,
    selectedEdges,
    soleSelectedNodeId,
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
    onEdgesChange: graphEditBlocked ? NOOP : onEdgesChange,
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
    batchUpdateNodeExecutions,
    updateNodeData,
    updateEdgeData: graphEditBlocked ? NOOP : updateEdgeData,
    deleteNode: readOnlyDisabled ? NOOP : deleteNode,
    deleteEdge: graphEditBlocked ? NOOP : deleteEdge,
    deleteSelected: readOnlyDisabled ? NOOP : deleteSelected,
    deselectAll,
    selectNode,
    addTriggerNodes: graphEditBlocked ? NOOP : addTriggerNodes,
    removeTriggerNodes: graphEditBlocked ? NOOP : removeTriggerNodes,
    addNodeMenu,
    closeAddNodeMenu,
    handlePaneClick: graphEditBlocked ? NOOP : handlePaneClick,
    handlePaneContextMenu: graphEditBlocked ? NOOP : handlePaneContextMenu,
    handleAddNodeMenuSelect: graphEditBlocked ? NOOP : handleAddNodeMenuSelect,
  };
}
