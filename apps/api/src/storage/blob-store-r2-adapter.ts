import type { BlobStore } from "./blob-store";

/**
 * Adapts BlobStore to the Cloudflare R2Bucket shape so existing stores and
 * ObjectStore implementations keep working on the Node runtime.
 */
export function createR2BucketFromBlobStore(store: BlobStore): R2Bucket {
  return {
    async head(key: string): Promise<R2Object | null> {
      const listed = await store.list(key);
      const match = listed.objects.find((entry) => entry.key === key);
      if (!match) {
        return null;
      }
      return toR2Object(match);
    },

    async get(key: string): Promise<R2ObjectBody | null> {
      const result = await store.get(key);
      if (!result) {
        return null;
      }
      const body = result.body;
      return {
        key,
        version: "local",
        size: body.byteLength,
        etag: `"${body.byteLength}"`,
        httpEtag: `"${body.byteLength}"`,
        checksums: {},
        uploaded: new Date(),
        httpMetadata: result.contentType
          ? { contentType: result.contentType }
          : {},
        customMetadata: result.customMetadata ?? {},
        range: undefined,
        arrayBuffer: async () =>
          body.buffer.slice(
            body.byteOffset,
            body.byteOffset + body.byteLength
          ) as ArrayBuffer,
        text: async () => new TextDecoder().decode(body),
        json: async () => JSON.parse(new TextDecoder().decode(body)) as object,
        blob: async () =>
          new Blob([body], { type: result.contentType ?? "application/octet-stream" }),
      } as R2ObjectBody;
    },

    async put(
      key: string,
      data: string | ArrayBuffer | Uint8Array | ReadableStream | Blob | null,
      options?: R2PutOptions
    ): Promise<R2Object | null> {
      if (data === null) {
        await store.delete(key);
        return null;
      }
      if (data instanceof ReadableStream || data instanceof Blob) {
        throw new Error("BlobStore R2 adapter does not support stream uploads");
      }
      const bytes =
        typeof data === "string"
          ? new TextEncoder().encode(data)
          : data instanceof ArrayBuffer
            ? new Uint8Array(data)
            : data;
      await store.put(key, bytes, {
        contentType: options?.httpMetadata?.contentType,
        cacheControl: options?.httpMetadata?.cacheControl,
        customMetadata: options?.customMetadata,
      });
      return {
        key,
        version: "local",
        size: bytes.byteLength,
        etag: `"${bytes.byteLength}"`,
        httpEtag: `"${bytes.byteLength}"`,
        checksums: {},
        uploaded: new Date(),
        httpMetadata: options?.httpMetadata ?? {},
        customMetadata: options?.customMetadata ?? {},
      };
    },

    async delete(keys: string | string[]): Promise<void> {
      await store.delete(keys);
    },

    async list(options?: R2ListOptions): Promise<R2Objects> {
      const prefix = options?.prefix ?? "";
      const result = await store.list(prefix);
      return {
        objects: result.objects.map(toR2Object),
        truncated: false,
        delimitedPrefixes: [],
      };
    },
  } as R2Bucket;
}

function toR2Object(entry: {
  readonly key: string;
  readonly size: number;
  readonly uploaded: Date;
  readonly contentType?: string;
  readonly customMetadata?: Readonly<Record<string, string>>;
}): R2Object {
  return {
    key: entry.key,
    version: "local",
    size: entry.size,
    etag: `"${entry.size}"`,
    httpEtag: `"${entry.size}"`,
    checksums: {},
    uploaded: entry.uploaded,
    httpMetadata: entry.contentType ? { contentType: entry.contentType } : {},
    customMetadata: entry.customMetadata ?? {},
  };
}
