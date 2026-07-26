import {
  getCachedMediaBlob,
  readCachedMediaBlobByMediaId,
  writeGenerativeMediaCacheBlob,
} from "@/services/ai-media-cache-service";

const LEGACY_DB_NAME = "dafthunk-local-media-staging";
const LEGACY_DB_VERSION = 1;
const LEGACY_STORE_NAME = "blobs";

interface LegacyLocalMediaRecord {
  readonly mediaId: string;
  readonly mimeType: string;
  readonly blob: Blob;
  readonly createdAt: string;
}

const previewUrlCache = new Map<string, string>();
let legacyMigrationPromise: Promise<void> | null = null;

function inferNodeTypeFromMime(
  mimeType: string
): "ai-image" | "ai-video" | "ai-audio" {
  const mime = mimeType.toLowerCase();
  if (mime.startsWith("video/")) return "ai-video";
  if (mime.startsWith("audio/")) return "ai-audio";
  return "ai-image";
}

function rememberPreviewUrl(mediaId: string, blob: Blob): void {
  if (previewUrlCache.has(mediaId)) {
    return;
  }
  previewUrlCache.set(mediaId, URL.createObjectURL(blob));
}

export function getGenerativeStagingPreviewUrl(mediaId: string): string | null {
  return previewUrlCache.get(mediaId) ?? null;
}

export function createGenerativeStagingObjectUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

export async function writeGenerativeStaging(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly workflowName?: string;
  readonly mediaId: string;
  readonly blob: Blob;
  readonly mimeType: string;
  readonly nodeType: "ai-image" | "ai-video" | "ai-audio";
}): Promise<boolean> {
  const stored = await writeGenerativeMediaCacheBlob({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    workflowName: params.workflowName,
    mediaId: params.mediaId,
    blob: params.blob,
    mimeType: params.mimeType,
    nodeType: params.nodeType,
  });
  if (stored) {
    rememberPreviewUrl(params.mediaId, params.blob);
  }
  return stored;
}

export async function writeGenerativeStagingWithNewId(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly workflowName?: string;
  readonly blob: Blob;
  readonly mimeType: string;
  readonly nodeType: "ai-image" | "ai-video" | "ai-audio";
}): Promise<{ readonly mediaId: string; readonly mimeType: string }> {
  const mediaId = crypto.randomUUID();
  await writeGenerativeStaging({
    ...params,
    mediaId,
  });
  return { mediaId, mimeType: params.mimeType };
}

export async function readGenerativeStagingBlob(params: {
  readonly mediaId: string;
  readonly organizationId?: string;
  readonly workflowId?: string;
}): Promise<{ readonly blob: Blob; readonly mimeType: string } | null> {
  await migrateLegacyLocalMediaStagingOnce();

  if (params.organizationId && params.workflowId) {
    const blob = await getCachedMediaBlob({
      organizationId: params.organizationId,
      workflowId: params.workflowId,
      mediaId: params.mediaId,
    });
    if (blob) {
      rememberPreviewUrl(params.mediaId, blob);
      return {
        blob,
        mimeType: blob.type || "application/octet-stream",
      };
    }
  }

  const entry = await readCachedMediaBlobByMediaId(params.mediaId);
  if (entry) {
    rememberPreviewUrl(params.mediaId, entry.blob);
    return entry;
  }

  return null;
}

export async function readGenerativeStagingByMediaId(
  mediaId: string
): Promise<{ readonly blob: Blob; readonly mimeType: string } | null> {
  return readGenerativeStagingBlob({ mediaId });
}

export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Failed to read blob"));
        return;
      }
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("FileReader failed"));
    reader.readAsDataURL(blob);
  });
}

export async function readGenerativeStagingAsInline(
  mediaId: string
): Promise<{ readonly mimeType: string; readonly data: string } | null> {
  const entry = await readGenerativeStagingByMediaId(mediaId);
  if (!entry) return null;
  const data = await blobToBase64(entry.blob);
  return { mimeType: entry.mimeType, data };
}

function openLegacyDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LEGACY_DB_NAME, LEGACY_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(LEGACY_STORE_NAME)) {
        db.createObjectStore(LEGACY_STORE_NAME, { keyPath: "mediaId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Legacy IndexedDB open failed"));
  });
}

function readAllLegacyRecords(db: IDBDatabase): Promise<LegacyLocalMediaRecord[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LEGACY_STORE_NAME, "readonly");
    const request = tx.objectStore(LEGACY_STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result ?? []);
    request.onerror = () =>
      reject(request.error ?? new Error("Legacy IndexedDB read failed"));
  });
}

function clearLegacyRecords(db: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LEGACY_STORE_NAME, "readwrite");
    const request = tx.objectStore(LEGACY_STORE_NAME).clear();
    request.onsuccess = () => resolve();
    request.onerror = () =>
      reject(request.error ?? new Error("Legacy IndexedDB clear failed"));
  });
}

async function migrateLegacyLocalMediaStagingOnce(): Promise<void> {
  if (legacyMigrationPromise) {
    return legacyMigrationPromise;
  }

  legacyMigrationPromise = (async () => {
    let db: IDBDatabase;
    try {
      db = await openLegacyDb();
    } catch {
      return;
    }

    try {
      const records = await readAllLegacyRecords(db);
      if (records.length === 0) {
        return;
      }

      for (const record of records) {
        const nodeType = inferNodeTypeFromMime(record.mimeType);
        await writeGenerativeStaging({
          organizationId: "",
          workflowId: "legacy-migration",
          workflowName: "legacy-migration",
          mediaId: record.mediaId,
          blob: record.blob,
          mimeType: record.mimeType,
          nodeType,
        });
      }

      await clearLegacyRecords(db);
    } finally {
      db.close();
    }
  })();

  return legacyMigrationPromise;
}
