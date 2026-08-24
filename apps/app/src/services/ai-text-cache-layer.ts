import type { WorkflowMediaValue } from "@dafthunk/types";
import { buildAiTextExcerpt, getResourceIdFromValue } from "@dafthunk/types";

import type { AiTextStagingDisplayState } from "@/components/workflow/ai-text-staging-display-state";
import { ensureAiTextCached } from "@/services/ensure-ai-text-cached";
import {
  getAiTextDisplay,
  hangAiTextDisplayFromReference,
  setAiTextDisplayState,
} from "@/services/ai-text-display-registry";
import { readAiTextContent } from "@/services/ai-text-storage-service";

export interface LoadAiTextBodyFromCacheParams {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly reference: WorkflowMediaValue;
  readonly workflowSha?: string;
}

export interface ReadyAiTextStagingResult {
  readonly state: AiTextStagingDisplayState;
  readonly excerpt: string;
  readonly body: string;
}

function mediaIdFromReference(reference: WorkflowMediaValue): string | null {
  return getResourceIdFromValue(reference);
}

function markDisplayState(
  params: LoadAiTextBodyFromCacheParams,
  state: AiTextStagingDisplayState
): void {
  const mediaId = mediaIdFromReference(params.reference);
  if (!mediaId) {
    return;
  }

  setAiTextDisplayState({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    mediaId,
    state,
  });
}

/** Hang preview excerpt from a body already in hand. Full text stays in staging. */
export function hangAiTextExcerptFromKnownText(
  params: LoadAiTextBodyFromCacheParams & { readonly body: string }
): AiTextStagingDisplayState {
  const trimmed = params.body.trim();
  const state: AiTextStagingDisplayState = trimmed ? "ready" : "empty";
  hangAiTextDisplayFromReference({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    reference: params.reference,
    body: trimmed,
  });
  return state;
}

/** Ensure IndexedDB, then read 原文. Does not hang the full body in memory. */
export async function readAiTextFullBodyFromStaging(
  params: LoadAiTextBodyFromCacheParams
): Promise<string | null> {
  await ensureAiTextCached(params);

  const body = await readAiTextContent({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    value: params.reference,
  });

  return body?.trim() ? body : null;
}

/**
 * Staging entry: pull cloud if needed, hang preview excerpt only, report display state.
 * Callers that need 原文 should use the returned body, not a second memory hang.
 */
export async function readyAiTextStaging(
  params: LoadAiTextBodyFromCacheParams
): Promise<ReadyAiTextStagingResult> {
  const mediaId = mediaIdFromReference(params.reference);
  const existing =
    mediaId
      ? getAiTextDisplay({
          organizationId: params.organizationId,
          workflowId: params.workflowId,
          mediaId,
        })
      : null;
  if (existing?.state !== "ready") {
    markDisplayState(params, "loading");
  }

  const cached = await ensureAiTextCached(params);
  const body = await readAiTextContent({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    value: params.reference,
  });
  const trimmed = body?.trim() ? body : "";

  if (trimmed) {
    hangAiTextExcerptFromKnownText({ ...params, body: trimmed });
    return {
      state: "ready",
      excerpt: buildAiTextExcerpt(trimmed),
      body: trimmed,
    };
  }

  const state: AiTextStagingDisplayState = cached ? "empty" : "failed";
  markDisplayState(params, state);
  return { state, excerpt: "", body: "" };
}

/** @deprecated Use readAiTextFullBodyFromStaging — no longer hangs display body. */
export async function loadAiTextBodyFromCache(
  params: LoadAiTextBodyFromCacheParams
): Promise<string | null> {
  return readAiTextFullBodyFromStaging(params);
}
