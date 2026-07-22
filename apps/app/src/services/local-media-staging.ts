const DB_NAME = "dafthunk-local-media-staging";
const DB_VERSION = 1;
const STORE_NAME = "blobs";

interface LocalMediaRecord {
  readonly mediaId: string;
  readonly mimeType: string;
  readonly blob: Blob;
  readonly createdAt: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "mediaId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
  });
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        const request = run(store);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () =>
          reject(request.error ?? new Error("IndexedDB request failed"));
        tx.oncomplete = () => db.close();
        tx.onerror = () => reject(tx.error ?? new Error("IndexedDB tx failed"));
      })
  );
}

const previewUrlCache = new Map<string, string>();

export function getCachedLocalMediaPreviewUrl(mediaId: string): string | null {
  return previewUrlCache.get(mediaId) ?? null;
}

export async function storeLocalMediaBlob(params: {
  readonly blob: Blob;
  readonly mimeType: string;
}): Promise<{ readonly mediaId: string; readonly mimeType: string }> {
  const mediaId = crypto.randomUUID();
  const record: LocalMediaRecord = {
    mediaId,
    mimeType: params.mimeType,
    blob: params.blob,
    createdAt: new Date().toISOString(),
  };
  await runTransaction("readwrite", (store) => store.put(record));
  previewUrlCache.set(mediaId, URL.createObjectURL(params.blob));
  return { mediaId, mimeType: params.mimeType };
}

export async function readLocalMediaBlob(
  mediaId: string
): Promise<{ readonly blob: Blob; readonly mimeType: string } | null> {
  const record = await runTransaction<LocalMediaRecord | undefined>("readonly", (store) =>
    store.get(mediaId)
  );
  if (!record) return null;
  return { blob: record.blob, mimeType: record.mimeType };
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

export async function readLocalMediaAsInline(
  mediaId: string
): Promise<{ readonly mimeType: string; readonly data: string } | null> {
  const entry = await readLocalMediaBlob(mediaId);
  if (!entry) return null;
  const data = await blobToBase64(entry.blob);
  return { mimeType: entry.mimeType, data };
}

export function createLocalMediaObjectUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}
