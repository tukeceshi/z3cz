import type { WorkflowPublicState } from "@dafthunk/types";

type WorkflowPublicStateListener = (state: WorkflowPublicState) => void;

const listeners = new Set<WorkflowPublicStateListener>();

export function subscribeWorkflowPublicState(
  listener: WorkflowPublicStateListener
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function publishWorkflowPublicState(state: WorkflowPublicState): void {
  for (const listener of listeners) {
    listener(state);
  }
}
