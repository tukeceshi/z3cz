import type { TextEditOp } from "@dafthunk/types";

export interface TextContentCacheEntry {
  readonly baseSha256: string;
  readonly pendingSha256: string;
  readonly ops: readonly TextEditOp[];
  readonly updatedAt: number;
}

export interface TextContentCacheRow {
  readonly organizationId: string;
  readonly resourceId: string;
  readonly entry: TextContentCacheEntry;
}

const cache = new Map<string, TextContentCacheEntry>();

function cacheKey(organizationId: string, resourceId: string): string {
  return `${organizationId}:${resourceId}`;
}

export function getTextContentCacheEntry(
  organizationId: string,
  resourceId: string
): TextContentCacheEntry | undefined {
  return cache.get(cacheKey(organizationId, resourceId));
}

export function upsertTextContentCacheEntry(
  organizationId: string,
  resourceId: string,
  entry: TextContentCacheEntry
): void {
  cache.set(cacheKey(organizationId, resourceId), entry);
}

export function appendTextContentCacheOps(
  organizationId: string,
  resourceId: string,
  params: {
    readonly baseSha256: string;
    readonly pendingSha256: string;
    readonly ops: readonly TextEditOp[];
  }
): TextContentCacheEntry {
  const key = cacheKey(organizationId, resourceId);
  const existing = cache.get(key);
  const next: TextContentCacheEntry = {
    baseSha256: params.baseSha256,
    pendingSha256: params.pendingSha256,
    ops: existing ? [...existing.ops, ...params.ops] : [...params.ops],
    updatedAt: Date.now(),
  };
  cache.set(key, next);
  return next;
}

export function clearTextContentCacheEntry(
  organizationId: string,
  resourceId: string
): void {
  cache.delete(cacheKey(organizationId, resourceId));
}

export function listTextContentCacheEntries(): readonly TextContentCacheRow[] {
  const rows: TextContentCacheRow[] = [];
  for (const [key, entry] of cache.entries()) {
    const separator = key.indexOf(":");
    if (separator <= 0) {
      continue;
    }
    rows.push({
      organizationId: key.slice(0, separator),
      resourceId: key.slice(separator + 1),
      entry,
    });
  }
  return rows;
}
