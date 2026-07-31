import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
  readonly viewMode: WorkflowEditorViewMode;
  readonly studioNodeId: string | null;
  readonly detailNodeId: string | null;
  readonly setViewMode: (mode: WorkflowEditorViewMode) => void;
  readonly openStudio: (nodeId: string) => void;
  readonly showStudio: (nodeId?: string | null) => void;
  readonly openDetail: (nodeId: string) => void;
  readonly closeDetail: () => void;
  readonly selectStudioNode: (nodeId: string | null) => void;
  readonly expandStudioList: () => void;
  readonly returnToCanvas: () => void;
  readonly returnToCanvasFromDetail: () => void;
}

const CreativeStudioContext = createContext<CreativeStudioContextValue | null>(
  null
);

export interface CreativeStudioProviderProps {
  readonly workflowId: string;
  readonly children: ReactNode;
  readonly onReturnToCanvas?: (nodeId: string | null) => void;
  readonly onReturnToCanvasFromDetail?: (nodeId: string | null) => void;
}

export function CreativeStudioProvider({
  workflowId,
  children,
  onReturnToCanvas,
  onReturnToCanvasFromDetail,
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

  useEffect(() => {
    const persisted = readCreativeStudioPersistedState(workflowId);
    setViewMode(persisted.viewMode);
    setStudioNodeId(
      persisted.viewMode === "studio" ? persisted.nodeId : null
    );
    setDetailNodeId(
      persisted.viewMode === "studio" ? persisted.detailNodeId : null
    );
  }, [workflowId]);

  useEffect(() => {
    writeCreativeStudioPersistedState(workflowId, {
      viewMode,
      nodeId: viewMode === "studio" ? studioNodeId : null,
      detailNodeId: viewMode === "studio" ? detailNodeId : null,
    });
  }, [workflowId, viewMode, studioNodeId, detailNodeId]);

  const openStudio = useCallback((nodeId: string) => {
    setStudioNodeId(nodeId);
    setDetailNodeId(null);
    setViewMode("studio");
  }, []);

  const showStudio = useCallback((nodeId?: string | null) => {
    if (nodeId) {
      setStudioNodeId(nodeId);
    }
    setDetailNodeId(null);
    setViewMode("studio");
  }, []);

  const openDetail = useCallback((nodeId: string) => {
    setStudioNodeId(nodeId);
    setDetailNodeId(nodeId);
    setViewMode("studio");
  }, []);

  const closeDetail = useCallback(() => {
    setDetailNodeId(null);
  }, []);

  const selectStudioNode = useCallback((nodeId: string | null) => {
    setStudioNodeId(nodeId);
  }, []);

  const expandStudioList = useCallback(() => {
    setDetailNodeId(null);
    setStudioNodeId(null);
  }, []);

  const returnToCanvas = useCallback(() => {
    const nodeId = studioNodeId;
    setDetailNodeId(null);
    setViewMode("canvas");
    onReturnToCanvas?.(nodeId);
  }, [onReturnToCanvas, studioNodeId]);

  const returnToCanvasFromDetail = useCallback(() => {
    const nodeId = detailNodeId ?? studioNodeId;
    setDetailNodeId(null);
    setViewMode("canvas");
    onReturnToCanvasFromDetail?.(nodeId);
  }, [detailNodeId, onReturnToCanvasFromDetail, studioNodeId]);

  const value = useMemo(
    () => ({
      viewMode,
      studioNodeId,
      detailNodeId,
      setViewMode,
      openStudio,
      showStudio,
      openDetail,
      closeDetail,
      selectStudioNode,
      expandStudioList,
      returnToCanvas,
      returnToCanvasFromDetail,
    }),
    [
      viewMode,
      studioNodeId,
      detailNodeId,
      openStudio,
      showStudio,
      openDetail,
      closeDetail,
      selectStudioNode,
      expandStudioList,
      returnToCanvas,
      returnToCanvasFromDetail,
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
