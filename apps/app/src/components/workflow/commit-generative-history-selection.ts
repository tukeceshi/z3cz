import type { GenerativeHistorySelectionResult } from "./apply-history-item-settings";
import type { WorkflowNodeType } from "./workflow-types";

/** Strip the selection side-channel before writing node data. */
export function commitGenerativeHistorySelection(
  result: GenerativeHistorySelectionResult
): {
  readonly patch: Partial<WorkflowNodeType>;
  readonly modelUnavailable: boolean;
} {
  const { modelUnavailable, ...patch } = result;
  return {
    patch,
    modelUnavailable: modelUnavailable ?? false,
  };
}
