import { useCallback } from "react";

import { useCreateAiVideoSiblingNode } from "./use-video-trim-to-sibling-node";

export interface CreateSubtitleEraseSiblingNodeShellResult {
  readonly nodeId: string;
  readonly referenceLinked: boolean;
}

export function useVideoSubtitleEraseToSiblingNode(sourceNodeId: string) {
  const { createSiblingNodeShell } = useCreateAiVideoSiblingNode(sourceNodeId);

  const createSubtitleEraseSiblingNodeShell = useCallback(
    (): CreateSubtitleEraseSiblingNodeShellResult | null =>
      createSiblingNodeShell({ kind: "subtitle-erase", initialBusy: "none" }),
    [createSiblingNodeShell]
  );

  return { createSubtitleEraseSiblingNodeShell };
}
