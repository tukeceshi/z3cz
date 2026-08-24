import { buildAiTextExcerpt, getResourceIdFromValue } from "@dafthunk/types";
import type { WorkflowMediaValue } from "@dafthunk/types";

import type { AiTextStagingDisplayState } from "@/components/workflow/ai-text-staging-display-state";

export const AI_TEXT_DISPLAY_EVENT = "dafthunk:ai-text-display-changed";

export interface AiTextDisplay {
  readonly excerpt: string;
  readonly state: AiTextStagingDisplayState;
}

const hungDisplays = new Map<string, AiTextDisplay>();

function displayKey(
  organizationId: string,
  workflowId: string,
  mediaId: string
): string {
  return `${organizationId}:${workflowId}:${mediaId}`;
}

function notifyAiTextDisplayChanged(): void {
  window.dispatchEvent(new CustomEvent(AI_TEXT_DISPLAY_EVENT));
}

function writeDisplay(
  key: string,
  next: AiTextDisplay
): void {
  const existing = hungDisplays.get(key);
  if (
    existing &&
    existing.excerpt === next.excerpt &&
    existing.state === next.state
  ) {
    return;
  }

  hungDisplays.set(key, next);
  notifyAiTextDisplayChanged();
}

export function hangAiTextDisplay(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly mediaId: string;
  readonly excerpt?: string;
  readonly body?: string;
  readonly state?: AiTextStagingDisplayState;
}): void {
  const excerptFromBody = params.body?.trim()
    ? buildAiTextExcerpt(params.body)
    : "";
  const excerpt = (params.excerpt ?? excerptFromBody).trim();
  const state =
    params.state ??
    (excerpt || params.body?.trim() ? "ready" : "empty");

  writeDisplay(
    displayKey(params.organizationId, params.workflowId, params.mediaId),
    { excerpt, state }
  );
}

export function hangAiTextDisplayFromReference(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly reference: WorkflowMediaValue;
  readonly body: string;
}): void {
  const mediaId = getResourceIdFromValue(params.reference);
  if (!mediaId) {
    return;
  }

  hangAiTextDisplay({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    mediaId,
    body: params.body,
  });
}

export function setAiTextDisplayState(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly mediaId: string;
  readonly state: AiTextStagingDisplayState;
}): void {
  const key = displayKey(
    params.organizationId,
    params.workflowId,
    params.mediaId
  );
  const existing = hungDisplays.get(key);
  writeDisplay(key, {
    excerpt: existing?.excerpt ?? "",
    state: params.state,
  });
}

export function getAiTextDisplay(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly mediaId: string;
}): AiTextDisplay | null {
  return (
    hungDisplays.get(
      displayKey(params.organizationId, params.workflowId, params.mediaId)
    ) ?? null
  );
}

export function findAiTextDisplayForMediaId(mediaId: string): AiTextDisplay | null {
  for (const [key, display] of hungDisplays.entries()) {
    if (key.endsWith(`:${mediaId}`)) {
      return display;
    }
  }
  return null;
}

export function dropAiTextDisplayForMediaId(mediaId: string): void {
  let dropped = false;
  for (const key of [...hungDisplays.keys()]) {
    if (!key.endsWith(`:${mediaId}`)) {
      continue;
    }
    hungDisplays.delete(key);
    dropped = true;
  }
  if (dropped) {
    notifyAiTextDisplayChanged();
  }
}

export function rekeyAiTextDisplay(params: {
  readonly fromMediaId: string;
  readonly toMediaId: string;
}): void {
  if (params.fromMediaId === params.toMediaId) {
    return;
  }

  let changed = false;
  for (const [key, display] of [...hungDisplays.entries()]) {
    if (!key.endsWith(`:${params.fromMediaId}`)) {
      continue;
    }
    const nextKey = `${key.slice(0, key.length - params.fromMediaId.length)}${params.toMediaId}`;
    hungDisplays.delete(key);
    if (!hungDisplays.has(nextKey)) {
      hungDisplays.set(nextKey, display);
    }
    changed = true;
  }
  if (changed) {
    notifyAiTextDisplayChanged();
  }
}

/** @internal — tests only */
export function clearAiTextDisplaysForTests(): void {
  if (hungDisplays.size === 0) {
    return;
  }
  hungDisplays.clear();
  notifyAiTextDisplayChanged();
}
