/** Stable object URLs keyed by org/workflow/media/tier — survives display cache invalidation. */

const stableBlobUrls = new Map<string, string>();

export function stagingBlobUrlKey(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly mediaId: string;
}): string {
  return `${params.organizationId}:${params.workflowId}:${params.mediaId}:staging`;
}

export function getStableBlobUrl(stableKey: string): string | null {
  return stableBlobUrls.get(stableKey) ?? null;
}

export function createStableBlobUrl(stableKey: string, blob: Blob): string {
  const existing = stableBlobUrls.get(stableKey);
  if (existing) {
    return existing;
  }

  const url = URL.createObjectURL(blob);
  stableBlobUrls.set(stableKey, url);
  return url;
}

/** Sync lookup when only mediaId is known (e.g. local refs in config panels). */
export function findStableBlobUrlForMediaId(mediaId: string): string | null {
  for (const [key, url] of stableBlobUrls.entries()) {
    if (key.includes(`:${mediaId}:`)) {
      return url;
    }
  }
  return null;
}

export function rekeyStableBlobUrlsForMediaId(params: {
  readonly fromMediaId: string;
  readonly toMediaId: string;
}): void {
  if (params.fromMediaId === params.toMediaId) {
    return;
  }

  for (const [key, url] of [...stableBlobUrls.entries()]) {
    if (!key.includes(`:${params.fromMediaId}:`)) {
      continue;
    }
    const nextKey = key.replace(
      `:${params.fromMediaId}:`,
      `:${params.toMediaId}:`
    );
    stableBlobUrls.delete(key);
    if (!stableBlobUrls.has(nextKey)) {
      stableBlobUrls.set(nextKey, url);
    }
  }
}

export function dropStableBlobUrlsForMediaId(mediaId: string): void {
  for (const [key, url] of [...stableBlobUrls.entries()]) {
    if (!key.includes(`:${mediaId}:`)) {
      continue;
    }
    stableBlobUrls.delete(key);
    URL.revokeObjectURL(url);
  }
}

export function dropStableBlobUrl(stableKey: string): void {
  const url = stableBlobUrls.get(stableKey);
  if (!url) return;
  stableBlobUrls.delete(stableKey);
  URL.revokeObjectURL(url);
}

export function isManagedDisplayBlobUrl(url: string): boolean {
  for (const stableUrl of stableBlobUrls.values()) {
    if (stableUrl === url) {
      return true;
    }
  }
  return false;
}
