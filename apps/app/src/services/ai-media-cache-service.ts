import {
  AI_MEDIA_CACHE_DEFAULT_LIMIT_MB,
  AI_MEDIA_CACHE_MAX_LIMIT_MB,
  AI_MEDIA_CACHE_MIN_LIMIT_MB,
  type AiMediaCacheSettings,
  getMediaReferenceKey,
  type MediaReference,
} from "@dafthunk/types";

import {
  createStableBlobUrl,
  dropStableBlobUrlsForMediaId,
  getStableBlobUrl,
} from "@/services/media-display-blob-url-registry";
import { recordMediaResourceAlias } from "@/services/media-resource-alias-service";
import {
  generateImageThumbnail,
  readImageNaturalSize,
} from "@/services/generate-image-thumbnail";
import { generateVideoPoster } from "@/services/generate-video-poster";
import { displaySizeToMaxWidth, CANVAS_TIER_SHORT_EDGE, LEGACY_CANVAS_S_THUMB_WIDTH } from "@/services/canvas-media-tier";
import type { MediaDisplaySize } from "@/services/media-display-size";
import { mediaUrlSupportsBrowserCache } from "@/services/media-cache-fetch-utils";
import { resolveMediaCacheFetchUrl } from "@/services/media-object-url";
import { notifyAiMediaCacheChanged } from "@/services/ai-media-cache-events";

const DB_NAME = "dafthunk-ai-media-cache";
const DB_VERSION = 4;
const ENTRIES_STORE = "entries";
const THUMBS_STORE = "thumbs";
const WORKFLOWS_STORE = "workflows";
const META_STORE = "meta";
const META_KEY = "settings";

export interface AiMediaCacheEntry {
  readonly key: string;
  readonly organizationId: string;
  readonly workflowId: string;
  readonly workflowName: string;
  readonly mediaId: string;
  readonly nodeType: "ai-image" | "ai-video" | "ai-audio";
  readonly mimeType: string;
  readonly byteSize: number;
  readonly naturalWidth?: number;
  readonly naturalHeight?: number;
  readonly createdAt: string;
  readonly lastAccessAt: string;
}

export interface AiMediaWorkflowSummary {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly workflowName: string;
  readonly imageCount: number;
  readonly videoCount: number;
  readonly audioCount: number;
  readonly totalBytes: number;
  readonly updatedAt: string;
  /** Distinct cached files. */
  readonly entryCount: number;
}

export interface AiMediaCacheEntrySummary {
  readonly key: string;
  readonly organizationId: string;
  readonly workflowId: string;
  readonly workflowName: string;
  readonly mediaId: string;
  readonly nodeType: "ai-image" | "ai-video" | "ai-audio";
  readonly mimeType: string;
  readonly byteSize: number;
  readonly naturalWidth?: number;
  readonly naturalHeight?: number;
  readonly createdAt: string;
  readonly lastAccessAt: string;
}

export interface AiMediaCacheStats {
  readonly totalBytes: number;
  readonly originalBytes: number;
  readonly thumbBytes: number;
  readonly limitBytes: number;
  readonly enabled: boolean;
  readonly browserQuotaBytes: number | null;
  readonly browserUsageBytes: number | null;
  readonly workflows: readonly AiMediaWorkflowSummary[];
}

export type AiMediaCacheTierKind = "thumb" | "canvas-s" | "canvas-m" | "canvas-l";

export interface AiMediaCacheTierSummary {
  readonly tier: AiMediaCacheTierKind;
  readonly maxWidth: number;
  readonly byteSize: number;
}

export interface AiMediaCacheResourceSummary {
  readonly entryKey: string;
  readonly mediaId: string;
  readonly nodeType: AiMediaCacheEntry["nodeType"];
  readonly mimeType: string;
  readonly originalBytes: number;
  readonly thumbBytes: number;
  readonly totalBytes: number;
  readonly tiers: readonly AiMediaCacheTierSummary[];
  readonly createdAt: string;
  readonly lastAccessAt: string;
}

interface CacheEntryRecord extends AiMediaCacheEntry {
  blob: Blob;
}

interface ThumbRecord {
  readonly key: string;
  readonly parentEntryKey?: string;
  readonly tier?: AiMediaCacheTierKind;
  readonly maxWidth?: number;
  readonly createdAt?: string;
  blob: Blob;
  byteSize: number;
}

interface MetaRecord {
  readonly key: typeof META_KEY;
  enabled: boolean;
  limitMb: number;
  totalBytes: number;
}

type WorkflowRecord = AiMediaWorkflowSummary & { key: string };

function modalityCountDelta(
  nodeType: AiMediaCacheEntry["nodeType"],
  sign: 1 | -1
): Pick<AiMediaWorkflowSummary, "imageCount" | "videoCount" | "audioCount"> {
  return {
    imageCount: nodeType === "ai-image" ? sign : 0,
    videoCount: nodeType === "ai-video" ? sign : 0,
    audioCount: nodeType === "ai-audio" ? sign : 0,
  };
}

function applyCountDelta(
  summary: Pick<
    AiMediaWorkflowSummary,
    "imageCount" | "videoCount" | "audioCount" | "entryCount"
  >,
  nodeType: AiMediaCacheEntry["nodeType"],
  sign: 1 | -1
): Pick<AiMediaWorkflowSummary, "imageCount" | "videoCount" | "audioCount" | "entryCount"> {
  const delta = modalityCountDelta(nodeType, sign);
  return {
    imageCount: summary.imageCount + delta.imageCount,
    videoCount: summary.videoCount + delta.videoCount,
    audioCount: summary.audioCount + delta.audioCount,
    entryCount: Math.max(0, summary.entryCount + sign),
  };
}

function clampLimitMb(value: number): number {
  return Math.min(
    AI_MEDIA_CACHE_MAX_LIMIT_MB,
    Math.max(AI_MEDIA_CACHE_MIN_LIMIT_MB, Math.round(value))
  );
}

function defaultMeta(): MetaRecord {
  return {
    key: META_KEY,
    enabled: true,
    limitMb: AI_MEDIA_CACHE_DEFAULT_LIMIT_MB,
    totalBytes: 0,
  };
}

function entryKey(
  organizationId: string,
  workflowId: string,
  mediaId: string
): string {
  return `${organizationId}:${workflowId}:${mediaId}`;
}

function workflowKey(organizationId: string, workflowId: string): string {
  return `${organizationId}:${workflowId}`;
}

function cacheWriteStoreNames(db: IDBDatabase): string[] {
  const stores = [ENTRIES_STORE, WORKFLOWS_STORE, META_STORE];
  if (db.objectStoreNames.contains(THUMBS_STORE)) {
    stores.splice(1, 0, THUMBS_STORE);
  }
  return stores;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      const transaction = request.transaction;
      if (!db.objectStoreNames.contains(ENTRIES_STORE)) {
        const store = db.createObjectStore(ENTRIES_STORE, { keyPath: "key" });
        store.createIndex("workflow", "workflowId", { unique: false });
        store.createIndex("lastAccessAt", "lastAccessAt", { unique: false });
        store.createIndex("mediaId", "mediaId", { unique: false });
      } else if (event.oldVersion < 3 && transaction) {
        const store = transaction.objectStore(ENTRIES_STORE);
        if (!store.indexNames.contains("mediaId")) {
          store.createIndex("mediaId", "mediaId", { unique: false });
        }
      }
      if (!db.objectStoreNames.contains(WORKFLOWS_STORE)) {
        db.createObjectStore(WORKFLOWS_STORE, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(THUMBS_STORE)) {
        db.createObjectStore(THUMBS_STORE, { keyPath: "key" });
      }
    };
  });
}

function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

/** Runs a transaction and waits until it commits (never resolve before oncomplete). */
function runTransaction(
  db: IDBDatabase,
  storeNames: string | string[],
  mode: IDBTransactionMode,
  fn: (transaction: IDBTransaction) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeNames, mode);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
    try {
      fn(transaction);
    } catch (error) {
      transaction.abort();
      reject(error);
    }
  });
}

async function withDatabase<T>(
  fn: (db: IDBDatabase) => Promise<T>
): Promise<T> {
  const db = await openDatabase();
  try {
    await dedupeAliasCacheEntriesOnce(db);
    return await fn(db);
  } finally {
    db.close();
  }
}

let aliasDedupeDone = false;

async function dedupeAliasCacheEntriesOnce(db: IDBDatabase): Promise<void> {
  if (aliasDedupeDone) return;
  aliasDedupeDone = true;

  const entries = await readAllEntries(db);
  const groups = new Map<string, CacheEntryRecord[]>();

  for (const entry of entries) {
    const fingerprint = [
      entry.organizationId,
      entry.workflowId,
      entry.byteSize,
      entry.mimeType,
      entry.nodeType,
    ].join("|");
    const bucket = groups.get(fingerprint) ?? [];
    bucket.push(entry);
    groups.set(fingerprint, bucket);
  }

  for (const bucket of groups.values()) {
    if (bucket.length < 2) continue;
    const cloudEntries = bucket.filter((entry) => entry.mediaId.includes("/"));
    const aliasEntries = bucket.filter((entry) => !entry.mediaId.includes("/"));
    if (cloudEntries.length === 0 || aliasEntries.length === 0) continue;

    for (const alias of aliasEntries) {
      const cloud = cloudEntries[0];
      if (cloud) {
        recordMediaResourceAlias({
          organizationId: alias.organizationId,
          workflowId: alias.workflowId,
          fromMediaId: alias.mediaId,
          toMediaId: cloud.mediaId,
        });
      }
      await deleteEntry(db, alias.key);
    }
  }
}

async function readMeta(db: IDBDatabase): Promise<MetaRecord> {
  const transaction = db.transaction(META_STORE, "readonly");
  const result = await idbRequest<MetaRecord | undefined>(
    transaction.objectStore(META_STORE).get(META_KEY)
  );
  return result ?? defaultMeta();
}

async function writeMeta(db: IDBDatabase, meta: MetaRecord): Promise<void> {
  await runTransaction(db, META_STORE, "readwrite", (transaction) => {
    transaction.objectStore(META_STORE).put(meta);
  });
}

async function readAllEntries(db: IDBDatabase): Promise<CacheEntryRecord[]> {
  const transaction = db.transaction(ENTRIES_STORE, "readonly");
  const rows = await idbRequest(
    transaction.objectStore(ENTRIES_STORE).getAll()
  );
  return (rows as CacheEntryRecord[]) ?? [];
}

async function readWorkflowSummaries(
  db: IDBDatabase,
  organizationId: string
): Promise<AiMediaWorkflowSummary[]> {
  const transaction = db.transaction(WORKFLOWS_STORE, "readonly");
  const rows = await idbRequest(
    transaction.objectStore(WORKFLOWS_STORE).getAll()
  );
  return ((rows as WorkflowRecord[]) ?? [])
    .filter((row) => row.organizationId === organizationId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Rebuild workflow summaries and meta.totalBytes from entries + thumbs. */
async function reconcileCacheMeta(db: IDBDatabase): Promise<void> {
  const entries = await readAllEntries(db);
  const entryKeys = new Set(entries.map((entry) => entry.key));
  const thumbs = await readAllThumbs(db);
  const workflowMap = new Map<string, WorkflowRecord>();
  let originalBytes = 0;
  let thumbBytes = 0;

  for (const entry of entries) {
    originalBytes += entry.byteSize;
    const wfKey = workflowKey(entry.organizationId, entry.workflowId);
    const prev = workflowMap.get(wfKey);
    const counts = applyCountDelta(
      prev ?? {
        imageCount: 0,
        videoCount: 0,
        audioCount: 0,
        entryCount: 0,
      },
      entry.nodeType,
      1
    );

    if (prev) {
      workflowMap.set(wfKey, {
        ...prev,
        ...counts,
        totalBytes: prev.totalBytes + entry.byteSize,
        updatedAt:
          entry.lastAccessAt > prev.updatedAt ? entry.lastAccessAt : prev.updatedAt,
      });
    } else {
      workflowMap.set(wfKey, {
        key: wfKey,
        organizationId: entry.organizationId,
        workflowId: entry.workflowId,
        workflowName: entry.workflowName,
        ...counts,
        totalBytes: entry.byteSize,
        updatedAt: entry.lastAccessAt,
      });
    }
  }

  const orphanThumbKeys: string[] = [];
  for (const thumb of thumbs) {
    const parentKey = thumb.parentEntryKey ?? parseThumbParentEntryKey(thumb.key);
    if (!parentKey || !entryKeys.has(parentKey)) {
      orphanThumbKeys.push(thumb.key);
      continue;
    }

    thumbBytes += thumb.byteSize;
    const parts = parseCacheEntryKeyParts(parentKey);
    if (!parts) continue;

    const wfKey = workflowKey(parts.organizationId, parts.workflowId);
    const summary = workflowMap.get(wfKey);
    if (summary) {
      workflowMap.set(wfKey, {
        ...summary,
        totalBytes: summary.totalBytes + thumb.byteSize,
      });
    }
  }

  if (orphanThumbKeys.length > 0 && db.objectStoreNames.contains(THUMBS_STORE)) {
    await runTransaction(db, THUMBS_STORE, "readwrite", (transaction) => {
      const store = transaction.objectStore(THUMBS_STORE);
      for (const key of orphanThumbKeys) {
        store.delete(key);
      }
    });
  }

  const meta = await readMeta(db);
  const totalBytes = originalBytes + thumbBytes;

  await runTransaction(
    db,
    [WORKFLOWS_STORE, META_STORE],
    "readwrite",
    (transaction) => {
      const wfStore = transaction.objectStore(WORKFLOWS_STORE);
      wfStore.clear();
      for (const summary of workflowMap.values()) {
        wfStore.put(summary);
      }

      transaction.objectStore(META_STORE).put({ ...meta, totalBytes });
    }
  );
}

async function deleteEntry(db: IDBDatabase, key: string): Promise<void> {
  const entryReadTx = db.transaction(ENTRIES_STORE, "readonly");
  const entry = await idbRequest<CacheEntryRecord | undefined>(
    entryReadTx.objectStore(ENTRIES_STORE).get(key)
  );
  if (!entry) return;

  dropStableBlobUrlsForMediaId(entry.mediaId);

  await runTransaction(db, cacheWriteStoreNames(db), "readwrite", (transaction) => {
    transaction.objectStore(ENTRIES_STORE).delete(key);
    if (db.objectStoreNames.contains(THUMBS_STORE)) {
      deleteEntryThumbs(transaction.objectStore(THUMBS_STORE), key);
    }
  });

  await reconcileCacheMeta(db);
}

async function evictLruUntilUnderLimit(
  db: IDBDatabase,
  limitBytes: number
): Promise<void> {
  let meta = await readMeta(db);
  if (meta.totalBytes <= limitBytes) return;

  const entries = await readAllEntries(db);
  entries.sort((a, b) => a.lastAccessAt.localeCompare(b.lastAccessAt));

  for (const entry of entries) {
    if (meta.totalBytes <= limitBytes) break;
    await deleteEntry(db, entry.key);
    meta = await readMeta(db);
  }

  await reconcileCacheMeta(db);
}

const IMAGE_TIER_SPECS: ReadonlyArray<{
  readonly tier: AiMediaCacheTierKind;
  readonly maxWidth: number;
}> = [
  { tier: "canvas-s", maxWidth: CANVAS_TIER_SHORT_EDGE.s },
  { tier: "canvas-m", maxWidth: CANVAS_TIER_SHORT_EDGE.m },
  { tier: "canvas-l", maxWidth: CANVAS_TIER_SHORT_EDGE.l },
] as const;

const VIDEO_TIER_SPECS: ReadonlyArray<{
  readonly tier: AiMediaCacheTierKind;
  readonly maxWidth: number;
}> = [
  { tier: "canvas-s", maxWidth: CANVAS_TIER_SHORT_EDGE.s },
  { tier: "canvas-m", maxWidth: CANVAS_TIER_SHORT_EDGE.m },
  { tier: "canvas-l", maxWidth: CANVAS_TIER_SHORT_EDGE.l },
] as const;

const TIER_THUMB_MAX_WIDTHS = [
  CANVAS_TIER_SHORT_EDGE.s,
  CANVAS_TIER_SHORT_EDGE.m,
  CANVAS_TIER_SHORT_EDGE.l,
] as const;
/** Legacy thumb widths still readable after upgrade. */
const LEGACY_TIER_THUMB_MAX_WIDTHS = [200, 400, 800, 1600] as const;

function tierCacheKey(entryKey: string, maxWidth: number): string {
  return `${entryKey}|w${maxWidth}`;
}

function parseThumbParentEntryKey(thumbKey: string): string | null {
  const pipeIndex = thumbKey.indexOf("|w");
  if (pipeIndex < 0) {
    return thumbKey;
  }
  return thumbKey.slice(0, pipeIndex);
}

function maxWidthToTierKind(maxWidth: number): AiMediaCacheTierKind {
  if (maxWidth <= CANVAS_TIER_SHORT_EDGE.s) return "canvas-s";
  if (maxWidth <= CANVAS_TIER_SHORT_EDGE.m) return "canvas-m";
  return "canvas-l";
}

function deleteEntryThumbs(
  thumbsStore: IDBObjectStore,
  entryKey: string
): void {
  thumbsStore.delete(entryKey);
  for (const maxWidth of TIER_THUMB_MAX_WIDTHS) {
    thumbsStore.delete(tierCacheKey(entryKey, maxWidth));
  }
  thumbsStore.delete(tierCacheKey(entryKey, LEGACY_CANVAS_S_THUMB_WIDTH));
  for (const maxWidth of LEGACY_TIER_THUMB_MAX_WIDTHS) {
    thumbsStore.delete(tierCacheKey(entryKey, maxWidth));
  }
}

async function storeThumb(
  db: IDBDatabase,
  params: {
    readonly key: string;
    readonly parentEntryKey: string;
    readonly tier: AiMediaCacheTierKind;
    readonly maxWidth: number;
    readonly blob: Blob;
  }
): Promise<void> {
  if (!db.objectStoreNames.contains(THUMBS_STORE)) return;

  const record: ThumbRecord = {
    key: params.key,
    parentEntryKey: params.parentEntryKey,
    tier: params.tier,
    maxWidth: params.maxWidth,
    createdAt: new Date().toISOString(),
    blob: params.blob,
    byteSize: params.blob.size,
  };
  await runTransaction(db, THUMBS_STORE, "readwrite", (transaction) => {
    transaction.objectStore(THUMBS_STORE).put(record);
  });
}

async function readThumbBlob(
  db: IDBDatabase,
  key: string
): Promise<Blob | null> {
  if (!db.objectStoreNames.contains(THUMBS_STORE)) return null;

  const transaction = db.transaction(THUMBS_STORE, "readonly");
  const record = await idbRequest<ThumbRecord | undefined>(
    transaction.objectStore(THUMBS_STORE).get(key)
  );
  return record?.blob ?? null;
}

async function readTierBlob(
  db: IDBDatabase,
  entry: CacheEntryRecord,
  maxWidth: number
): Promise<Blob | null> {
  const key = tierCacheKey(entry.key, maxWidth);
  const tierBlob = await readThumbBlob(db, key);
  if (tierBlob) return tierBlob;

  if (maxWidth === CANVAS_TIER_SHORT_EDGE.s) {
    const legacyCanvasS = await readThumbBlob(
      db,
      tierCacheKey(entry.key, LEGACY_CANVAS_S_THUMB_WIDTH)
    );
    if (legacyCanvasS) return legacyCanvasS;
  }

  // Legacy single-thumb key / old widths.
  if (
    maxWidth === CANVAS_TIER_SHORT_EDGE.s ||
    maxWidth === LEGACY_CANVAS_S_THUMB_WIDTH ||
    maxWidth === 200
  ) {
    const legacy = await readThumbBlob(db, entry.key);
    if (legacy) return legacy;
  }

  return null;
}

async function generateCacheResourceTiersForEntry(
  db: IDBDatabase,
  entry: CacheEntryRecord
): Promise<void> {
  const specs =
    entry.nodeType === "ai-video"
      ? VIDEO_TIER_SPECS
      : entry.nodeType === "ai-image"
        ? IMAGE_TIER_SPECS
        : [];

  await Promise.all(
    specs.map(async (spec) => {
      const key = tierCacheKey(entry.key, spec.maxWidth);
      const existing = await readTierBlob(db, entry, spec.maxWidth);
      if (existing) return;

      let generated: Blob | null = null;
      if (entry.nodeType === "ai-image") {
        generated = await generateImageThumbnail(
          entry.blob,
          entry.mimeType,
          spec.maxWidth
        );
      } else if (entry.nodeType === "ai-video") {
        generated = await generateVideoPoster(entry.blob, spec.maxWidth);
      }

      if (!generated || generated.size <= 0) {
        throw new Error(`Failed to generate ${spec.tier} thumbnail`);
      }

      await storeThumb(db, {
        key,
        parentEntryKey: entry.key,
        tier: spec.tier,
        maxWidth: spec.maxWidth,
        blob: generated,
      });
    })
  );

  await assertCanvasTiersReady(db, entry);
}

async function assertCanvasTiersReady(
  db: IDBDatabase,
  entry: CacheEntryRecord
): Promise<void> {
  const specs =
    entry.nodeType === "ai-video"
      ? VIDEO_TIER_SPECS
      : entry.nodeType === "ai-image"
        ? IMAGE_TIER_SPECS
        : [];

  for (const spec of specs) {
    const blob = await readTierBlob(db, entry, spec.maxWidth);
    if (!blob) {
      throw new Error(`Missing ${spec.tier} thumbnail`);
    }
  }
}

export async function generateCacheResourceTiers(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly mediaId: string;
}): Promise<void> {
  await withDatabase(async (db) => {
    const entry = await readCachedMediaEntry(db, params);
    if (!entry) return;
    await generateCacheResourceTiersForEntry(db, entry);
    await reconcileCacheMeta(db);
  });
}

export async function regenerateCacheResourceTiers(
  entryKey: string
): Promise<void> {
  await withDatabase(async (db) => {
    const entryReadTx = db.transaction(ENTRIES_STORE, "readonly");
    const entry = await idbRequest<CacheEntryRecord | undefined>(
      entryReadTx.objectStore(ENTRIES_STORE).get(entryKey)
    );
    if (!entry) return;

    if (db.objectStoreNames.contains(THUMBS_STORE)) {
      await runTransaction(db, THUMBS_STORE, "readwrite", (transaction) => {
        deleteEntryThumbs(transaction.objectStore(THUMBS_STORE), entryKey);
      });
    }

    await generateCacheResourceTiersForEntry(db, entry);
    await reconcileCacheMeta(db);
  });
}

export async function deleteCacheResourceTiers(
  entryKey: string,
  tiers?: readonly AiMediaCacheTierKind[]
): Promise<void> {
  await withDatabase(async (db) => {
    if (!db.objectStoreNames.contains(THUMBS_STORE)) return;

    const entryReadTx = db.transaction(ENTRIES_STORE, "readonly");
    const entry = await idbRequest<CacheEntryRecord | undefined>(
      entryReadTx.objectStore(ENTRIES_STORE).get(entryKey)
    );
    if (!entry) return;

    dropStableBlobUrlsForMediaId(entry.mediaId);

    const tierFilter = tiers ? new Set(tiers) : null;
    const specs =
      entry.nodeType === "ai-video"
        ? VIDEO_TIER_SPECS
        : entry.nodeType === "ai-image"
          ? IMAGE_TIER_SPECS
          : [];

    await runTransaction(db, THUMBS_STORE, "readwrite", (transaction) => {
      const store = transaction.objectStore(THUMBS_STORE);
      for (const spec of specs) {
        if (tierFilter && !tierFilter.has(spec.tier)) continue;
        store.delete(tierCacheKey(entryKey, spec.maxWidth));
      }
      if (!tierFilter || tierFilter.has("thumb")) {
        store.delete(entryKey);
      }
    });

    await reconcileCacheMeta(db);
  });
}

export async function getAiMediaCacheSettings(): Promise<AiMediaCacheSettings> {
  return withDatabase(async (db) => {
    const meta = await readMeta(db);
    return { enabled: meta.enabled, limitMb: meta.limitMb };
  });
}

export async function setAiMediaCacheSettings(
  settings: Partial<AiMediaCacheSettings>
): Promise<AiMediaCacheSettings> {
  return withDatabase(async (db) => {
    const meta = await readMeta(db);
    const next: MetaRecord = {
      ...meta,
      enabled: settings.enabled ?? meta.enabled,
      limitMb:
        settings.limitMb !== undefined
          ? clampLimitMb(settings.limitMb)
          : meta.limitMb,
    };
    await writeMeta(db, next);
    await evictLruUntilUnderLimit(db, next.limitMb * 1024 * 1024);
    return { enabled: next.enabled, limitMb: next.limitMb };
  });
}

export async function getAiMediaCacheStats(
  organizationId: string
): Promise<AiMediaCacheStats> {
  return withDatabase(async (db) => {
    await reconcileCacheMeta(db);
    const meta = await readMeta(db);
    const workflows = await readWorkflowSummaries(db, organizationId);
    const entries = (await readAllEntries(db)).filter(
      (entry) => entry.organizationId === organizationId
    );
    const originalBytes = entries.reduce((sum, entry) => sum + entry.byteSize, 0);
    const thumbBytes = Math.max(0, meta.totalBytes - originalBytes);

    let browserQuotaBytes: number | null = null;
    let browserUsageBytes: number | null = null;
    if (navigator.storage?.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        browserQuotaBytes =
          typeof estimate.quota === "number" ? estimate.quota : null;
        browserUsageBytes =
          typeof estimate.usage === "number" ? estimate.usage : null;
      } catch {
        // ignore
      }
    }

    return {
      totalBytes: meta.totalBytes,
      originalBytes,
      thumbBytes,
      limitBytes: meta.limitMb * 1024 * 1024,
      enabled: meta.enabled,
      browserQuotaBytes,
      browserUsageBytes,
      workflows,
    };
  });
}

async function putCacheBlobRecord(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly workflowName: string;
  readonly mediaId: string;
  readonly nodeType: AiMediaCacheEntry["nodeType"];
  readonly mimeType: string;
  readonly blob: Blob;
  readonly requireEnabled?: boolean;
}): Promise<boolean> {
  const settings = await getAiMediaCacheSettings();
  if (params.requireEnabled !== false && !settings.enabled) return false;

  const storedBlob =
    params.blob.type === params.mimeType
      ? params.blob
      : new Blob([params.blob], { type: params.mimeType });
  const byteSize = storedBlob.size;
  const now = new Date().toISOString();
  const key = entryKey(params.organizationId, params.workflowId, params.mediaId);

  return withDatabase(async (db) => {
    const existingTx = db.transaction(ENTRIES_STORE, "readonly");
    const existing = await idbRequest<CacheEntryRecord | undefined>(
      existingTx.objectStore(ENTRIES_STORE).get(key)
    );

    let naturalWidth = existing?.naturalWidth;
    let naturalHeight = existing?.naturalHeight;
    if (
      params.nodeType === "ai-image" &&
      (!naturalWidth || !naturalHeight)
    ) {
      const naturalSize = await readImageNaturalSize(storedBlob, params.mimeType);
      if (naturalSize) {
        naturalWidth = naturalSize.width;
        naturalHeight = naturalSize.height;
      }
    }

    const record: CacheEntryRecord = {
      key,
      organizationId: params.organizationId,
      workflowId: params.workflowId,
      workflowName: params.workflowName,
      mediaId: params.mediaId,
      nodeType: params.nodeType,
      mimeType: params.mimeType,
      byteSize,
      ...(naturalWidth && naturalHeight
        ? { naturalWidth, naturalHeight }
        : {}),
      createdAt: existing?.createdAt ?? now,
      lastAccessAt: now,
      blob: storedBlob,
    };

    const wfKey = workflowKey(params.organizationId, params.workflowId);
    const wfReadTx = db.transaction(WORKFLOWS_STORE, "readonly");
    const prev = await idbRequest<WorkflowRecord | undefined>(
      wfReadTx.objectStore(WORKFLOWS_STORE).get(wfKey)
    );
    const prevEntryCount =
      prev?.entryCount ??
      (prev?.imageCount ?? 0) + (prev?.videoCount ?? 0) + (prev?.audioCount ?? 0);
    const counts = existing
      ? {
          imageCount: prev?.imageCount ?? 0,
          videoCount: prev?.videoCount ?? 0,
          audioCount: prev?.audioCount ?? 0,
          entryCount: prevEntryCount,
        }
      : applyCountDelta(
          {
            imageCount: prev?.imageCount ?? 0,
            videoCount: prev?.videoCount ?? 0,
            audioCount: prev?.audioCount ?? 0,
            entryCount: prevEntryCount,
          },
          params.nodeType,
          1
        );

    await runTransaction(
      db,
      [ENTRIES_STORE, WORKFLOWS_STORE],
      "readwrite",
      (transaction) => {
      transaction.objectStore(ENTRIES_STORE).put(record);
      transaction.objectStore(WORKFLOWS_STORE).put({
        key: wfKey,
        organizationId: params.organizationId,
        workflowId: params.workflowId,
        workflowName: params.workflowName,
        ...counts,
        totalBytes: prev?.totalBytes ?? 0,
        updatedAt: now,
      });
    });

    await reconcileCacheMeta(db);

    const metaAfterWrite = await readMeta(db);
    await evictLruUntilUnderLimit(db, metaAfterWrite.limitMb * 1024 * 1024);

    if (params.nodeType === "ai-image" || params.nodeType === "ai-video") {
      await generateCacheResourceTiers({
        organizationId: params.organizationId,
        workflowId: params.workflowId,
        mediaId: params.mediaId,
      });
      notifyAiMediaCacheChanged();
    }

    return true;
  });
}

export async function cacheMediaFromBlob(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly workflowName: string;
  readonly mediaId: string;
  readonly blob: Blob;
  readonly mimeType: string;
  readonly nodeType: "ai-image" | "ai-video" | "ai-audio";
}): Promise<boolean> {
  return putCacheBlobRecord(params);
}

/** Writes blob storage even when AI media cache is disabled (generative staging). */
export async function writeGenerativeMediaCacheBlob(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly workflowName?: string;
  readonly mediaId: string;
  readonly blob: Blob;
  readonly mimeType: string;
  readonly nodeType: "ai-image" | "ai-video" | "ai-audio";
}): Promise<boolean> {
  return putCacheBlobRecord({
    ...params,
    workflowName: params.workflowName ?? params.workflowId,
    requireEnabled: false,
  });
}

export async function cacheMediaFromUrl(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly workflowName: string;
  readonly media: MediaReference;
  readonly nodeType: "ai-image" | "ai-video" | "ai-audio";
  readonly fetchUrl?: string;
  /** When false, always write staging even if AI media cache is disabled. */
  readonly requireEnabled?: boolean;
}): Promise<boolean> {
  const settings = await getAiMediaCacheSettings();
  if (params.requireEnabled !== false && !settings.enabled) return false;

  const mediaId = getMediaReferenceKey(params.media);
  const fetchUrl =
    params.fetchUrl && mediaUrlSupportsBrowserCache(params.fetchUrl)
      ? params.fetchUrl
      : resolveMediaCacheFetchUrl(params.media, params.organizationId);

  if (!fetchUrl || !mediaUrlSupportsBrowserCache(fetchUrl)) {
    return false;
  }

  let response: Response;
  try {
    response = await fetch(fetchUrl, { credentials: "include" });
  } catch {
    return false;
  }
  if (!response.ok) return false;

  const blob = await response.blob();
  const mimeType =
    params.media.mimeType ||
    blob.type ||
    (params.nodeType === "ai-video"
      ? "video/mp4"
      : params.nodeType === "ai-audio"
        ? "audio/mpeg"
        : "image/jpeg");

  return putCacheBlobRecord({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    workflowName: params.workflowName,
    mediaId,
    nodeType: params.nodeType,
    mimeType,
    blob,
    requireEnabled: params.requireEnabled,
  });
}

async function readCachedMediaEntry(
  db: IDBDatabase,
  params: {
    readonly organizationId: string;
    readonly workflowId: string;
    readonly mediaId: string;
  }
): Promise<CacheEntryRecord | null> {
  const key = entryKey(params.organizationId, params.workflowId, params.mediaId);
  const readTx = db.transaction(ENTRIES_STORE, "readonly");
  const entry = await idbRequest<CacheEntryRecord | undefined>(
    readTx.objectStore(ENTRIES_STORE).get(key)
  );

  if (!entry) {
    return null;
  }

  const touchedAt = new Date().toISOString();
  await runTransaction(db, ENTRIES_STORE, "readwrite", (transaction) => {
    transaction.objectStore(ENTRIES_STORE).put({
      ...entry,
      lastAccessAt: touchedAt,
    });
  });

  return entry;
}

export async function getCachedMediaBlob(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly mediaId: string;
}): Promise<Blob | null> {
  return withDatabase(async (db) => {
    const entry = await readCachedMediaEntry(db, params);
    return entry?.blob ?? null;
  });
}

export async function readCachedMediaEntryByMediaId(
  mediaId: string
): Promise<AiMediaCacheEntry | null> {
  return withDatabase(async (db) => {
    const readTx = db.transaction(ENTRIES_STORE, "readonly");
    const store = readTx.objectStore(ENTRIES_STORE);
    if (store.indexNames.contains("mediaId")) {
      const entries = await idbRequest<CacheEntryRecord[]>(
        store.index("mediaId").getAll(mediaId)
      );
      if (entries.length === 0) {
        return null;
      }
      const entry = entries.sort((a, b) =>
        b.lastAccessAt.localeCompare(a.lastAccessAt)
      )[0]!;
      return entry;
    }

    const all = await readAllEntries(db);
    const matches = all.filter((entry) => entry.mediaId === mediaId);
    if (matches.length === 0) {
      return null;
    }
    return matches.sort((a, b) =>
      b.lastAccessAt.localeCompare(a.lastAccessAt)
    )[0]!;
  });
}

export async function readCachedMediaBlobByMediaId(
  mediaId: string
): Promise<{ readonly blob: Blob; readonly mimeType: string } | null> {
  const entry = await readCachedMediaEntryByMediaId(mediaId);
  if (!entry) {
    return null;
  }
  const record = entry as CacheEntryRecord;
  return { blob: record.blob, mimeType: entry.mimeType };
}

function stableBlobUrlKey(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly mediaId: string;
  readonly tierLabel: string;
}): string {
  return `${params.organizationId}:${params.workflowId}:${params.mediaId}:${params.tierLabel}`;
}

export interface CanvasTierUrlSet {
  readonly s: string;
  readonly m: string;
  readonly l: string;
}

function stableUrlForCanvasTierWidth(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly mediaId: string;
  readonly width: number;
}): string | null {
  return getStableBlobUrl(
    stableBlobUrlKey({
      organizationId: params.organizationId,
      workflowId: params.workflowId,
      mediaId: params.mediaId,
      tierLabel: `w${params.width}`,
    })
  );
}

export function getStableCanvasTierUrlSet(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly mediaId: string;
}): CanvasTierUrlSet | null {
  const s = stableUrlForCanvasTierWidth({
    ...params,
    width: CANVAS_TIER_SHORT_EDGE.s,
  });
  const m = stableUrlForCanvasTierWidth({
    ...params,
    width: CANVAS_TIER_SHORT_EDGE.m,
  });
  const l = stableUrlForCanvasTierWidth({
    ...params,
    width: CANVAS_TIER_SHORT_EDGE.l,
  });
  if (!s || !m || !l) {
    return null;
  }
  return { s, m, l };
}

export async function getCanvasTierUrlSet(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly mediaId: string;
}): Promise<CanvasTierUrlSet | null> {
  const stable = getStableCanvasTierUrlSet(params);
  if (stable) {
    return stable;
  }

  return withDatabase(async (db) => {
    const entry = await readCachedMediaEntry(db, params);
    if (!entry) return null;
    if (entry.nodeType !== "ai-image" && entry.nodeType !== "ai-video") {
      return null;
    }

    const tierUrls: Partial<CanvasTierUrlSet> = {};
    const widths = {
      s: CANVAS_TIER_SHORT_EDGE.s,
      m: CANVAS_TIER_SHORT_EDGE.m,
      l: CANVAS_TIER_SHORT_EDGE.l,
    } as const;

    for (const [tier, width] of Object.entries(widths) as Array<
      [keyof CanvasTierUrlSet, number]
    >) {
      const tierKey = stableBlobUrlKey({
        organizationId: params.organizationId,
        workflowId: params.workflowId,
        mediaId: params.mediaId,
        tierLabel: `w${width}`,
      });
      const tierBlob = await readTierBlob(db, entry, width);
      if (!tierBlob) {
        return null;
      }
      tierUrls[tier] = createStableBlobUrl(tierKey, tierBlob);
    }

    return tierUrls as CanvasTierUrlSet;
  });
}

export function pickCanvasTierUrl(
  set: CanvasTierUrlSet,
  size: "canvas-s" | "canvas-m" | "canvas-l"
): string {
  if (size === "canvas-s") return set.s;
  if (size === "canvas-m") return set.m;
  return set.l;
}

export function getStableCachedMediaBlobUrl(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly mediaId: string;
  readonly size?: MediaDisplaySize;
}): string | null {
  const tierMaxWidth = params.size ? displaySizeToMaxWidth(params.size) : null;

  if (tierMaxWidth !== null) {
    const set = getStableCanvasTierUrlSet(params);
    if (!set) {
      return null;
    }
    if (params.size === "canvas-m") {
      return set.m;
    }
    if (params.size === "canvas-l") {
      return set.l;
    }
    return set.s;
  }

  return getStableBlobUrl(
    stableBlobUrlKey({
      organizationId: params.organizationId,
      workflowId: params.workflowId,
      mediaId: params.mediaId,
      tierLabel: "full",
    })
  );
}

export async function getCachedMediaBlobUrl(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly mediaId: string;
  readonly size?: MediaDisplaySize;
}): Promise<string | null> {
  const tierMaxWidth = params.size ? displaySizeToMaxWidth(params.size) : null;

  if (tierMaxWidth !== null) {
    const set = await getCanvasTierUrlSet(params);
    if (!set) {
      return null;
    }
    if (params.size === "canvas-m") {
      return set.m;
    }
    if (params.size === "canvas-l") {
      return set.l;
    }
    return set.s;
  }

  const stable = getStableBlobUrl(
    stableBlobUrlKey({
      organizationId: params.organizationId,
      workflowId: params.workflowId,
      mediaId: params.mediaId,
      tierLabel: "full",
    })
  );
  if (stable) {
    return stable;
  }

  return withDatabase(async (db) => {
    const entry = await readCachedMediaEntry(db, params);
    if (!entry) return null;

    const fullKey = stableBlobUrlKey({
      organizationId: params.organizationId,
      workflowId: params.workflowId,
      mediaId: params.mediaId,
      tierLabel: "full",
    });
    return createStableBlobUrl(fullKey, entry.blob);
  });
}

export async function getCachedMediaNaturalSize(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly mediaId: string;
}): Promise<{ readonly width: number; readonly height: number } | null> {
  return withDatabase(async (db) => {
    const entry = await readCachedMediaEntry(db, params);
    if (
      !entry?.naturalWidth ||
      !entry.naturalHeight ||
      entry.naturalWidth <= 0 ||
      entry.naturalHeight <= 0
    ) {
      return null;
    }
    return {
      width: entry.naturalWidth,
      height: entry.naturalHeight,
    };
  });
}

export async function clearAiMediaCache(params: {
  readonly organizationId: string;
  readonly workflowIds?: readonly string[];
}): Promise<void> {
  await withDatabase(async (db) => {
    const entries = await readAllEntries(db);

    const workflowFilter =
      params.workflowIds && params.workflowIds.length > 0
        ? new Set(params.workflowIds)
        : null;

    const keysToDelete = entries
      .filter((entry) => {
        if (entry.organizationId !== params.organizationId) return false;
        if (!workflowFilter) return true;
        return workflowFilter.has(entry.workflowId);
      })
      .map((entry) => entry.key);

    if (keysToDelete.length === 0) return;

    await runTransaction(db, cacheWriteStoreNames(db), "readwrite", (transaction) => {
      const entriesStore = transaction.objectStore(ENTRIES_STORE);
      for (const key of keysToDelete) {
        entriesStore.delete(key);
      }

      if (db.objectStoreNames.contains(THUMBS_STORE)) {
        const thumbsStore = transaction.objectStore(THUMBS_STORE);
        for (const key of keysToDelete) {
          deleteEntryThumbs(thumbsStore, key);
        }
      }
    });

    await reconcileCacheMeta(db);
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

function toEntrySummary(entry: AiMediaCacheEntry): AiMediaCacheEntrySummary {
  return {
    key: entry.key,
    organizationId: entry.organizationId,
    workflowId: entry.workflowId,
    workflowName: entry.workflowName,
    mediaId: entry.mediaId,
    nodeType: entry.nodeType,
    mimeType: entry.mimeType,
    byteSize: entry.byteSize,
    createdAt: entry.createdAt,
    lastAccessAt: entry.lastAccessAt,
  };
}

function mimeToExtension(
  mimeType: string,
  nodeType: "ai-image" | "ai-video" | "ai-audio"
): string {
  const base = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
  };
  if (nodeType === "ai-video") return map[base] ?? "mp4";
  if (nodeType === "ai-audio") return map[base] ?? "mp3";
  return map[base] ?? "png";
}

export function cacheEntryDownloadFilename(
  entry: Pick<AiMediaCacheEntrySummary, "mediaId" | "nodeType" | "mimeType">,
  index: number
): string {
  const ext = mimeToExtension(entry.mimeType, entry.nodeType);
  const prefix =
    entry.nodeType === "ai-video"
      ? "video"
      : entry.nodeType === "ai-audio"
        ? "audio"
        : "image";
  const idPart = entry.mediaId.slice(0, 8);
  return `${prefix}-${idPart}-${index + 1}.${ext}`;
}

export async function listOrganizationCacheEntries(
  organizationId: string
): Promise<readonly AiMediaCacheEntrySummary[]> {
  return withDatabase(async (db) => {
    const entries = await readAllEntries(db);
    return entries
      .filter((entry) => entry.organizationId === organizationId)
      .sort((a, b) => b.lastAccessAt.localeCompare(a.lastAccessAt))
      .map(toEntrySummary);
  });
}

export async function listWorkflowCacheResources(params: {
  readonly organizationId: string;
  readonly workflowId: string;
}): Promise<readonly AiMediaCacheResourceSummary[]> {
  return withDatabase(async (db) => {
    const entries = (await readAllEntries(db)).filter(
      (entry) =>
        entry.organizationId === params.organizationId &&
        entry.workflowId === params.workflowId
    );
    const thumbs = await readAllThumbs(db);
    const thumbsByParent = new Map<string, ThumbRecord[]>();

    for (const thumb of thumbs) {
      const parentKey = thumb.parentEntryKey ?? parseThumbParentEntryKey(thumb.key);
      if (!parentKey) continue;
      const bucket = thumbsByParent.get(parentKey) ?? [];
      bucket.push(thumb);
      thumbsByParent.set(parentKey, bucket);
    }

    return entries
      .map((entry) => {
        const entryThumbs = thumbsByParent.get(entry.key) ?? [];
        const tierSummaries: AiMediaCacheTierSummary[] = entryThumbs
          .map((thumb) => ({
            tier: thumb.tier ?? maxWidthToTierKind(thumb.maxWidth ?? CANVAS_TIER_SHORT_EDGE.s),
            maxWidth: thumb.maxWidth ?? CANVAS_TIER_SHORT_EDGE.s,
            byteSize: thumb.byteSize,
          }))
          .sort((a, b) => a.maxWidth - b.maxWidth);
        const thumbBytes = tierSummaries.reduce((sum, tier) => sum + tier.byteSize, 0);

        return {
          entryKey: entry.key,
          mediaId: entry.mediaId,
          nodeType: entry.nodeType,
          mimeType: entry.mimeType,
          originalBytes: entry.byteSize,
          thumbBytes,
          totalBytes: entry.byteSize + thumbBytes,
          tiers: tierSummaries,
          createdAt: entry.createdAt,
          lastAccessAt: entry.lastAccessAt,
        };
      })
      .sort((a, b) => b.lastAccessAt.localeCompare(a.lastAccessAt));
  });
}

export async function getCacheResourcePreviewUrl(
  entryKey: string
): Promise<string | null> {
  return withDatabase(async (db) => {
    const entryReadTx = db.transaction(ENTRIES_STORE, "readonly");
    const entry = await idbRequest<CacheEntryRecord | undefined>(
      entryReadTx.objectStore(ENTRIES_STORE).get(entryKey)
    );
    if (!entry) return null;

    const preview =
      (await readTierBlob(db, entry, 200)) ??
      (await readTierBlob(db, entry, 400)) ??
      entry.blob;
    const stableKey = `${entryKey}:preview`;
    return createStableBlobUrl(stableKey, preview);
  });
}

export async function clearCacheEntriesByKeys(
  keys: readonly string[]
): Promise<void> {
  if (keys.length === 0) return;

  await withDatabase(async (db) => {
    for (const key of keys) {
      await deleteEntry(db, key);
    }
    await reconcileCacheMeta(db);
  });
}

export async function downloadCacheEntriesByKeys(
  keys: readonly string[]
): Promise<number> {
  if (keys.length === 0) return 0;

  return withDatabase(async (db) => {
    const entries = await readAllEntries(db);
    const keySet = new Set(keys);
    const selected = entries.filter((entry) => keySet.has(entry.key));

    for (let index = 0; index < selected.length; index += 1) {
      const entry = selected[index]!;
      const summary = toEntrySummary(entry);
      const url = URL.createObjectURL(entry.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = cacheEntryDownloadFilename(summary, index);
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);

      if (index < selected.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 120));
      }
    }

    return selected.length;
  });
}

async function migrateEntryThumbs(
  db: IDBDatabase,
  fromEntryKey: string,
  toEntryKey: string
): Promise<void> {
  if (!db.objectStoreNames.contains(THUMBS_STORE)) return;
  if (fromEntryKey === toEntryKey) return;

  const legacyTo = await readThumbBlob(db, toEntryKey);
  if (!legacyTo) {
    const legacyFrom = await readThumbBlob(db, fromEntryKey);
    if (legacyFrom) {
      await storeThumb(db, {
        key: toEntryKey,
        parentEntryKey: toEntryKey,
        tier: "thumb",
        maxWidth: LEGACY_CANVAS_S_THUMB_WIDTH,
        blob: legacyFrom,
      });
    }
  }

  for (const maxWidth of TIER_THUMB_MAX_WIDTHS) {
    const fromTierKey = tierCacheKey(fromEntryKey, maxWidth);
    const toTierKey = tierCacheKey(toEntryKey, maxWidth);
    const existingTo = await readThumbBlob(db, toTierKey);
    if (existingTo) continue;
    const fromThumb = await readThumbBlob(db, fromTierKey);
    if (fromThumb) {
      await storeThumb(db, {
        key: toTierKey,
        parentEntryKey: toEntryKey,
        tier: maxWidthToTierKind(maxWidth),
        maxWidth,
        blob: fromThumb,
      });
    }
  }
}

/**
 * Merge duplicate cache rows after cloud upload rekeys a local staging mediaId
 * to its canonical storageKey id. Keeps the target entry and drops the alias.
 */
export async function rekeyCacheEntry(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly fromMediaId: string;
  readonly toMediaId: string;
}): Promise<void> {
  if (params.fromMediaId === params.toMediaId) return;

  return withDatabase(async (db) => {
    const fromKey = entryKey(
      params.organizationId,
      params.workflowId,
      params.fromMediaId
    );
    const toKey = entryKey(
      params.organizationId,
      params.workflowId,
      params.toMediaId
    );

    const fromReadTx = db.transaction(ENTRIES_STORE, "readonly");
    const fromEntry = await idbRequest<CacheEntryRecord | undefined>(
      fromReadTx.objectStore(ENTRIES_STORE).get(fromKey)
    );
    if (!fromEntry) return;

    const toReadTx = db.transaction(ENTRIES_STORE, "readonly");
    const toEntry = await idbRequest<CacheEntryRecord | undefined>(
      toReadTx.objectStore(ENTRIES_STORE).get(toKey)
    );

    if (toEntry) {
      await migrateEntryThumbs(db, fromKey, toKey);
      await deleteEntry(db, fromKey);
      recordMediaResourceAlias({
        organizationId: params.organizationId,
        workflowId: params.workflowId,
        fromMediaId: params.fromMediaId,
        toMediaId: params.toMediaId,
      });
      return;
    }

    await migrateEntryThumbs(db, fromKey, toKey);

    const now = new Date().toISOString();
    const record: CacheEntryRecord = {
      ...fromEntry,
      key: toKey,
      mediaId: params.toMediaId,
      lastAccessAt: now,
    };

    await runTransaction(db, cacheWriteStoreNames(db), "readwrite", (transaction) => {
      transaction.objectStore(ENTRIES_STORE).put(record);
      transaction.objectStore(ENTRIES_STORE).delete(fromKey);
      if (db.objectStoreNames.contains(THUMBS_STORE)) {
        deleteEntryThumbs(transaction.objectStore(THUMBS_STORE), fromKey);
      }
    });

    await reconcileCacheMeta(db);

    dropStableBlobUrlsForMediaId(params.fromMediaId);
    recordMediaResourceAlias({
      organizationId: params.organizationId,
      workflowId: params.workflowId,
      fromMediaId: params.fromMediaId,
      toMediaId: params.toMediaId,
    });
  });
}

export async function downloadCacheForWorkflows(params: {
  readonly organizationId: string;
  readonly workflowIds: readonly string[];
}): Promise<number> {
  if (params.workflowIds.length === 0) return 0;

  return withDatabase(async (db) => {
    const workflowFilter = new Set(params.workflowIds);
    const entries = (await readAllEntries(db)).filter(
      (entry) =>
        entry.organizationId === params.organizationId &&
        workflowFilter.has(entry.workflowId)
    );

    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index]!;
      const summary = toEntrySummary(entry);
      const url = URL.createObjectURL(entry.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = cacheEntryDownloadFilename(summary, index);
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);

      if (index < entries.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 120));
      }
    }

    return entries.length;
  });
}

async function readAllThumbs(db: IDBDatabase): Promise<ThumbRecord[]> {
  if (!db.objectStoreNames.contains(THUMBS_STORE)) return [];
  const transaction = db.transaction(THUMBS_STORE, "readonly");
  const rows = await idbRequest(transaction.objectStore(THUMBS_STORE).getAll());
  return (rows as ThumbRecord[]) ?? [];
}

function parseCacheEntryKeyParts(
  entryKeyValue: string
): { readonly organizationId: string; readonly workflowId: string; readonly mediaId: string } | null {
  const pipeIndex = entryKeyValue.indexOf("|w");
  const entryPart = pipeIndex >= 0 ? entryKeyValue.slice(0, pipeIndex) : entryKeyValue;
  const firstColon = entryPart.indexOf(":");
  const secondColon = entryPart.indexOf(":", firstColon + 1);
  if (firstColon < 0 || secondColon < 0) {
    return null;
  }
  return {
    organizationId: entryPart.slice(0, firstColon),
    workflowId: entryPart.slice(firstColon + 1, secondColon),
    mediaId: entryPart.slice(secondColon + 1),
  };
}

/** Rebuild local UUID → cloud storageKey aliases from orphan thumbs + cache entries. */
export async function rebuildMediaResourceAliasesFromCache(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly localHints?: readonly {
    readonly mediaId: string;
    readonly mimeType: string;
    readonly nodeType: "ai-image" | "ai-video" | "ai-audio";
  }[];
}): Promise<void> {
  return withDatabase(async (db) => {
    const entries = (await readAllEntries(db)).filter(
      (entry) =>
        entry.organizationId === params.organizationId &&
        entry.workflowId === params.workflowId
    );
    const entryIds = new Set(entries.map((entry) => entry.mediaId));
    const cloudEntries = entries.filter((entry) => entry.mediaId.includes("/"));

    const hintIds = new Set(
      (params.localHints ?? []).map((hint) => hint.mediaId)
    );

    const orphanLocalIds = new Set<string>();
    if (params.localHints) {
      for (const hint of params.localHints) {
        if (!entryIds.has(hint.mediaId)) {
          orphanLocalIds.add(hint.mediaId);
        }
      }
    }

    const thumbs = await readAllThumbs(db);
    for (const thumb of thumbs) {
      const parts = parseCacheEntryKeyParts(thumb.key);
      if (
        !parts ||
        parts.organizationId !== params.organizationId ||
        parts.workflowId !== params.workflowId ||
        parts.mediaId.includes("/") ||
        entryIds.has(parts.mediaId)
      ) {
        continue;
      }
      if (hintIds.size === 0 || hintIds.has(parts.mediaId)) {
        orphanLocalIds.add(parts.mediaId);
      }
    }

    for (const localMediaId of orphanLocalIds) {
      const hint = params.localHints?.find((entry) => entry.mediaId === localMediaId);
      const candidates = cloudEntries.filter((entry) => {
        if (hint) {
          return entry.mimeType === hint.mimeType && entry.nodeType === hint.nodeType;
        }
        return true;
      });
      if (candidates.length === 0) continue;

      let match = candidates[0]!;
      if (candidates.length > 1) {
        const uniqueByteSize = candidates.filter(
          (entry, index, list) =>
            list.findIndex((other) => other.byteSize === entry.byteSize) === index
        );
        const sized = candidates.filter(
          (entry) =>
            uniqueByteSize.filter((other) => other.byteSize === entry.byteSize)
              .length === 1
        );
        if (sized.length === 1) {
          match = sized[0]!;
        } else {
          continue;
        }
      }

      recordMediaResourceAlias({
        organizationId: params.organizationId,
        workflowId: params.workflowId,
        fromMediaId: localMediaId,
        toMediaId: match.mediaId,
      });
    }
  });
}
