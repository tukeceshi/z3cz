import type { AiGenerativeNodeType } from "@dafthunk/types";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  readCreativeStudioPersistedState,
  writeCreativeStudioPersistedState,
  type WorkflowEditorViewMode,
} from "./creative-studio-persisted-state";

export type { WorkflowEditorViewMode };

interface CreativeStudioContextValue {
  readonly workflowId: string;
  readonly viewMode: WorkflowEditorViewMode;
  readonly studioNodeId: string | null;
  readonly detailNodeId: string | null;
  readonly detailPaneOpen: boolean;
  readonly secondaryNodeId: string | null;
  readonly secondaryPaneOpen: boolean;
  readonly setViewMode: (mode: WorkflowEditorViewMode) => void;
  readonly openStudio: (nodeId: string) => void;
  readonly showStudio: (nodeId?: string | null) => void;
  readonly openDetail: (nodeId: string) => void;
  readonly openSecondaryDetail: (nodeId: string) => void;
  readonly closeSecondaryDetail: () => void;
  readonly replacePrimaryFromList: (nodeId: string) => void;
  readonly clearDetailNode: () => void;
  readonly selectStudioNode: (nodeId: string | null) => void;
  readonly expandStudioList: () => void;
  readonly returnToCanvas: () => void;
  readonly returnToCanvasFromDetail: () => void;
  readonly addGenerativeNode?: (
    nodeType: AiGenerativeNodeType,
    options?: {
      readonly prompt?: string;
      readonly precedingText?: string;
    }
  ) => string | null;
  readonly requestDeleteStudioNode?: (nodeId: string) => void;
  readonly isPendingStudioNode: (nodeId: string) => boolean;
  readonly resolvePendingStudioNode: (nodeId: string) => void;
}

const CreativeStudioContext = createContext<CreativeStudioContextValue | null>(
  null
);

export interface CreativeStudioProviderProps {
  readonly workflowId: string;
  readonly children: ReactNode;
  readonly onReturnToCanvas?: (nodeId: string | null) => void;
  readonly onReturnToCanvasFromDetail?: (nodeId: string | null) => void;
  readonly onAddGenerativeNode?: (
    nodeType: AiGenerativeNodeType,
    options?: {
      readonly prompt?: string;
      readonly precedingText?: string;
    }
  ) => string | null;
  readonly onRequestDeleteStudioNode?: (nodeId: string) => void;
}

export function CreativeStudioProvider({
  workflowId,
  children,
  onReturnToCanvas,
  onReturnToCanvasFromDetail,
  onAddGenerativeNode,
  onRequestDeleteStudioNode,
}: CreativeStudioProviderProps) {
  const [viewMode, setViewMode] = useState<WorkflowEditorViewMode>(() => {
    return readCreativeStudioPersistedState(workflowId).viewMode;
  });
  const [studioNodeId, setStudioNodeId] = useState<string | null>(() => {
    const persisted = readCreativeStudioPersistedState(workflowId);
    return persisted.viewMode === "studio" ? persisted.nodeId : null;
  });
  const [detailNodeId, setDetailNodeId] = useState<string | null>(() => {
    const persisted = readCreativeStudioPersistedState(workflowId);
    return persisted.viewMode === "studio" ? persisted.detailNodeId : null;
  });
  const [detailPaneOpen, setDetailPaneOpen] = useState(() => {
    const persisted = readCreativeStudioPersistedState(workflowId);
    return persisted.viewMode === "studio" ? persisted.detailPaneOpen : false;
  });
  const [secondaryNodeId, setSecondaryNodeId] = useState<string | null>(null);
  /** Guards cleanup until a newly added node appears in the graph. */
  const pendingStudioNodeIdRef = useRef<string | null>(null);

  const isPendingStudioNode = useCallback((nodeId: string) => {
    return pendingStudioNodeIdRef.current === nodeId;
  }, []);

  const resolvePendingStudioNode = useCallback((nodeId: string) => {
    if (pendingStudioNodeIdRef.current === nodeId) {
      pendingStudioNodeIdRef.current = null;
    }
  }, []);

  useEffect(() => {
    const persisted = readCreativeStudioPersistedState(workflowId);
    setViewMode(persisted.viewMode);
    setStudioNodeId(
      persisted.viewMode === "studio" ? persisted.nodeId : null
    );
    setDetailNodeId(
      persisted.viewMode === "studio" ? persisted.detailNodeId : null
    );
    setDetailPaneOpen(
      persisted.viewMode === "studio" ? persisted.detailPaneOpen : false
    );
    setSecondaryNodeId(null);
  }, [workflowId]);

  useEffect(() => {
    writeCreativeStudioPersistedState(workflowId, {
      viewMode,
      nodeId: viewMode === "studio" ? studioNodeId : null,
      detailNodeId: viewMode === "studio" ? detailNodeId : null,
      detailPaneOpen: viewMode === "studio" ? detailPaneOpen : false,
    });
  }, [workflowId, viewMode, studioNodeId, detailNodeId, detailPaneOpen]);

  const openStudio = useCallback((nodeId: string) => {
    setStudioNodeId(nodeId);
    setDetailNodeId(null);
    setDetailPaneOpen(false);
    setSecondaryNodeId(null);
    setViewMode("studio");
  }, []);

  const showStudio = useCallback((nodeId?: string | null) => {
    if (nodeId) {
      setStudioNodeId(nodeId);
    }
    setDetailNodeId(null);
    setDetailPaneOpen(false);
    setSecondaryNodeId(null);
    setViewMode("studio");
  }, []);

  const openDetail = useCallback((nodeId: string) => {
    setStudioNodeId(nodeId);
    setDetailNodeId(nodeId);
    setDetailPaneOpen(true);
    setSecondaryNodeId((current) => (current === nodeId ? null : current));
    setViewMode("studio");
  }, []);

  const openSecondaryDetail = useCallback(
    (nodeId: string) => {
      if (!detailPaneOpen || !detailNodeId) {
        openDetail(nodeId);
        return;
      }
      if (nodeId === detailNodeId) {
        return;
      }
      setSecondaryNodeId(nodeId);
      setViewMode("studio");
    },
    [detailNodeId, detailPaneOpen, openDetail]
  );

  const closeSecondaryDetail = useCallback(() => {
    setSecondaryNodeId(null);
  }, []);

  const replacePrimaryFromList = useCallback(
    (nodeId: string) => {
      setSecondaryNodeId(null);
      openDetail(nodeId);
    },
    [openDetail]
  );

  const clearDetailNode = useCallback(() => {
    setDetailNodeId(null);
    setStudioNodeId(null);
    setSecondaryNodeId(null);
  }, []);

  const selectStudioNode = useCallback((nodeId: string | null) => {
    setStudioNodeId(nodeId);
  }, []);

  const expandStudioList = useCallback(() => {
    setDetailPaneOpen(false);
    setDetailNodeId(null);
    setStudioNodeId(null);
    setSecondaryNodeId(null);
  }, []);

  const returnToCanvas = useCallback(() => {
    const nodeId = studioNodeId;
    setDetailPaneOpen(false);
    setDetailNodeId(null);
    setSecondaryNodeId(null);
    setViewMode("canvas");
    onReturnToCanvas?.(nodeId);
  }, [onReturnToCanvas, studioNodeId]);

  const returnToCanvasFromDetail = useCallback(() => {
    const nodeId = detailNodeId ?? studioNodeId;
    setDetailPaneOpen(false);
    setDetailNodeId(null);
    setSecondaryNodeId(null);
    setViewMode("canvas");
    onReturnToCanvasFromDetail?.(nodeId);
  }, [detailNodeId, onReturnToCanvasFromDetail, studioNodeId]);

  const addGenerativeNode = useCallback(
    (
      nodeType: AiGenerativeNodeType,
      options?: {
        readonly prompt?: string;
        readonly precedingText?: string;
      }
    ): string | null => {
      const newNodeId = onAddGenerativeNode?.(nodeType, options) ?? null;
      if (newNodeId) {
        pendingStudioNodeIdRef.current = newNodeId;
        openDetail(newNodeId);
      }
      return newNodeId;
    },
    [onAddGenerativeNode, openDetail]
  );

  const secondaryPaneOpen = secondaryNodeId != null;

  const value = useMemo(
    () => ({
      workflowId,
      viewMode,
      studioNodeId,
      detailNodeId,
      detailPaneOpen,
      secondaryNodeId,
      secondaryPaneOpen,
      setViewMode,
      openStudio,
      showStudio,
      openDetail,
      openSecondaryDetail,
      closeSecondaryDetail,
      replacePrimaryFromList,
      clearDetailNode,
      selectStudioNode,
      expandStudioList,
      returnToCanvas,
      returnToCanvasFromDetail,
      addGenerativeNode: onAddGenerativeNode ? addGenerativeNode : undefined,
      requestDeleteStudioNode: onRequestDeleteStudioNode,
      isPendingStudioNode,
      resolvePendingStudioNode,
    }),
    [
      workflowId,
      viewMode,
      studioNodeId,
      detailNodeId,
      detailPaneOpen,
      secondaryNodeId,
      secondaryPaneOpen,
      openStudio,
      showStudio,
      openDetail,
      openSecondaryDetail,
      closeSecondaryDetail,
      replacePrimaryFromList,
      clearDetailNode,
      selectStudioNode,
      expandStudioList,
      returnToCanvas,
      returnToCanvasFromDetail,
      onAddGenerativeNode,
      addGenerativeNode,
      onRequestDeleteStudioNode,
      isPendingStudioNode,
      resolvePendingStudioNode,
    ]
  );

  return (
    <CreativeStudioContext.Provider value={value}>
      {children}
    </CreativeStudioContext.Provider>
  );
}

export function useCreativeStudio(): CreativeStudioContextValue {
  const context = useContext(CreativeStudioContext);
  if (!context) {
    throw new Error(
      "useCreativeStudio must be used within CreativeStudioProvider"
    );
  }
  return context;
}

export function useCreativeStudioOptional():
  | CreativeStudioContextValue
  | null {
  return useContext(CreativeStudioContext);
}

export function useOpenCreativeStudio(nodeId: string): () => void {
  const studio = useCreativeStudioOptional();
  return useCallback(() => {
    studio?.openDetail(nodeId);
  }, [nodeId, studio]);
}
