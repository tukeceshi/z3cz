import type { MediaDisplayUrlSet } from "@/services/ai-media-cache-service";
import { CANVAS_TIER_SHORT_EDGE } from "@/services/canvas-media-tier";
import type { CanvasMediaTier } from "@/services/canvas-media-tier";
import {
  createStableBlobUrl,
  mediaDisplayStableBlobUrlKey,
  stagingBlobUrlKey,
} from "@/services/media-display-blob-url-registry";

export interface WorkflowMediaAddressScope {
  readonly organizationId: string;
  readonly workflowId: string;
}

export type WorkflowMediaThumbTier = CanvasMediaTier;

interface WorkflowMediaAddressEntry {
  full: string | null;
  s: string | null;
  m: string | null;
  l: string | null;
}

interface ActiveWorkflowCatalog extends WorkflowMediaAddressScope {
  ready: boolean;
  entries: Map<string, WorkflowMediaAddressEntry>;
}

export const EMPTY_WORKFLOW_MEDIA_ADDRESS: MediaDisplayUrlSet = {
  full: null,
  s: null,
  m: null,
  l: null,
};

let activeCatalog: ActiveWorkflowCatalog | null = null;
let initPromise: Promise<void> | null = null;
let initScopeKey: string | null = null;
let catalogInitGeneration = 0;

function scopeKey(scope: WorkflowMediaAddressScope): string {
  return `${scope.organizationId}:${scope.workflowId}`;
}

function mediaKey(scope: WorkflowMediaAddressScope, mediaId: string): string {
  return `${scopeKey(scope)}:${mediaId}`;
}

function emptyEntry(): WorkflowMediaAddressEntry {
  return { full: null, s: null, m: null, l: null };
}

function tierWidth(tier: WorkflowMediaThumbTier): number {
  return CANVAS_TIER_SHORT_EDGE[tier];
}

function tierLabel(tier: WorkflowMediaThumbTier): string {
  return `w${tierWidth(tier)}`;
}

function isActiveScope(scope: WorkflowMediaAddressScope): boolean {
  return (
    activeCatalog !== null &&
    activeCatalog.organizationId === scope.organizationId &&
    activeCatalog.workflowId === scope.workflowId
  );
}

function getOrCreateEntry(
  scope: WorkflowMediaAddressScope,
  mediaId: string
): WorkflowMediaAddressEntry | null {
  if (!isActiveScope(scope)) {
    return null;
  }
  const key = mediaKey(scope, mediaId);
  let entry = activeCatalog!.entries.get(key);
  if (!entry) {
    entry = emptyEntry();
    activeCatalog!.entries.set(key, entry);
  }
  return entry;
}

export function mediaDisplayUrlSetsEqual(
  left: MediaDisplayUrlSet,
  right: MediaDisplayUrlSet
): boolean {
  return (
    left.full === right.full &&
    left.s === right.s &&
    left.m === right.m &&
    left.l === right.l
  );
}

export function hasRememberedDisplayThumb(set: MediaDisplayUrlSet): boolean {
  return Boolean(set.s || set.full);
}

export function isWorkflowMediaAddressCatalogReady(
  scope: WorkflowMediaAddressScope
): boolean {
  return isActiveScope(scope) && activeCatalog!.ready;
}

export function resetWorkflowMediaAddressCatalog(): void {
  catalogInitGeneration += 1;
  activeCatalog = null;
  initPromise = null;
  initScopeKey = null;
}

export function getWorkflowMediaUrlSet(
  scope: WorkflowMediaAddressScope,
  mediaId: string
): MediaDisplayUrlSet {
  if (!isActiveScope(scope)) {
    return EMPTY_WORKFLOW_MEDIA_ADDRESS;
  }
  return activeCatalog!.entries.get(mediaKey(scope, mediaId)) ?? EMPTY_WORKFLOW_MEDIA_ADDRESS;
}

function registerBlobUrl(params: {
  readonly scope: WorkflowMediaAddressScope;
  readonly mediaId: string;
  readonly stableKey: string;
  readonly blob: Blob;
  readonly field: keyof WorkflowMediaAddressEntry;
}): string {
  const url = createStableBlobUrl(params.stableKey, params.blob);
  const entry = getOrCreateEntry(params.scope, params.mediaId);
  if (entry) {
    entry[params.field] = url;
  }
  return url;
}

export function registerWorkflowMediaThumbUrl(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly mediaId: string;
  readonly tier: WorkflowMediaThumbTier;
  readonly blob: Blob;
}): string {
  const scope = {
    organizationId: params.organizationId,
    workflowId: params.workflowId,
  };
  return registerBlobUrl({
    scope,
    mediaId: params.mediaId,
    stableKey: mediaDisplayStableBlobUrlKey({
      organizationId: params.organizationId,
      workflowId: params.workflowId,
      mediaId: params.mediaId,
      tierLabel: tierLabel(params.tier),
    }),
    blob: params.blob,
    field: params.tier,
  });
}

export function registerWorkflowMediaFullUrl(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly mediaId: string;
  readonly blob: Blob;
  readonly preferStagingKey?: boolean;
}): string {
  const scope = {
    organizationId: params.organizationId,
    workflowId: params.workflowId,
  };
  const stableKey = params.preferStagingKey
    ? stagingBlobUrlKey({
        organizationId: params.organizationId,
        workflowId: params.workflowId,
        mediaId: params.mediaId,
      })
    : mediaDisplayStableBlobUrlKey({
        organizationId: params.organizationId,
        workflowId: params.workflowId,
        mediaId: params.mediaId,
        tierLabel: "full",
      });

  return registerBlobUrl({
    scope,
    mediaId: params.mediaId,
    stableKey,
    blob: params.blob,
    field: "full",
  });
}

export function patchWorkflowMediaUrlSet(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly mediaId: string;
  readonly urlSet: Partial<MediaDisplayUrlSet>;
}): void {
  const scope = {
    organizationId: params.organizationId,
    workflowId: params.workflowId,
  };
  const entry = getOrCreateEntry(scope, params.mediaId);
  if (!entry) {
    return;
  }
  if (params.urlSet.full !== undefined) {
    entry.full = params.urlSet.full;
  }
  if (params.urlSet.s !== undefined) {
    entry.s = params.urlSet.s;
  }
  if (params.urlSet.m !== undefined) {
    entry.m = params.urlSet.m;
  }
  if (params.urlSet.l !== undefined) {
    entry.l = params.urlSet.l;
  }
}

export function populateWorkflowMediaThumbBlobs(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly items: readonly {
    readonly mediaId: string;
    readonly thumbs: {
      readonly s: Blob | null;
      readonly m: Blob | null;
      readonly l: Blob | null;
    };
  }[];
}): void {
  const scope = {
    organizationId: params.organizationId,
    workflowId: params.workflowId,
  };

  if (activeCatalog !== null && !isActiveScope(scope)) {
    return;
  }

  if (!isActiveScope(scope)) {
    activeCatalog = {
      ...scope,
      ready: false,
      entries: new Map(),
    };
  }

  for (const item of params.items) {
    for (const tier of ["s", "m", "l"] as const) {
      const blob = item.thumbs[tier];
      if (!blob) {
        continue;
      }
      registerWorkflowMediaThumbUrl({
        organizationId: params.organizationId,
        workflowId: params.workflowId,
        mediaId: item.mediaId,
        tier,
        blob,
      });
    }
  }
}

export async function initWorkflowMediaAddressCatalog(
  scope: WorkflowMediaAddressScope,
  loadThumbBlobs: (
    scope: WorkflowMediaAddressScope
  ) => Promise<
    readonly {
      readonly mediaId: string;
      readonly thumbs: {
        readonly s: Blob | null;
        readonly m: Blob | null;
        readonly l: Blob | null;
      };
    }[]
  >
): Promise<void> {
  const key = scopeKey(scope);
  if (isWorkflowMediaAddressCatalogReady(scope)) {
    return;
  }
  if (initPromise && initScopeKey === key) {
    return initPromise;
  }

  initScopeKey = key;
  const initGeneration = catalogInitGeneration;
  initPromise = (async () => {
    if (initGeneration !== catalogInitGeneration) {
      return;
    }

    if (!isActiveScope(scope)) {
      activeCatalog = {
        ...scope,
        ready: false,
        entries: new Map(),
      };
    } else {
      activeCatalog!.ready = false;
    }

    try {
      const items = await loadThumbBlobs(scope);
      if (initGeneration !== catalogInitGeneration) {
        return;
      }
      populateWorkflowMediaThumbBlobs({
        organizationId: scope.organizationId,
        workflowId: scope.workflowId,
        items,
      });
    } catch {
      // Keep an empty catalog — init must still complete.
    } finally {
      if (
        initGeneration === catalogInitGeneration &&
        isActiveScope(scope)
      ) {
        activeCatalog!.ready = true;
      }
    }
  })();

  try {
    await initPromise;
  } finally {
    if (initScopeKey === key) {
      initPromise = null;
    }
  }
}

export function forgetWorkflowMediaFromCatalog(mediaId: string): void {
  if (!activeCatalog) {
    return;
  }
  const suffix = `:${mediaId}`;
  for (const key of [...activeCatalog.entries.keys()]) {
    if (key.endsWith(suffix)) {
      activeCatalog.entries.delete(key);
    }
  }
}

/** @deprecated Use getWorkflowMediaUrlSet / patchWorkflowMediaUrlSet. */
export function rememberMediaDisplayUrlSet(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly mediaId: string;
  readonly urlSet: MediaDisplayUrlSet;
}): void {
  if (!hasRememberedDisplayThumb(params.urlSet)) {
    return;
  }
  patchWorkflowMediaUrlSet({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    mediaId: params.mediaId,
    urlSet: params.urlSet,
  });
}

/** @deprecated Use getWorkflowMediaUrlSet. */
export function recallMediaDisplayUrlSet(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly mediaId: string;
}): MediaDisplayUrlSet | null {
  const set = getWorkflowMediaUrlSet(params, params.mediaId);
  return hasRememberedDisplayThumb(set) ? set : null;
}

/** @deprecated Use forgetWorkflowMediaFromCatalog. */
export function forgetMediaDisplayUrlSetsForMediaId(mediaId: string): void {
  forgetWorkflowMediaFromCatalog(mediaId);
}
