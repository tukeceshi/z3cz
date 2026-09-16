export const AI_MEDIA_CACHE_LIMIT_RATIO = 0.7 as const;
export const AI_MEDIA_CACHE_HINT_RATIO = 0.6 as const;

const BYTES_PER_MB = 1024 * 1024;

export function bytesToLimitMb(bytes: number): number {
  return Math.max(1, Math.round(bytes / BYTES_PER_MB));
}

export function defaultLimitMbFromQuotaBytes(
  quotaBytes: number | null | undefined
): number | null {
  if (quotaBytes == null || !Number.isFinite(quotaBytes) || quotaBytes <= 0) {
    return null;
  }
  return bytesToLimitMb(quotaBytes * AI_MEDIA_CACHE_LIMIT_RATIO);
}

export function clampCacheLimitMb(value: number, maxMb: number | null): number {
  const rounded = Math.max(1, Math.round(value));
  if (maxMb == null || maxMb < 1) {
    return rounded;
  }
  return Math.min(maxMb, rounded);
}

export function shouldShowCacheCleanupHint(
  usedBytes: number,
  limitBytes: number
): boolean {
  if (limitBytes <= 0 || usedBytes <= 0) {
    return false;
  }
  return usedBytes / limitBytes >= AI_MEDIA_CACHE_HINT_RATIO;
}

export function pickQuickCleanWorkflowId(
  workflows: ReadonlyArray<{
    readonly workflowId: string;
    readonly updatedAt: string;
    readonly totalBytes: number;
  }>,
  currentWorkflowId: string | undefined
): string | null {
  const candidates = workflows.filter(
    (workflow) =>
      workflow.totalBytes > 0 && workflow.workflowId !== currentWorkflowId
  );
  if (candidates.length === 0) {
    return null;
  }
  const byOldestUpdate = [...candidates].sort((left, right) =>
    left.updatedAt.localeCompare(right.updatedAt)
  );
  return byOldestUpdate[0]?.workflowId ?? null;
}

export function isQuotaExceededError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const name = "name" in error ? String(error.name) : "";
  if (name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED") {
    return true;
  }
  const code = "code" in error ? Number(error.code) : null;
  return code === 22;
}

export function orderEntriesForEviction<
  T extends {
    readonly key: string;
    readonly nodeType: string;
    readonly lastAccessAt: string;
  },
>(entries: readonly T[], protectKey?: string): T[] {
  const eligible = protectKey
    ? entries.filter((entry) => entry.key !== protectKey)
    : [...entries];
  const byAccess = (left: T, right: T): number =>
    left.lastAccessAt.localeCompare(right.lastAccessAt);
  return [
    ...eligible
      .filter((entry) => entry.nodeType === "agent-chat")
      .sort(byAccess),
    ...eligible
      .filter((entry) => entry.nodeType !== "agent-chat")
      .sort(byAccess),
  ];
}
