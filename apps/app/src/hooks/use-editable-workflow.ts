import type {
  Parameter,
  Edge as WorkflowBackendEdge,
  Node as WorkflowBackendNode,
  WorkflowEditorViewport,
  WorkflowExecution,
  WorkflowGenerativeDefaults,
  WorkflowRuntime,
  WorkflowTrigger,
  WorkflowWithMetadata,
} from "@dafthunk/types";
import type { Edge, Node } from "@xyflow/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "@/components/auth-context";
import { useTranslation } from "@/components/locale-provider";
import { stripTransientGenerativeMetadata } from "@/components/workflow/generative-card-error-utils";
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
const GENERATIVE_DEFAULTS_PERSIST_DEBOUNCE_MS = 300;

interface UseEditableWorkflowProps {
  workflowId: string | undefined;
  nodeTypes?: NodeType[];
  fallbackWorkflow?: WorkflowWithMetadata | null;
  /** True after getWorkflow (or prefetch) has supplied workflow metadata for this open. */
  httpMetadataLoaded?: boolean;
  onExecutionUpdate?: (execution: WorkflowExecution) => void;
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
        const metadata = stripTransientGenerativeMetadata(node.data.metadata);
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
  httpMetadataLoaded = false,
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
  const [isEditorViewportReady, setIsEditorViewportReady] = useState(false);
  const [generativeDefaults, setGenerativeDefaults] = useState<
    WorkflowGenerativeDefaults | undefined
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
  const generativeDefaultsRef = useRef<WorkflowGenerativeDefaults | undefined>(
    undefined
  );
  const lastPersistedViewportRef = useRef<string>("");
  const lastPersistedGenerativeDefaultsRef = useRef<string>("");
  const viewportPersistTimerRef = useRef<number | null>(null);
  const generativeDefaultsPersistTimerRef = useRef<number | null>(null);

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

  const flushGenerativeDefaultsSave = useCallback(() => {
    const defaults = generativeDefaultsRef.current;
    if (!hasInitializedRef.current || !workflowId) {
      return;
    }

    const serialized = JSON.stringify(defaults ?? null);
    if (serialized === lastPersistedGenerativeDefaultsRef.current) {
      return;
    }

    if (!wsRef.current?.isConnected()) {
      return;
    }

    wsRef.current.sendGenerativeDefaultsUpdate(defaults);
    lastPersistedGenerativeDefaultsRef.current = serialized;
  }, [workflowId]);

  const flushViewportSaveRef = useRef(flushViewportSave);
  flushViewportSaveRef.current = flushViewportSave;
  const flushGenerativeDefaultsSaveRef = useRef(flushGenerativeDefaultsSave);
  flushGenerativeDefaultsSaveRef.current = flushGenerativeDefaultsSave;

  // Coalesce the separate node and edge change callbacks (which fire in the
  // same commit) into a single save once both refs are up to date.
  const scheduleSave = useCallback(() => {
    if (saveScheduledRef.current) return;
    saveScheduledRef.current = true;
    queueMicrotask(() => flushSaveRef.current());
  }, []);

  const fallbackWorkflowRef = useRef(fallbackWorkflow);
  fallbackWorkflowRef.current = fallbackWorkflow;

  const applyEditorViewportFromState = useCallback(
    (state: Pick<WorkflowState, "editorViewport">) => {
      if (!isValidWorkflowEditorViewport(state.editorViewport)) {
        return;
      }

      const normalized = normalizeWorkflowEditorViewport(state.editorViewport);
      editorViewportRef.current = normalized;
      lastPersistedViewportRef.current = JSON.stringify(normalized);
      setEditorViewport(normalized);
      setIsEditorViewportReady(true);
    },
    []
  );

  const markNoSavedEditorViewport = useCallback(() => {
    editorViewportRef.current = undefined;
    setEditorViewport(null);
    setIsEditorViewportReady(true);
  }, []);

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
      generativeDefaultsRef.current = fallback.generativeDefaults;
      lastPersistedGenerativeDefaultsRef.current = JSON.stringify(
        fallback.generativeDefaults ?? null
      );
      setGenerativeDefaults(fallback.generativeDefaults);
      hasInitializedRef.current = true;
      setIsInitializing(false);
      return true;
    },
    [nodeTypes]
  );

  const applyFallbackFromHttpRef = useRef(applyFallbackFromHttp);
  applyFallbackFromHttpRef.current = applyFallbackFromHttp;

  useEffect(() => {
    setEditorViewport(undefined);
    editorViewportRef.current = undefined;
    setIsEditorViewportReady(false);
    hasInitializedRef.current = false;
  }, [workflowId]);

  // HTTP is authoritative for saved viewport on editor open.
  useEffect(() => {
    if (!httpMetadataLoaded || !workflowId) {
      return;
    }

    if (isValidWorkflowEditorViewport(fallbackWorkflow?.editorViewport)) {
      applyEditorViewportFromState(fallbackWorkflow);
      return;
    }

    markNoSavedEditorViewport();
  }, [
    httpMetadataLoaded,
    workflowId,
    fallbackWorkflow,
    applyEditorViewportFromState,
    markNoSavedEditorViewport,
  ]);

  // Apply HTTP workflow graph when it arrives before WS init.
  useEffect(() => {
    if (hasInitializedRef.current || !fallbackWorkflow?.id || !httpMetadataLoaded) {
      return;
    }
    applyFallbackFromHttpRef.current();
  }, [fallbackWorkflow, nodeTypes, httpMetadataLoaded]);

  // WebSocket connection effect
  useEffect(() => {
    if (!workflowId || !organization?.id) {
      setIsInitializing(false);
      return;
    }

    setIsInitializing(true);

    // Prevent duplicate connections if already connected
    if (wsRef.current?.isConnected()) {
      wsRef.current.disconnect();
      wsRef.current = null;
    }

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

        applyEditorViewportFromState(state);

        generativeDefaultsRef.current = state.generativeDefaults;
        lastPersistedGenerativeDefaultsRef.current = JSON.stringify(
          state.generativeDefaults ?? null
        );
        setGenerativeDefaults(state.generativeDefaults);
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

            applyEditorViewportFromState(state);

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
      flushGenerativeDefaultsSaveRef.current();
      if (viewportPersistTimerRef.current !== null) {
        window.clearTimeout(viewportPersistTimerRef.current);
      }
      if (generativeDefaultsPersistTimerRef.current !== null) {
        window.clearTimeout(generativeDefaultsPersistTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.disconnect();
        wsRef.current = null;
      }
      hasInitializedRef.current = false;
    };
  }, [workflowId, organization?.id, applyEditorViewportFromState]);

  // Flush pending edits on tab close / refresh.
  // not fire this; the connection effect cleanup covers that case instead.
  useEffect(() => {
    const handleBeforeUnload = () => {
      flushSaveRef.current();
      flushViewportSaveRef.current();
      flushGenerativeDefaultsSaveRef.current();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const handleGenerativeDefaultsChange = useCallback(
    (defaults: WorkflowGenerativeDefaults) => {
      generativeDefaultsRef.current = defaults;
      setGenerativeDefaults(defaults);

      if (generativeDefaultsPersistTimerRef.current !== null) {
        window.clearTimeout(generativeDefaultsPersistTimerRef.current);
      }

      generativeDefaultsPersistTimerRef.current = window.setTimeout(() => {
        generativeDefaultsPersistTimerRef.current = null;
        flushGenerativeDefaultsSaveRef.current();
      }, GENERATIVE_DEFAULTS_PERSIST_DEBOUNCE_MS);
    },
    []
  );

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

  const commitEditorViewport = useCallback(
    (viewport: WorkflowEditorViewport) => {
      const normalized = normalizeWorkflowEditorViewport(viewport);
      editorViewportRef.current = normalized;
      setEditorViewport(normalized);

      if (viewportPersistTimerRef.current !== null) {
        window.clearTimeout(viewportPersistTimerRef.current);
        viewportPersistTimerRef.current = null;
      }

      flushViewportSaveRef.current();
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
    isEditorViewportReady,
    generativeDefaults,
    handleNodesChange,
    handleEdgesChange,
    handleEditorViewportChange,
    commitEditorViewport,
    handleGenerativeDefaultsChange,
    executeWorkflow,
    updateMetadata,
  };
}
