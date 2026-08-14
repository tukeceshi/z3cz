import { buildAiTextExcerpt, getResourceIdFromValue } from "@dafthunk/types";
import type { WorkflowMediaValue } from "@dafthunk/types";

export const AI_TEXT_DISPLAY_EVENT = "dafthunk:ai-text-display-changed";

export interface AiTextDisplay {
  readonly excerpt: string;
  readonly body: string;
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

export function hangAiTextDisplay(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly mediaId: string;
  readonly body: string;
}): void {
  const body = params.body.trim();
  if (!body) {
    return;
  }

  const next: AiTextDisplay = {
    excerpt: buildAiTextExcerpt(body),
    body,
  };
  const key = displayKey(
    params.organizationId,
    params.workflowId,
    params.mediaId
  );
  const existing = hungDisplays.get(key);
  if (existing && existing.body === next.body && existing.excerpt === next.excerpt) {
    return;
  }

  hungDisplays.set(key, next);
  notifyAiTextDisplayChanged();
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
