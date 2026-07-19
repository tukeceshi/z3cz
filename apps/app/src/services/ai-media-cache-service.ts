import {
  AI_MEDIA_CACHE_DEFAULT_LIMIT_MB,
  AI_MEDIA_CACHE_MAX_LIMIT_MB,
  AI_MEDIA_CACHE_MIN_LIMIT_MB,
  type AiMediaCacheSettings,
  getMediaReferenceKey,
  type MediaReference,
} from "@dafthunk/types";

const DB_NAME = "dafthunk-ai-media-cache";
const DB_VERSION = 1;
const ENTRIES_STORE = "entries";
const WORKFLOWS_STORE = "workflows";
const META_STORE = "meta";
const META_KEY = "settings";

export interface AiMediaCacheEntry {
  readonly key: string;
  readonly organizationId: string;
  readonly workflowId: string;
  readonly workflowName: string;
  readonly mediaId: string;
  readonly nodeType: "ai-image" | "ai-video";
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
  readonly totalBytes: number;
  readonly updatedAt: string;
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

interface MetaRecord {
  readonly key: typeof META_KEY;
  enabled: boolean;
  limitMb: number;
  totalBytes: number;
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

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ENTRIES_STORE)) {
        const store = db.createObjectStore(ENTRIES_STORE, { keyPath: "key" });
        store.createIndex("workflow", "workflowId", { unique: false });
        store.createIndex("lastAccessAt", "lastAccessAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(WORKFLOWS_STORE)) {
        db.createObjectStore(WORKFLOWS_STORE, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: "key" });
      }
    };
  });
}

function tx<T>(
  db: IDBDatabase,
  storeNames: string | string[],
  mode: IDBTransactionMode,
  fn: (tx: IDBTransaction) => Promise<T> | T
): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeNames, mode);
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
    Promise.resolve(fn(transaction))
      .then(resolve)
      .catch(reject);
  });
}

function getStore<T>(
  transaction: IDBTransaction,
  name: string,
  mode: "readonly" | "readwrite"
): IDBObjectStore {
  return transaction.objectStore(name);
}

async function readMeta(db: IDBDatabase): Promise<MetaRecord> {
  return tx(db, META_STORE, "readonly", (transaction) => {
    return new Promise<MetaRecord>((resolve, reject) => {
      const request = getStore(transaction, META_STORE, "readonly").get(META_KEY);
      request.onsuccess = () => resolve((request.result as MetaRecord) ?? defaultMeta());
      request.onerror = () => reject(request.error);
    });
  });
}

async function writeMeta(db: IDBDatabase, meta: MetaRecord): Promise<void> {
  await tx(db, META_STORE, "readwrite", (transaction) => {
    getStore(transaction, META_STORE, "readwrite").put(meta);
  });
}

async function readWorkflowSummaries(
  db: IDBDatabase,
  organizationId: string
): Promise<AiMediaWorkflowSummary[]> {
  return tx(db, WORKFLOWS_STORE, "readonly", (transaction) => {
    return new Promise((resolve, reject) => {
      const store = getStore(transaction, WORKFLOWS_STORE, "readonly");
      const request = store.getAll();
      request.onsuccess = () => {
        const rows = (request.result as Array<
          AiMediaWorkflowSummary & { key: string }
        >).filter((row) => row.organizationId === organizationId);
        resolve(
          rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        );
      };
      request.onerror = () => reject(request.error);
    });
  });
}

async function evictLruUntilUnderLimit(
  db: IDBDatabase,
  limitBytes: number
): Promise<void> {
  let meta = await readMeta(db);
  if (meta.totalBytes <= limitBytes) return;

  const entries = await tx(db, ENTRIES_STORE, "readonly", (transaction) => {
    return new Promise<CacheEntryRecord[]>((resolve, reject) => {
      const request = getStore(transaction, ENTRIES_STORE, "readonly").getAll();
      request.onsuccess = () =>
        resolve((request.result as CacheEntryRecord[]) ?? []);
      request.onerror = () => reject(request.error);
    });
  });

  entries.sort((a, b) => a.lastAccessAt.localeCompare(b.lastAccessAt));

  for (const entry of entries) {
    if (meta.totalBytes <= limitBytes) break;
    await deleteEntry(db, entry.key);
    meta = await readMeta(db);
  }
}

async function deleteEntry(db: IDBDatabase, key: string): Promise<void> {
  const entry = await tx(db, ENTRIES_STORE, "readonly", (transaction) => {
    return new Promise<CacheEntryRecord | null>((resolve, reject) => {
      const request = getStore(transaction, ENTRIES_STORE, "readonly").get(key);
      request.onsuccess = () =>
        resolve((request.result as CacheEntryRecord | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
  });

  if (!entry) return;

  await tx(db, [ENTRIES_STORE, WORKFLOWS_STORE, META_STORE], "readwrite", async (transaction) => {
    getStore(transaction, ENTRIES_STORE, "readwrite").delete(key);

    const wfKey = `${entry.organizationId}:${entry.workflowId}`;
    const wfStore = getStore(transaction, WORKFLOWS_STORE, "readwrite");
    const wfRequest = wfStore.get(wfKey);

    await new Promise<void>((resolve, reject) => {
      wfRequest.onsuccess = () => {
        const summary = wfRequest.result as
          | (AiMediaWorkflowSummary & { key: string })
          | undefined;
        if (!summary) {
          resolve();
          return;
        }

        const isVideo = entry.nodeType === "ai-video";
        const next: AiMediaWorkflowSummary & { key: string } = {
          ...summary,
          imageCount: summary.imageCount - (isVideo ? 0 : 1),
          videoCount: summary.videoCount - (isVideo ? 1 : 0),
          totalBytes: Math.max(0, summary.totalBytes - entry.byteSize),
          updatedAt: new Date().toISOString(),
        };

        if (next.imageCount <= 0 && next.videoCount <= 0 && next.totalBytes <= 0) {
          wfStore.delete(wfKey);
        } else {
          wfStore.put(next);
        }
        resolve();
      };
      wfRequest.onerror = () => reject(wfRequest.error);
    });

    const metaStore = getStore(transaction, META_STORE, "readwrite");
    const metaRequest = metaStore.get(META_KEY);
    await new Promise<void>((resolve, reject) => {
      metaRequest.onsuccess = () => {
        const meta = (metaRequest.result as MetaRecord) ?? defaultMeta();
        metaStore.put({
          ...meta,
          totalBytes: Math.max(0, meta.totalBytes - entry.byteSize),
        });
        resolve();
      };
      metaRequest.onerror = () => reject(metaRequest.error);
    });
  });
}

export async function getAiMediaCacheSettings(): Promise<AiMediaCacheSettings> {
  const db = await openDatabase();
  try {
    const meta = await readMeta(db);
    return { enabled: meta.enabled, limitMb: meta.limitMb };
  } finally {
    db.close();
  }
}

export async function setAiMediaCacheSettings(
  settings: Partial<AiMediaCacheSettings>
): Promise<AiMediaCacheSettings> {
  const db = await openDatabase();
  try {
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
  } finally {
    db.close();
  }
}

export async function getAiMediaCacheStats(
  organizationId: string
): Promise<AiMediaCacheStats> {
  const db = await openDatabase();
  try {
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
  } finally {
    db.close();
  }
}

export async function cacheMediaFromUrl(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly workflowName: string;
  readonly media: MediaReference;
  readonly nodeType: "ai-image" | "ai-video";
  readonly fetchUrl: string;
}): Promise<void> {
  const settings = await getAiMediaCacheSettings();
  if (!settings.enabled) return;

  const mediaId = getMediaReferenceKey(params.media);

  const response = await fetch(params.fetchUrl);
  if (!response.ok) return;

  const blob = await response.blob();
  const mimeType =
    params.media.mimeType ||
    blob.type ||
    (params.nodeType === "ai-video" ? "video/mp4" : "image/jpeg");
  const byteSize = blob.size;
  const now = new Date().toISOString();
  const key = entryKey(params.organizationId, params.workflowId, mediaId);

  const db = await openDatabase();
  try {
    const record: CacheEntryRecord = {
      key,
      organizationId: params.organizationId,
      workflowId: params.workflowId,
      workflowName: params.workflowName,
      mediaId,
      nodeType: params.nodeType,
      mimeType,
      byteSize,
      createdAt: now,
      lastAccessAt: now,
      blob,
    };

    const existing = await tx(db, ENTRIES_STORE, "readonly", (transaction) => {
      return new Promise<CacheEntryRecord | null>((resolve, reject) => {
        const request = getStore(transaction, ENTRIES_STORE, "readonly").get(key);
        request.onsuccess = () =>
          resolve((request.result as CacheEntryRecord | undefined) ?? null);
        request.onerror = () => reject(request.error);
      });
    });

    await tx(db, [ENTRIES_STORE, WORKFLOWS_STORE, META_STORE], "readwrite", async (transaction) => {
      getStore(transaction, ENTRIES_STORE, "readwrite").put(record);

      const wfKey = `${params.organizationId}:${params.workflowId}`;
      const wfStore = getStore(transaction, WORKFLOWS_STORE, "readwrite");
      const wfRequest = wfStore.get(wfKey);

      await new Promise<void>((resolve, reject) => {
        wfRequest.onsuccess = () => {
          const prev = wfRequest.result as
            | (AiMediaWorkflowSummary & { key: string })
            | undefined;
          const isVideo = params.nodeType === "ai-video";
          const deltaBytes = existing ? byteSize - existing.byteSize : byteSize;
          const deltaImage = existing
            ? 0
            : isVideo
              ? 0
              : 1;
          const deltaVideo = existing ? 0 : isVideo ? 1 : 0;

          wfStore.put({
            key: wfKey,
            organizationId: params.organizationId,
            workflowId: params.workflowId,
            workflowName: params.workflowName,
            imageCount: (prev?.imageCount ?? 0) + deltaImage,
            videoCount: (prev?.videoCount ?? 0) + deltaVideo,
            totalBytes: Math.max(0, (prev?.totalBytes ?? 0) + deltaBytes),
            updatedAt: now,
          });
          resolve();
        };
        wfRequest.onerror = () => reject(wfRequest.error);
      });

      const metaStore = getStore(transaction, META_STORE, "readwrite");
      const metaRequest = metaStore.get(META_KEY);
      await new Promise<void>((resolve, reject) => {
        metaRequest.onsuccess = () => {
          const meta = (metaRequest.result as MetaRecord) ?? defaultMeta();
          const deltaBytes = existing ? byteSize - existing.byteSize : byteSize;
          metaStore.put({
            ...meta,
            totalBytes: Math.max(0, meta.totalBytes + deltaBytes),
          });
          resolve();
        };
        metaRequest.onerror = () => reject(metaRequest.error);
      });
    });

    const meta = await readMeta(db);
    await evictLruUntilUnderLimit(db, meta.limitMb * 1024 * 1024);
  } finally {
    db.close();
  }
}

export async function getCachedMediaBlobUrl(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly mediaId: string;
}): Promise<string | null> {
  const db = await openDatabase();
  try {
    const key = entryKey(params.organizationId, params.workflowId, params.mediaId);
    const entry = await tx(db, ENTRIES_STORE, "readonly", (transaction) => {
      return new Promise<CacheEntryRecord | null>((resolve, reject) => {
        const request = getStore(transaction, ENTRIES_STORE, "readonly").get(key);
        request.onsuccess = () =>
          resolve((request.result as CacheEntryRecord | undefined) ?? null);
        request.onerror = () => reject(request.error);
      });
    });

    if (!entry) return null;

    await tx(db, ENTRIES_STORE, "readwrite", (transaction) => {
      getStore(transaction, ENTRIES_STORE, "readwrite").put({
        ...entry,
        lastAccessAt: new Date().toISOString(),
      });
    });

    return URL.createObjectURL(entry.blob);
  } finally {
    db.close();
  }
}

export async function clearAiMediaCache(params: {
  readonly organizationId: string;
  readonly workflowIds?: readonly string[];
}): Promise<void> {
  const db = await openDatabase();
  try {
    const entries = await tx(db, ENTRIES_STORE, "readonly", (transaction) => {
      return new Promise<CacheEntryRecord[]>((resolve, reject) => {
        const request = getStore(transaction, ENTRIES_STORE, "readonly").getAll();
        request.onsuccess = () =>
          resolve((request.result as CacheEntryRecord[]) ?? []);
        request.onerror = () => reject(request.error);
      });
    });

    const workflowFilter =
      params.workflowIds && params.workflowIds.length > 0
        ? new Set(params.workflowIds)
        : null;

    const toDelete = entries.filter((entry) => {
      if (entry.organizationId !== params.organizationId) return false;
      if (!workflowFilter) return true;
      return workflowFilter.has(entry.workflowId);
    });

    for (const entry of toDelete) {
      await deleteEntry(db, entry.key);
    }
  } finally {
    db.close();
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}
