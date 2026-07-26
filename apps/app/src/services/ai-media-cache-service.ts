import {
  AI_MEDIA_CACHE_DEFAULT_LIMIT_MB,
  AI_MEDIA_CACHE_MAX_LIMIT_MB,
  AI_MEDIA_CACHE_MIN_LIMIT_MB,
  type AiMediaCacheSettings,
  getMediaReferenceKey,
  type MediaReference,
} from "@dafthunk/types";

import { generateImageThumbnail } from "@/services/generate-image-thumbnail";
import type { MediaDisplaySize } from "@/services/media-display-size";
import { mediaUrlSupportsBrowserCache } from "@/services/media-cache-fetch-utils";
import { resolveMediaCacheFetchUrl } from "@/services/media-object-url";

const DB_NAME = "dafthunk-ai-media-cache";
const DB_VERSION = 3;
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
  readonly createdAt: string;
  readonly lastAccessAt: string;
}

export interface AiMediaCacheStats {
  readonly totalBytes: number;
  readonly limitBytes: number;
  readonly enabled: boolean;
  readonly browserQuotaBytes: number | null;
  readonly browserUsageBytes: number | null;
  readonly workflows: readonly AiMediaWorkflowSummary[];
}

interface CacheEntryRecord extends AiMediaCacheEntry {
  blob: Blob;
}

interface ThumbRecord {
  readonly key: string;
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
    return await fn(db);
  } finally {
    db.close();
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

/** Rebuild workflow summaries and meta.totalBytes from entry rows — heals partial clears. */
async function reconcileCacheMeta(db: IDBDatabase): Promise<void> {
  const entries = await readAllEntries(db);
  const workflowMap = new Map<string, WorkflowRecord>();
  let totalBytes = 0;

  for (const entry of entries) {
    totalBytes += entry.byteSize;
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

  const meta = await readMeta(db);

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

  const wfKey = workflowKey(entry.organizationId, entry.workflowId);
  const wfReadTx = db.transaction(WORKFLOWS_STORE, "readonly");
  const summary = await idbRequest<WorkflowRecord | undefined>(
    wfReadTx.objectStore(WORKFLOWS_STORE).get(wfKey)
  );
  const meta = await readMeta(db);

  await runTransaction(db, cacheWriteStoreNames(db), "readwrite", (transaction) => {
    transaction.objectStore(ENTRIES_STORE).delete(key);
    if (db.objectStoreNames.contains(THUMBS_STORE)) {
      transaction.objectStore(THUMBS_STORE).delete(key);
    }

    if (summary) {
      const entryCount =
        summary.entryCount ??
        summary.imageCount + summary.videoCount + (summary.audioCount ?? 0);
      const counts = applyCountDelta(
        {
          imageCount: summary.imageCount,
          videoCount: summary.videoCount,
          audioCount: summary.audioCount ?? 0,
          entryCount,
        },
        entry.nodeType,
        -1
      );
      const next: WorkflowRecord = {
        ...summary,
        ...counts,
        totalBytes: Math.max(0, summary.totalBytes - entry.byteSize),
        updatedAt: new Date().toISOString(),
      };

      const wfStore = transaction.objectStore(WORKFLOWS_STORE);
      if (next.entryCount <= 0 || next.totalBytes <= 0) {
        wfStore.delete(wfKey);
      } else {
        wfStore.put(next);
      }
    }

    transaction.objectStore(META_STORE).put({
      ...meta,
      totalBytes: Math.max(0, meta.totalBytes - entry.byteSize),
    });
  });
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

async function storeThumb(db: IDBDatabase, key: string, blob: Blob): Promise<void> {
  if (!db.objectStoreNames.contains(THUMBS_STORE)) return;

  const record: ThumbRecord = { key, blob, byteSize: blob.size };
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

async function getOrCreateThumbBlob(
  db: IDBDatabase,
  entry: CacheEntryRecord
): Promise<Blob | null> {
  const existing = await readThumbBlob(db, entry.key);
  if (existing) return existing;

  if (entry.nodeType !== "ai-image") return null;

  const thumb = await generateImageThumbnail(entry.blob, entry.mimeType);
  if (!thumb || thumb.size <= 0) return null;

  await storeThumb(db, entry.key, thumb);
  return thumb;
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

    const record: CacheEntryRecord = {
      key,
      organizationId: params.organizationId,
      workflowId: params.workflowId,
      workflowName: params.workflowName,
      mediaId: params.mediaId,
      nodeType: params.nodeType,
      mimeType: params.mimeType,
      byteSize,
      createdAt: existing?.createdAt ?? now,
      lastAccessAt: now,
      blob: storedBlob,
    };

    const wfKey = workflowKey(params.organizationId, params.workflowId);
    const wfReadTx = db.transaction(WORKFLOWS_STORE, "readonly");
    const prev = await idbRequest<WorkflowRecord | undefined>(
      wfReadTx.objectStore(WORKFLOWS_STORE).get(wfKey)
    );
    const meta = await readMeta(db);
    const deltaBytes = existing ? byteSize - existing.byteSize : byteSize;
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
      [ENTRIES_STORE, WORKFLOWS_STORE, META_STORE],
      "readwrite",
      (transaction) => {
        transaction.objectStore(ENTRIES_STORE).put(record);
        transaction.objectStore(WORKFLOWS_STORE).put({
          key: wfKey,
          organizationId: params.organizationId,
          workflowId: params.workflowId,
          workflowName: params.workflowName,
          ...counts,
          totalBytes: Math.max(0, (prev?.totalBytes ?? 0) + deltaBytes),
          updatedAt: now,
        });
        transaction.objectStore(META_STORE).put({
          ...meta,
          totalBytes: Math.max(0, meta.totalBytes + deltaBytes),
        });
      }
    );

    if (params.nodeType === "ai-image") {
      const thumb = await generateImageThumbnail(storedBlob, params.mimeType);
      if (thumb && thumb.size > 0) {
        await storeThumb(db, key, thumb);
      }
    }

    const metaAfterWrite = await readMeta(db);
    await evictLruUntilUnderLimit(db, metaAfterWrite.limitMb * 1024 * 1024);
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
}): Promise<boolean> {
  const settings = await getAiMediaCacheSettings();
  if (!settings.enabled) return false;

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

export async function getCachedMediaBlobUrl(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly mediaId: string;
  readonly size?: MediaDisplaySize;
}): Promise<string | null> {
  return withDatabase(async (db) => {
    const entry = await readCachedMediaEntry(db, params);
    if (!entry) return null;

    if (params.size === "thumb") {
      const thumbBlob = await getOrCreateThumbBlob(db, entry);
      if (thumbBlob) {
        return URL.createObjectURL(thumbBlob);
      }
    }

    return URL.createObjectURL(entry.blob);
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
          thumbsStore.delete(key);
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
