import type {
  Parameter,
  Edge as WorkflowBackendEdge,
  Node as WorkflowBackendNode,
  WorkflowEditorViewport,
  WorkflowExecution,
  WorkflowRuntime,
  WorkflowTrigger,
  WorkflowWithMetadata,
} from "@dafthunk/types";
import type { Edge, Node } from "@xyflow/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "@/components/auth-context";
import { useTranslation } from "@/components/locale-provider";
import { AI_TEXT_GENERATING_META_KEY } from "@/components/workflow/ai-text-node-utils";
import type {
  NodeType,
  WorkflowEdgeType,
  WorkflowNodeType,
} from "@/components/workflow/workflow-types";
import {
  connectWorkflowWS,
  WorkflowState,
  WorkflowWebSocket,
} from "@/services/workflow-session-service.ts";
import { adaptBackendNodesToReactFlowNodes } from "@/utils/utils";

import {
  isValidWorkflowEditorViewport,
  normalizeWorkflowEditorViewport,
} from "@/components/workflow/workflow-viewport-utils";

const VIEWPORT_PERSIST_DEBOUNCE_MS = 300;

interface UseEditableWorkflowProps {
  workflowId: string | undefined;
  nodeTypes?: NodeType[];
  fallbackWorkflow?: WorkflowWithMetadata | null;
  onExecutionUpdate?: (execution: WorkflowExecution) => void;
}

function persistableNodeMetadata(
  metadata: Record<string, string> | undefined
): Record<string, string> | undefined {
  if (!metadata) return undefined;
  const next = { ...metadata };
  delete next[AI_TEXT_GENERATING_META_KEY];
  return Object.keys(next).length > 0 ? next : undefined;
}

/**
 * Convert the editor's ReactFlow graph into the backend wire format.
 *
 * This is the single source of truth for what gets persisted, so the same
 * function can both build the payload to send AND fingerprint a graph for
 * change detection (see `lastSavedSerializedRef`). It deliberately omits
 * transient/UI-only fields (execution state, object-url callbacks, ids) so
 * that a server round-trip produces a byte-identical serialization.
 */
function buildWorkflowPayload(
  nodes: Node<WorkflowNodeType>[],
  edges: Edge<WorkflowEdgeType>[]
): { nodes: WorkflowBackendNode[]; edges: WorkflowBackendEdge[] } {
  const workflowNodes = nodes.map((node) => {
    const incomingEdges = edges.filter((edge) => edge.target === node.id);
    return {
      id: node.id,
      name: node.data.name,
      type: node.data.nodeType || "default",
      position: node.position,
      icon: node.data.icon,
      functionCalling: node.data.functionCalling,
      ...(() => {
        const metadata = persistableNodeMetadata(node.data.metadata);
        return metadata ? { metadata } : {};
      })(),
      inputs: node.data.inputs.map((input) => {
        const isConnected = incomingEdges.some(
          (edge) => edge.targetHandle === input.id
        );
        const { id: _id, value: inputValue, ...rest } = input;
        const parameter = {
          ...rest,
          name: input.id,
          description: input.name,
        } as Parameter & { value?: unknown };
        if (!isConnected && typeof inputValue !== "undefined") {
          parameter.value = inputValue;
        }
        return parameter as Parameter;
      }),
      outputs: node.data.outputs.map((output) => {
        const { id: _id, value: _value, ...rest } = output;
        return {
          ...rest,
          name: output.id,
          description: output.name,
        } as Parameter;
      }),
    };
  }) as WorkflowBackendNode[];

  const workflowEdges = edges.map((edge) => ({
    source: edge.source,
    target: edge.target,
    sourceOutput: edge.sourceHandle || "",
    targetInput: edge.targetHandle || "",
  })) as WorkflowBackendEdge[];

  return { nodes: workflowNodes, edges: workflowEdges };
}

export function useEditableWorkflow({
  workflowId,
  nodeTypes = [],
  fallbackWorkflow = null,
  onExecutionUpdate,
}: UseEditableWorkflowProps) {
  const [nodes, setNodes] = useState<Node<WorkflowNodeType>[]>([]);
  const [edges, setEdges] = useState<Edge<WorkflowEdgeType>[]>([]);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [savingError, setSavingError] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const wsRef = useRef<WorkflowWebSocket | null>(null);
  const [isWSConnected, setIsWSConnected] = useState(false);
  const [workflowMetadata, setWorkflowMetadata] = useState<{
    id: string;
    name: string;
    description?: string;
    schemeId: string;
    trigger: string;
    runtime?: WorkflowRuntime;
  } | null>(null);
  const [editorViewport, setEditorViewport] = useState<
    WorkflowEditorViewport | null | undefined
  >(undefined);

  const { organization } = useAuth();
  const { t } = useTranslation();

  // Canonical "latest local graph" — always reflects what the editor shows,
  // independent of the `nodes`/`edges` state (which only changes on remote
  // sync). Saving and reconnection resend read exclusively from these.
  const nodesRef = useRef<Node<WorkflowNodeType>[]>([]);
  const edgesRef = useRef<Edge<WorkflowEdgeType>[]>([]);

  // True once the first `init` has been applied. Used instead of the
  // `isInitializing` state to avoid stale closures inside the WS callbacks
  // (the connection effect runs once, so it would capture the initial value).
  const hasInitializedRef = useRef(false);

  // Fingerprint of the graph last accepted by the server (either sent by us
  // or received from it). A save is a no-op when the current graph matches
  // this, which suppresses echo-saves of remote updates and redundant resends.
  const lastSavedSerializedRef = useRef<string>("");
  const saveScheduledRef = useRef(false);
  const editorViewportRef = useRef<WorkflowEditorViewport | undefined>(
    undefined
  );
  const lastPersistedViewportRef = useRef<string>("");
  const viewportPersistTimerRef = useRef<number | null>(null);

  // Send the current local graph if it differs from what the server last had.
  // Synchronous (the underlying WS send is synchronous) so it can run from
  // `beforeunload` and unmount cleanup.
  const flushSave = useCallback(() => {
    saveScheduledRef.current = false;

    if (!hasInitializedRef.current || !workflowId) return;

    const payload = buildWorkflowPayload(nodesRef.current, edgesRef.current);
    const serialized = JSON.stringify(payload);

    // Unchanged since the last accepted state — nothing to do. This is what
    // swallows the persistence "echo" that follows applying a remote update.
    if (serialized === lastSavedSerializedRef.current) return;

    // Not connected: keep the edit pending (don't advance the fingerprint).
    // It will be resent on reconnect via onInit.
    if (!wsRef.current?.isConnected()) return;

    try {
      wsRef.current.sendStateUpdate(payload.nodes, payload.edges);
      lastSavedSerializedRef.current = serialized;
      setSavingError(null);
    } catch (error) {
      console.error("Error saving via WebSocket:", error);
    }
  }, [workflowId]);

  // Keep a stable handle so the once-only connection effect can flush on
  // cleanup without capturing a stale `flushSave`.
  const flushSaveRef = useRef(flushSave);
  flushSaveRef.current = flushSave;

  const flushViewportSave = useCallback(() => {
    const viewport = editorViewportRef.current;
    if (!viewport || !hasInitializedRef.current || !workflowId) {
      return;
    }

    const serialized = JSON.stringify(viewport);
    if (serialized === lastPersistedViewportRef.current) {
      return;
    }

    if (!wsRef.current?.isConnected()) {
      return;
    }

    wsRef.current.sendViewportUpdate(viewport);
    lastPersistedViewportRef.current = serialized;
  }, [workflowId]);

  const flushViewportSaveRef = useRef(flushViewportSave);
  flushViewportSaveRef.current = flushViewportSave;

  // Coalesce the separate node and edge change callbacks (which fire in the
  // same commit) into a single save once both refs are up to date.
  const scheduleSave = useCallback(() => {
    if (saveScheduledRef.current) return;
    saveScheduledRef.current = true;
    queueMicrotask(() => flushSaveRef.current());
  }, []);

  const fallbackWorkflowRef = useRef(fallbackWorkflow);
  fallbackWorkflowRef.current = fallbackWorkflow;

  const applyFallbackFromHttp = useCallback(() => {
    const fallback = fallbackWorkflowRef.current;
    if (hasInitializedRef.current || !fallback?.id) {
      return false;
    }

    const reactFlowNodes = adaptBackendNodesToReactFlowNodes(
      fallback.nodes ?? [],
      nodeTypes
    );
    const reactFlowEdges = (fallback.edges ?? []).map((edge) => ({
      id: `${edge.source}:${edge.sourceOutput}-${edge.target}:${edge.targetInput}`,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceOutput,
      targetHandle: edge.targetInput,
      type: "workflowEdge" as const,
      data: {
        isValid: true,
        sourceType: edge.sourceOutput,
        targetType: edge.targetInput,
      },
    }));

    setWorkflowMetadata({
      id: fallback.id,
      name: fallback.name || "",
      description: fallback.description,
      schemeId: fallback.schemeId,
      trigger: fallback.trigger || "manual",
      runtime: fallback.runtime as WorkflowRuntime | undefined,
    });
    nodesRef.current = reactFlowNodes;
    edgesRef.current = reactFlowEdges;
    lastSavedSerializedRef.current = JSON.stringify(
      buildWorkflowPayload(reactFlowNodes, reactFlowEdges)
    );
    setNodes(reactFlowNodes);
    setEdges(reactFlowEdges);
    if (isValidWorkflowEditorViewport(fallback.editorViewport)) {
      const normalized = normalizeWorkflowEditorViewport(
        fallback.editorViewport
      );
      editorViewportRef.current = normalized;
      lastPersistedViewportRef.current = JSON.stringify(normalized);
      setEditorViewport(normalized);
    } else {
      setEditorViewport(null);
    }
    hasInitializedRef.current = true;
    setIsInitializing(false);
    return true;
  }, [nodeTypes]);

  const applyFallbackFromHttpRef = useRef(applyFallbackFromHttp);
  applyFallbackFromHttpRef.current = applyFallbackFromHttp;

  // Apply HTTP workflow data as soon as it arrives (don't wait for WS timeout).
  useEffect(() => {
    if (hasInitializedRef.current || !fallbackWorkflow?.id) {
      return;
    }
    applyFallbackFromHttpRef.current();
  }, [fallbackWorkflow, nodeTypes]);

  // WebSocket connection effect
  useEffect(() => {
    if (!workflowId || !organization?.id) {
      setIsInitializing(false);
      return;
    }

    // Prevent duplicate connections if already connected
    if (wsRef.current?.isConnected()) {
      return;
    }

    setIsInitializing(true);

    // Add a small delay to avoid race conditions during React strict mode double-mount
    let cancelled = false;

    const timeoutId = setTimeout(() => {
      if (wsRef.current?.isConnected()) {
        return;
      }

      const applyRemoteState = (state: WorkflowState) => {
        if (state.id && state.trigger) {
          setWorkflowMetadata({
            id: state.id,
            name: state.name || "",
            description: state.description,
            schemeId: state.schemeId,
            trigger: state.trigger,
            runtime: state.runtime as WorkflowRuntime | undefined,
          });
        }

        const reactFlowNodes = adaptBackendNodesToReactFlowNodes(
          state.nodes,
          nodeTypes
        );
        const reactFlowEdges = state.edges.map((edge) => ({
          id: `${edge.source}:${edge.sourceOutput}-${edge.target}:${edge.targetInput}`,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceOutput,
          targetHandle: edge.targetInput,
          type: "workflowEdge",
          data: {
            isValid: true,
            sourceType: edge.sourceOutput,
            targetType: edge.targetInput,
          },
        }));

        nodesRef.current = reactFlowNodes;
        edgesRef.current = reactFlowEdges;
        lastSavedSerializedRef.current = JSON.stringify(
          buildWorkflowPayload(reactFlowNodes, reactFlowEdges)
        );

        setNodes(reactFlowNodes);
        setEdges(reactFlowEdges);

        if (isValidWorkflowEditorViewport(state.editorViewport)) {
          const normalized = normalizeWorkflowEditorViewport(
            state.editorViewport
          );
          editorViewportRef.current = normalized;
          lastPersistedViewportRef.current = JSON.stringify(normalized);
          setEditorViewport(normalized);
        } else {
          setEditorViewport(null);
        }
      };

      const handleStateUpdate = (state: WorkflowState) => {
        try {
          applyRemoteState(state);
        } catch (error) {
          console.error("Error processing WebSocket state:", error);
          wsRef.current?.disconnect();
        }
      };

      void (async () => {
        const ws = await connectWorkflowWS(organization.id, workflowId, {
          onInit: (state: WorkflowState) => {
            if (!hasInitializedRef.current) {
              handleStateUpdate(state);
              hasInitializedRef.current = true;
              setIsInitializing(false);
              return;
            }

            const localSerialized = JSON.stringify(
              buildWorkflowPayload(nodesRef.current, edgesRef.current)
            );
            if (localSerialized !== lastSavedSerializedRef.current) {
              flushSaveRef.current();
            } else {
              handleStateUpdate(state);
            }
          },
          onUpdate: (state: WorkflowState) => {
            handleStateUpdate(state);
          },
          onExecutionUpdate: (execution: WorkflowExecution) => {
            onExecutionUpdate?.(execution);
          },
          onWorkflowError: (error) => {
            if (error.message) {
              setSavingError(error.message);
            }
          },
          onConnectionOpen: () => {
            setIsWSConnected(true);
            setConnectionError(null);
          },
          onConnectionClose: (event, { willReconnect }) => {
            setIsWSConnected(false);
            setIsInitializing(false);
            if (!hasInitializedRef.current) {
              applyFallbackFromHttpRef.current();
            }
            if (
              !willReconnect &&
              !event.wasClean &&
              event.code !== 1000 &&
              event.code !== 1001
            ) {
              setConnectionError(
                `Connection closed unexpectedly (code: ${event.code})`
              );
            }
          },
          onConnectionError: (event) => {
            console.error("Connection error:", event);
            if (!hasInitializedRef.current) {
              applyFallbackFromHttpRef.current();
            }
            if (!hasInitializedRef.current) {
              setConnectionError("Connection error occurred");
            }
            setIsInitializing(false);
          },
        });

        if (cancelled) {
          ws.disconnect();
          return;
        }

        wsRef.current = ws;
      })();
    }, 100);

    const fallbackTimeoutId = setTimeout(() => {
      if (!hasInitializedRef.current) {
        applyFallbackFromHttpRef.current();
      }
    }, 2000);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      clearTimeout(fallbackTimeoutId);
      flushSaveRef.current();
      flushViewportSaveRef.current();
      if (viewportPersistTimerRef.current !== null) {
        window.clearTimeout(viewportPersistTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.disconnect();
        wsRef.current = null;
      }
    };
  }, [workflowId, organization?.id]);

  // Flush pending edits on tab close / refresh.
  // not fire this; the connection effect cleanup covers that case instead.
  useEffect(() => {
    const handleBeforeUnload = () => {
      flushSaveRef.current();
      flushViewportSaveRef.current();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const handleEditorViewportChange = useCallback(
    (viewport: WorkflowEditorViewport) => {
      const normalized = normalizeWorkflowEditorViewport(viewport);
      editorViewportRef.current = normalized;
      setEditorViewport(normalized);

      if (viewportPersistTimerRef.current !== null) {
        window.clearTimeout(viewportPersistTimerRef.current);
      }

      viewportPersistTimerRef.current = window.setTimeout(() => {
        viewportPersistTimerRef.current = null;
        flushViewportSaveRef.current();
      }, VIEWPORT_PERSIST_DEBOUNCE_MS);
    },
    []
  );

  const handleNodesChange = useCallback(
    (changedNodes: Node<WorkflowNodeType>[]) => {
      nodesRef.current = changedNodes;
      scheduleSave();
    },
    [scheduleSave]
  );

  const handleEdgesChange = useCallback(
    (changedEdges: Edge<WorkflowEdgeType>[]) => {
      edgesRef.current = changedEdges;
      scheduleSave();
    },
    [scheduleSave]
  );

  const executeWorkflow = useCallback(
    (options?: { parameters?: Record<string, unknown> }) => {
      if (!wsRef.current?.isConnected()) {
        console.warn("WebSocket is not connected, cannot execute workflow");
        return;
      }
      wsRef.current.executeWorkflow(options);
    },
    []
  );

  const updateMetadata = useCallback(
    (metadata: {
      name?: string;
      description?: string;
      trigger?: WorkflowTrigger;
      runtime?: WorkflowRuntime;
    }) => {
      if (!wsRef.current?.isConnected()) {
        console.warn("WebSocket is not connected, cannot update metadata");
        return;
      }
      wsRef.current.updateMetadata(metadata);

      // Also update local metadata state for immediate UI feedback
      setWorkflowMetadata((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          ...(metadata.name !== undefined && { name: metadata.name }),
          ...(metadata.description !== undefined && {
            description: metadata.description,
          }),
          ...(metadata.trigger !== undefined && { trigger: metadata.trigger }),
          ...(metadata.runtime !== undefined && { runtime: metadata.runtime }),
        };
      });
    },
    []
  );

  return {
    nodes,
    edges,
    isInitializing,
    savingError,
    connectionError,
    isWSConnected,
    workflowMetadata,
    editorViewport,
    handleNodesChange,
    handleEdgesChange,
    handleEditorViewportChange,
    executeWorkflow,
    updateMetadata,
  };
}
