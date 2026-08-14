import type { WorkflowMediaValue } from "@dafthunk/types";
import { getResourceIdFromValue } from "@dafthunk/types";

import { ensureAiTextCached } from "@/services/ensure-ai-text-cached";
import { hangAiTextDisplayFromReference } from "@/services/ai-text-display-registry";
import { readAiTextContent } from "@/services/ai-text-storage-service";

export interface LoadAiTextBodyFromCacheParams {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly reference: WorkflowMediaValue;
  readonly workflowSha?: string;
}

/** Hydrate IndexedDB if needed, then read 原文 and hang canvas preview/body. */
export async function loadAiTextBodyFromCache(
  params: LoadAiTextBodyFromCacheParams
): Promise<string | null> {
  await ensureAiTextCached(params);

  const body = await readAiTextContent({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    value: params.reference,
  });

  const trimmed = body?.trim() ? body : null;
  if (trimmed && getResourceIdFromValue(params.reference)) {
    hangAiTextDisplayFromReference({
      organizationId: params.organizationId,
      workflowId: params.workflowId,
      reference: params.reference,
      body: trimmed,
    });
  }

  return trimmed;
}
