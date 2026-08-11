import type {
  Parameter,
  Edge as WorkflowBackendEdge,
  Node as WorkflowBackendNode,
  WorkflowEditorViewport,
  WorkflowExecution,
  WorkflowGenerativeDefaults,
  WorkflowGraphPatchBroadcast,
  WorkflowRuntime,
  WorkflowTrigger,
  WorkflowWithMetadata,
} from "@dafthunk/types";
import { applyWorkflowGraphPatch } from "@dafthunk/types";
import type { Edge, Node } from "@xyflow/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "@/components/auth-context";
import { useTranslation } from "@/components/locale-provider";
import { stripTransientGenerativeMetadata } from "@/components/workflow/generative-card-error-utils";
import { normalizeAiTextNodeDataForPersist } from "@/components/workflow/ai-text-persist-utils";
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

interface ApplyEditorViewportOptions {
  /** When true, canvas should apply this viewport (remote tab / reconnect). */
  readonly syncToCanvas?: boolean;
}

const VIEWPORT_PERSIST_DEBOUNCE_MS = 300;
const GENERATIVE_DEFAULTS_PERSIST_DEBOUNCE_MS = 300;
const GRAPH_PATCH_DEBOUNCE_MS = 150;

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
    const persistableData = normalizeAiTextNodeDataForPersist(node.data);
    return {
      id: node.id,
      name: persistableData.name,
      type: persistableData.nodeType || "default",
      position: node.position,
      icon: persistableData.icon,
      functionCalling: persistableData.functionCalling,
      ...(() => {
        const metadata = stripTransientGenerativeMetadata(persistableData.metadata);
        return metadata ? { metadata } : {};
      })(),
      inputs: persistableData.inputs.map((input) => {
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
  const [editorViewportSyncRevision, setEditorViewportSyncRevision] =
    useState(0);
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
  const lastSentGraphRef = useRef<{
    nodes: WorkflowBackendNode[];
    edges: WorkflowBackendEdge[];
  }>({ nodes: [], edges: [] });
  const saveScheduledRef = useRef(false);
  const graphPatchTimerRef = useRef<number | null>(null);
  const editorViewportRef = useRef<WorkflowEditorViewport | undefined>(
    undefined
  );
  const generativeDefaultsRef = useRef<WorkflowGenerativeDefaults | undefined>(
    undefined
  );
  const lastPersistedViewportRef = useRef<string>("");
  const lastPersistedGenerativeDefaultsRef = useRef<string>("");
  const lastRemoteTimestampRef = useRef(0);
  const viewportPersistTimerRef = useRef<number | null>(null);
  const generativeDefaultsPersistTimerRef = useRef<number | null>(null);
  const workflowMetadataRef = useRef<{
    id: string;
    name: string;
    description?: string;
    schemeId: string;
    trigger: string;
    runtime?: WorkflowRuntime;
  } | null>(null);
  const [isGraphReady, setIsGraphReady] = useState(false);

  // Send the current local graph if it differs from what the server last had.
  // Synchronous (the underlying WS send is synchronous) so it can run from
  // `beforeunload` and unmount cleanup.
  const flushSave = useCallback(() => {
    saveScheduledRef.current = false;

    if (!hasInitializedRef.current || !workflowId) return;

    const payload = buildWorkflowPayload(nodesRef.current, edgesRef.current);
    const serialized = JSON.stringify(payload);

    if (serialized === lastSavedSerializedRef.current) return;

    if (!wsRef.current?.isConnected()) return;

    try {
      const sent = wsRef.current.sendGraphPatch(lastSentGraphRef.current, payload);
      if (sent) {
        lastSentGraphRef.current = payload;
        lastSavedSerializedRef.current = serialized;
        lastRemoteTimestampRef.current = Date.now();
        setSavingError(null);
      }
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

  const scheduleSave = useCallback(() => {
    if (saveScheduledRef.current) return;
    saveScheduledRef.current = true;

    if (graphPatchTimerRef.current !== null) {
      window.clearTimeout(graphPatchTimerRef.current);
    }

    graphPatchTimerRef.current = window.setTimeout(() => {
      graphPatchTimerRef.current = null;
      flushSaveRef.current();
    }, GRAPH_PATCH_DEBOUNCE_MS);
  }, []);

  const fallbackWorkflowRef = useRef(fallbackWorkflow);
  fallbackWorkflowRef.current = fallbackWorkflow;

  const applyBackendGraphToEditor = useCallback(
    (
      backendNodes: WorkflowBackendNode[],
      backendEdges: WorkflowBackendEdge[],
      timestamp: number
    ) => {
      const reactFlowNodes = adaptBackendNodesToReactFlowNodes(
        backendNodes,
        nodeTypes
      );
      const reactFlowEdges = backendEdges.map((edge) => ({
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

      nodesRef.current = reactFlowNodes;
      edgesRef.current = reactFlowEdges;
      const payload = buildWorkflowPayload(reactFlowNodes, reactFlowEdges);
      lastSavedSerializedRef.current = JSON.stringify(payload);
      lastSentGraphRef.current = payload;
      lastRemoteTimestampRef.current = timestamp;
      setNodes(reactFlowNodes);
      setEdges(reactFlowEdges);
    },
    [nodeTypes]
  );

  const applyBackendGraphToEditorRef = useRef(applyBackendGraphToEditor);
  applyBackendGraphToEditorRef.current = applyBackendGraphToEditor;

  const applyEditorViewportFromState = useCallback(
    (
      state: Pick<WorkflowState, "editorViewport">,
      options?: ApplyEditorViewportOptions
    ) => {
      if (!isValidWorkflowEditorViewport(state.editorViewport)) {
        return;
      }

      const normalized = normalizeWorkflowEditorViewport(state.editorViewport);
      const serialized = JSON.stringify(normalized);
      const localSerialized = JSON.stringify(editorViewportRef.current ?? null);
      const localHasUnpersistedViewport =
        localSerialized !== lastPersistedViewportRef.current;

      if (options?.syncToCanvas && localHasUnpersistedViewport) {
        return;
      }

      const viewportChanged = serialized !== localSerialized;

      editorViewportRef.current = normalized;
      lastPersistedViewportRef.current = serialized;
      setEditorViewport(normalized);
      setIsEditorViewportReady(true);

      if (options?.syncToCanvas && viewportChanged) {
        setEditorViewportSyncRevision((revision) => revision + 1);
      }
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
      workflowMetadataRef.current = {
        id: fallback.id,
        name: fallback.name || "",
        description: fallback.description,
        schemeId: fallback.schemeId,
        trigger: fallback.trigger || "manual",
        runtime: fallback.runtime as WorkflowRuntime | undefined,
      };
      nodesRef.current = reactFlowNodes;
      edgesRef.current = reactFlowEdges;
      const payload = buildWorkflowPayload(reactFlowNodes, reactFlowEdges);
      lastSavedSerializedRef.current = JSON.stringify(payload);
      lastSentGraphRef.current = payload;
      setNodes(reactFlowNodes);
      setEdges(reactFlowEdges);
      generativeDefaultsRef.current = fallback.generativeDefaults;
      lastPersistedGenerativeDefaultsRef.current = JSON.stringify(
        fallback.generativeDefaults ?? null
      );
      setGenerativeDefaults(fallback.generativeDefaults);
      lastRemoteTimestampRef.current =
        fallback.updatedAt instanceof Date
          ? fallback.updatedAt.getTime()
          : new Date(fallback.updatedAt).getTime();
      hasInitializedRef.current = true;
      setIsGraphReady(true);
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
    setEditorViewportSyncRevision(0);
    setIsEditorViewportReady(false);
    hasInitializedRef.current = false;
    setIsGraphReady(false);
    lastRemoteTimestampRef.current = 0;
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

      const applyRemoteState = (
        state: WorkflowState,
        options?: ApplyEditorViewportOptions
      ) => {
        if (state.id && state.trigger) {
          const metadata = {
            id: state.id,
            name: state.name || "",
            description: state.description,
            schemeId: state.schemeId,
            trigger: state.trigger,
            runtime: state.runtime as WorkflowRuntime | undefined,
          };
          setWorkflowMetadata(metadata);
          workflowMetadataRef.current = metadata;
        }

        applyBackendGraphToEditorRef.current(
          state.nodes,
          state.edges,
          state.timestamp ?? Date.now()
        );

        applyEditorViewportFromState(state, options);

        generativeDefaultsRef.current = state.generativeDefaults;
        lastPersistedGenerativeDefaultsRef.current = JSON.stringify(
          state.generativeDefaults ?? null
        );
        setGenerativeDefaults(state.generativeDefaults);
      };

      const isLocalGraphDirty = (): boolean => {
        const serialized = JSON.stringify(
          buildWorkflowPayload(nodesRef.current, edgesRef.current)
        );
        return serialized !== lastSavedSerializedRef.current;
      };

      const handleStateUpdate = (
        state: WorkflowState,
        options?: ApplyEditorViewportOptions
      ) => {
        try {
          applyRemoteState(state, options);
        } catch (error) {
          console.error("Error processing WebSocket state:", error);
          wsRef.current?.disconnect();
        }
      };

      void (async () => {
        const ws = await connectWorkflowWS(organization.id, workflowId, {
          onInit: (state: WorkflowState) => {
            if (!hasInitializedRef.current) {
              handleStateUpdate(state, { syncToCanvas: true });
              hasInitializedRef.current = true;
              setIsGraphReady(true);
              setIsInitializing(false);
              return;
            }

            applyEditorViewportFromState(state, { syncToCanvas: true });

            if (isLocalGraphDirty()) {
              flushSaveRef.current();
              return;
            }

            if (
              state.timestamp != null &&
              state.timestamp > lastRemoteTimestampRef.current
            ) {
              handleStateUpdate(state, { syncToCanvas: true });
            }
          },
          onUpdate: (state: WorkflowState) => {
            if (
              state.timestamp == null ||
              state.timestamp <= lastRemoteTimestampRef.current
            ) {
              return;
            }
            if (isLocalGraphDirty()) {
              return;
            }
            handleStateUpdate(state, { syncToCanvas: true });
          },
          onPatchGraph: (patch: WorkflowGraphPatchBroadcast) => {
            if (
              patch.timestamp == null ||
              patch.timestamp <= lastRemoteTimestampRef.current
            ) {
              return;
            }
            if (isLocalGraphDirty()) {
              return;
            }

            const meta = workflowMetadataRef.current;
            if (!meta) {
              return;
            }

            try {
              const patched = applyWorkflowGraphPatch(
                {
                  id: meta.id,
                  name: meta.name,
                  schemeId: meta.schemeId,
                  trigger: meta.trigger as WorkflowTrigger,
                  nodes: lastSentGraphRef.current.nodes,
                  edges: lastSentGraphRef.current.edges,
                  timestamp: patch.timestamp,
                },
                patch
              );
              applyRemoteState(
                {
                  ...patched,
                  description: meta.description,
                  runtime: meta.runtime,
                  editorViewport: editorViewportRef.current,
                  generativeDefaults: generativeDefaultsRef.current,
                },
                { syncToCanvas: true }
              );
            } catch (error) {
              console.error("Error applying remote graph patch:", error);
            }
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
      if (graphPatchTimerRef.current !== null) {
        window.clearTimeout(graphPatchTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.disconnect();
        wsRef.current = null;
      }
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

  const persistEditorViewportRef = useCallback(
    (viewport: WorkflowEditorViewport) => {
      const normalized = normalizeWorkflowEditorViewport(viewport);
      editorViewportRef.current = normalized;

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

  const handleEditorViewportChange = useCallback(
    (viewport: WorkflowEditorViewport) => {
      persistEditorViewportRef(viewport);
    },
    [persistEditorViewportRef]
  );

  const handleEditorViewportGestureEnd = useCallback(
    (viewport: WorkflowEditorViewport) => {
      const normalized = normalizeWorkflowEditorViewport(viewport);
      editorViewportRef.current = normalized;

      if (viewportPersistTimerRef.current !== null) {
        window.clearTimeout(viewportPersistTimerRef.current);
        viewportPersistTimerRef.current = null;
      }

      flushViewportSaveRef.current();
    },
    []
  );

  const commitEditorViewport = useCallback(
    (viewport: WorkflowEditorViewport) => {
      const normalized = normalizeWorkflowEditorViewport(viewport);
      editorViewportRef.current = normalized;

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
        const next = {
          ...prev,
          ...(metadata.name !== undefined && { name: metadata.name }),
          ...(metadata.description !== undefined && {
            description: metadata.description,
          }),
          ...(metadata.trigger !== undefined && { trigger: metadata.trigger }),
          ...(metadata.runtime !== undefined && { runtime: metadata.runtime }),
        };
        workflowMetadataRef.current = next;
        return next;
      });
    },
    []
  );

  return {
    nodes,
    edges,
    isInitializing,
    isGraphReady,
    savingError,
    connectionError,
    isWSConnected,
    workflowMetadata,
    editorViewport,
    editorViewportSyncRevision,
    isEditorViewportReady,
    generativeDefaults,
    handleNodesChange,
    handleEdgesChange,
    handleEditorViewportChange,
    handleEditorViewportGestureEnd,
    commitEditorViewport,
    handleGenerativeDefaultsChange,
    executeWorkflow,
    updateMetadata,
  };
}
