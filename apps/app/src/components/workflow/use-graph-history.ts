import type { Edge, Node } from "@xyflow/react";
import { useCallback, useRef, useState } from "react";

import type { ObjectReference } from "@dafthunk/types";

import {
  readSkipDetachWithRecordsConfirm,
} from "@/components/workflow/detach-confirm-preference";
import {
  filterNodesWithCanvasRecords,
} from "@/components/workflow/node-has-canvas-records";
import {
  canvasJsonEquals,
  captureCanvasJson,
  computeRemovedNodeIds,
  restoreCanvasJson,
  type WorkflowCanvasJson,
} from "@/components/workflow/workflow-history-snapshot";
import type {
  NodeType,
  WorkflowEdgeType,
  WorkflowNodeType,
} from "@/components/workflow/workflow-types";

export const WORKFLOW_GRAPH_HISTORY_MAX_SIZE = 100 as const;

export type DetachConfirmSource = "delete" | "undo" | "redo";

export interface PendingDetachConfirm {
  readonly nodeIds: readonly string[];
  readonly source: DetachConfirmSource;
  readonly proceed: () => void;
}

export interface UseGraphHistoryProps {
  readonly disabled: boolean;
  readonly nodeTypes: readonly NodeType[];
  readonly createObjectUrl: (objectReference: ObjectReference) => string;
  readonly nodesRef: React.RefObject<Node<WorkflowNodeType>[]>;
  readonly edgesRef: React.RefObject<Edge<WorkflowEdgeType>[]>;
  readonly setNodes: React.Dispatch<
    React.SetStateAction<Node<WorkflowNodeType>[]>
  >;
  readonly setEdges: React.Dispatch<
    React.SetStateAction<Edge<WorkflowEdgeType>[]>
  >;
  readonly requestDetachConfirm: (
    pending: PendingDetachConfirm
  ) => void;
}

export interface UseGraphHistoryReturn {
  readonly captureHistory: () => void;
  readonly captureDragStartSnapshot: () => void;
  readonly commitDragStopIfChanged: () => void;
  readonly undo: () => void;
  readonly redo: () => void;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly clearHistory: () => void;
  readonly isRestoringRef: React.RefObject<boolean>;
  readonly commitRemoveNodes: (nodeIds: readonly string[]) => void;
}

function trimPast(past: WorkflowCanvasJson[]): WorkflowCanvasJson[] {
  if (past.length <= WORKFLOW_GRAPH_HISTORY_MAX_SIZE) {
    return past;
  }
  return past.slice(past.length - WORKFLOW_GRAPH_HISTORY_MAX_SIZE);
}

export function useGraphHistory({
  disabled,
  nodeTypes,
  createObjectUrl,
  nodesRef,
  edgesRef,
  setNodes,
  setEdges,
  requestDetachConfirm,
}: UseGraphHistoryProps): UseGraphHistoryReturn {
  const pastRef = useRef<WorkflowCanvasJson[]>([]);
  const futureRef = useRef<WorkflowCanvasJson[]>([]);
  const dragSnapshotRef = useRef<WorkflowCanvasJson | null>(null);
  const isRestoringRef = useRef(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const syncFlags = useCallback(() => {
    setCanUndo(pastRef.current.length > 0);
    setCanRedo(futureRef.current.length > 0);
  }, []);

  const pushPast = useCallback(
    (snapshot: WorkflowCanvasJson) => {
      const past = pastRef.current;
      const last = past[past.length - 1];
      if (last && canvasJsonEquals(last, snapshot)) {
        return;
      }
      pastRef.current = trimPast([...past, snapshot]);
      futureRef.current = [];
      syncFlags();
    },
    [syncFlags]
  );

  const applySnapshot = useCallback(
    (snapshot: WorkflowCanvasJson) => {
      isRestoringRef.current = true;
      const restored = restoreCanvasJson({
        snapshot,
        currentNodes: nodesRef.current,
        nodeTypes,
        createObjectUrl,
      });
      setNodes(restored.nodes);
      setEdges(restored.edges);
      nodesRef.current = restored.nodes;
      edgesRef.current = restored.edges;
      queueMicrotask(() => {
        isRestoringRef.current = false;
      });
    },
    [createObjectUrl, edgesRef, nodeTypes, nodesRef, setEdges, setNodes]
  );

  const maybeConfirmRemoval = useCallback(
    (
      removedNodeIds: readonly string[],
      source: DetachConfirmSource,
      proceed: () => void
    ) => {
      if (removedNodeIds.length === 0) {
        proceed();
        return;
      }

      const nodesWithRecords = filterNodesWithCanvasRecords(
        nodesRef.current,
        removedNodeIds
      );
      if (nodesWithRecords.length === 0 || readSkipDetachWithRecordsConfirm()) {
        proceed();
        return;
      }

      requestDetachConfirm({
        nodeIds: nodesWithRecords.map((node) => node.id),
        source,
        proceed,
      });
    },
    [nodesRef, requestDetachConfirm]
  );

  const captureHistory = useCallback(() => {
    if (disabled || isRestoringRef.current) {
      return;
    }
    pushPast(captureCanvasJson(nodesRef.current, edgesRef.current));
  }, [disabled, edgesRef, nodesRef, pushPast]);

  const captureDragStartSnapshot = useCallback(() => {
    if (disabled || isRestoringRef.current) {
      dragSnapshotRef.current = null;
      return;
    }
    dragSnapshotRef.current = captureCanvasJson(
      nodesRef.current,
      edgesRef.current
    );
  }, [disabled, edgesRef, nodesRef]);

  const commitDragStopIfChanged = useCallback(() => {
    const before = dragSnapshotRef.current;
    dragSnapshotRef.current = null;
    if (disabled || isRestoringRef.current || !before) {
      return;
    }
    const after = captureCanvasJson(nodesRef.current, edgesRef.current);
    if (canvasJsonEquals(before, after)) {
      return;
    }
    pushPast(before);
  }, [disabled, edgesRef, nodesRef, pushPast]);

  const undo = useCallback(() => {
    if (disabled || pastRef.current.length === 0) {
      return;
    }

    const target = pastRef.current[pastRef.current.length - 1];
    const current = captureCanvasJson(nodesRef.current, edgesRef.current);
    const removedNodeIds = computeRemovedNodeIds(nodesRef.current, target);

    maybeConfirmRemoval(removedNodeIds, "undo", () => {
      pastRef.current = pastRef.current.slice(0, -1);
      futureRef.current = [...futureRef.current, current];
      applySnapshot(target);
      syncFlags();
    });
  }, [
    applySnapshot,
    disabled,
    edgesRef,
    maybeConfirmRemoval,
    nodesRef,
    syncFlags,
  ]);

  const redo = useCallback(() => {
    if (disabled || futureRef.current.length === 0) {
      return;
    }

    const target = futureRef.current[futureRef.current.length - 1];
    const current = captureCanvasJson(nodesRef.current, edgesRef.current);
    const removedNodeIds = computeRemovedNodeIds(nodesRef.current, target);

    maybeConfirmRemoval(removedNodeIds, "redo", () => {
      futureRef.current = futureRef.current.slice(0, -1);
      pastRef.current = trimPast([...pastRef.current, current]);
      applySnapshot(target);
      syncFlags();
    });
  }, [
    applySnapshot,
    disabled,
    edgesRef,
    maybeConfirmRemoval,
    nodesRef,
    syncFlags,
  ]);

  const clearHistory = useCallback(() => {
    pastRef.current = [];
    futureRef.current = [];
    dragSnapshotRef.current = null;
    syncFlags();
  }, [syncFlags]);

  const commitRemoveNodes = useCallback(
    (nodeIds: readonly string[]) => {
      if (disabled || nodeIds.length === 0) {
        return;
      }

      const proceed = () => {
        captureHistory();
        const idSet = new Set(nodeIds);
        setEdges((edges) =>
          edges.filter(
            (edge) => !idSet.has(edge.source) && !idSet.has(edge.target)
          )
        );
        setNodes((nodes) => nodes.filter((node) => !idSet.has(node.id)));
      };

      const nodesWithRecords = filterNodesWithCanvasRecords(
        nodesRef.current,
        nodeIds
      );
      if (
        nodesWithRecords.length === 0 ||
        readSkipDetachWithRecordsConfirm()
      ) {
        proceed();
        return;
      }

      requestDetachConfirm({
        nodeIds: nodesWithRecords.map((node) => node.id),
        source: "delete",
        proceed,
      });
    },
    [
      captureHistory,
      disabled,
      nodesRef,
      requestDetachConfirm,
      setEdges,
      setNodes,
    ]
  );

  return {
    captureHistory,
    captureDragStartSnapshot,
    commitDragStopIfChanged,
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory,
    isRestoringRef,
    commitRemoveNodes,
  };
}
