import { useCallback, useEffect, useRef } from "react";

import {
  handleStudioListNodeClick,
  handleStudioListNodeDoubleClick,
  type StudioListEditorState,
  type StudioListNodeActions,
} from "./studio-list-node-interaction";
import type { StudioListNodeInteractionHandlers } from "./studio-list-node-interaction-handlers";

const STUDIO_LIST_CLICK_DELAY_MS = 250;

export function useStudioListNodeInteractionHandlers(
  listEditorState: StudioListEditorState,
  actions: StudioListNodeActions
): StudioListNodeInteractionHandlers {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listEditorStateRef = useRef(listEditorState);
  const actionsRef = useRef(actions);

  listEditorStateRef.current = listEditorState;
  actionsRef.current = actions;

  const cancelPendingListClick = useCallback(() => {
    if (timerRef.current == null) {
      return;
    }
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  useEffect(() => cancelPendingListClick, [cancelPendingListClick]);

  const onListNodeClick = useCallback(
    (nodeId: string) => {
      cancelPendingListClick();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        handleStudioListNodeClick(
          nodeId,
          listEditorStateRef.current,
          actionsRef.current
        );
      }, STUDIO_LIST_CLICK_DELAY_MS);
    },
    [cancelPendingListClick]
  );

  const onListNodeDoubleClick = useCallback(
    (nodeId: string) => {
      cancelPendingListClick();
      handleStudioListNodeDoubleClick(
        nodeId,
        listEditorStateRef.current,
        actionsRef.current
      );
    },
    [cancelPendingListClick]
  );

  return {
    onListNodeClick,
    onListNodeDoubleClick,
    cancelPendingListClick,
  };
}
