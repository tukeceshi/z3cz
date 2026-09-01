import type { WorkflowPublicState } from "@dafthunk/types";
import { workflowPublicStateFromSiteSettings } from "@dafthunk/types";

import type { Bindings } from "../context";
import { createDatabase, getPublicSiteSettings } from "../db";

let cachedPublicState: WorkflowPublicState | null = null;

export function getCachedWorkflowPublicState(): WorkflowPublicState | null {
  return cachedPublicState;
}

export function setWorkflowPublicState(state: WorkflowPublicState): void {
  cachedPublicState = state;
}

export async function loadWorkflowPublicState(
  env: Bindings
): Promise<WorkflowPublicState> {
  if (cachedPublicState) {
    return cachedPublicState;
  }

  const db = createDatabase(env);
  const settings = await getPublicSiteSettings(db);
  const state = workflowPublicStateFromSiteSettings(settings);
  cachedPublicState = state;
  return state;
}

export function clearWorkflowPublicStateCache(): void {
  cachedPublicState = null;
}
