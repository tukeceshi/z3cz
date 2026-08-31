import {
  AI_VIDEO_RETAKE_DRAFT_INPUT_ID,
  createDefaultAiVideoRetakeDraft,
  isAiVideoRetakePanel,
  parseAiVideoRetakeDraft,
  readAiVideoRetakeDraftFromInputs,
  withAiVideoPanelKind,
  type AiVideoRetakeDraft,
  type VideoTrimRangeSec,
} from "@dafthunk/types";
import { useCallback, useMemo } from "react";

import { useWorkflow } from "./workflow-context";
import type { WorkflowNodeType, WorkflowParameter } from "./workflow-types";

export {
  AI_VIDEO_RETAKE_DRAFT_INPUT_ID,
  createDefaultAiVideoRetakeDraft,
  readAiVideoRetakeDraftFromInputs,
};

function upsertHiddenJsonInput(
  inputs: readonly WorkflowParameter[],
  id: string,
  value: unknown
): WorkflowParameter[] {
  if (inputs.some((input) => input.id === id)) {
    return inputs.map((input) =>
      input.id === id ? ({ ...input, value } as WorkflowParameter) : input
    );
  }
  return [
    ...inputs,
    {
      id,
      name: id,
      type: "json",
      hidden: true,
      value,
    } as WorkflowParameter,
  ];
}

export function withAiVideoRetakeDraft(
  current: WorkflowNodeType,
  patch: Partial<AiVideoRetakeDraft>
): Partial<WorkflowNodeType> {
  const draft = readAiVideoRetakeDraftFromInputs(current.inputs);
  const nextDraft: AiVideoRetakeDraft = { ...draft, ...patch };
  return {
    inputs: upsertHiddenJsonInput(
      current.inputs,
      AI_VIDEO_RETAKE_DRAFT_INPUT_ID,
      nextDraft
    ),
  };
}

export function withAiVideoRetakeDraftCommittedRange(
  current: WorkflowNodeType,
  range?: VideoTrimRangeSec
): Partial<WorkflowNodeType> {
  const draft = readAiVideoRetakeDraftFromInputs(current.inputs);
  const nextRange = range ?? draft.draftRange;
  return withAiVideoRetakeDraft(current, {
    committedRange: nextRange,
    draftRange: nextRange,
  });
}

export function withAiVideoRetakeNodeUnlocked(
  current: WorkflowNodeType
): Partial<WorkflowNodeType> {
  const inputs = current.inputs.filter(
    (input) => input.id !== AI_VIDEO_RETAKE_DRAFT_INPUT_ID
  );
  return {
    inputs,
    metadata: withAiVideoPanelKind(current.metadata, "generate"),
  };
}

export function parseAiVideoRetakeDraftValue(
  raw: unknown
): AiVideoRetakeDraft | null {
  return parseAiVideoRetakeDraft(raw);
}

export function useAiVideoRetakeDraft(
  nodeId: string,
  data: WorkflowNodeType
) {
  const { updateNodeData, disabled } = useWorkflow();
  const draft = useMemo(
    () => readAiVideoRetakeDraftFromInputs(data.inputs),
    [data.inputs]
  );
  const isRetakePanel = isAiVideoRetakePanel(data.metadata);

  const patchDraft = useCallback(
    (patch: Partial<AiVideoRetakeDraft>) => {
      if (disabled || !updateNodeData) {
        return;
      }
      updateNodeData(nodeId, (current) => withAiVideoRetakeDraft(current, patch));
    },
    [disabled, nodeId, updateNodeData]
  );

  const setDraftRange = useCallback(
    (range: VideoTrimRangeSec) => {
      patchDraft({ draftRange: range });
    },
    [patchDraft]
  );

  const commitDraftRange = useCallback(
    (range?: VideoTrimRangeSec) => {
      if (disabled || !updateNodeData) {
        return;
      }
      updateNodeData(nodeId, (current) =>
        withAiVideoRetakeDraftCommittedRange(current, range)
      );
    },
    [disabled, nodeId, updateNodeData]
  );

  const setPlaybackPaused = useCallback(
    (paused: boolean) => {
      patchDraft({ playbackPaused: paused });
    },
    [patchDraft]
  );

  return {
    draft,
    isRetakePanel,
    patchDraft,
    setDraftRange,
    commitDraftRange,
    setPlaybackPaused,
  };
}
