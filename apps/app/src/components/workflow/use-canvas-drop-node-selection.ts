import { useStoreApi } from "@xyflow/react";
import { useCallback } from "react";

/**
 * Drop multi-select must activate React Flow's group selection rect
 * (`react-flow__nodesselection-rect`). Setting `selected: true` on nodes alone
 * does not toggle internal `nodesSelectionActive` (only pane drag-select does).
 */
export function useCanvasDropNodeSelection(
  selectNodes: (nodeIds: readonly string[]) => void
): (nodeIds: readonly string[]) => void {
  const store = useStoreApi();

  return useCallback(
    (nodeIds: readonly string[]) => {
      if (nodeIds.length === 0) {
        return;
      }

      selectNodes(nodeIds);

      if (nodeIds.length < 2) {
        store.setState({ nodesSelectionActive: false });
        return;
      }

      requestAnimationFrame(() => {
        store.setState({ nodesSelectionActive: true });
      });
    },
    [selectNodes, store]
  );
}
