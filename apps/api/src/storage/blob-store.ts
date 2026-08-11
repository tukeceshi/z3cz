export interface BlobGetResult {
  readonly body: Uint8Array;
  readonly contentType?: string;
  readonly customMetadata?: Readonly<Record<string, string>>;
}

export interface BlobPutOptions {
  readonly contentType?: string;
  readonly customMetadata?: Readonly<Record<string, string>>;
  readonly cacheControl?: string;
}

export interface BlobListedObject {
  readonly key: string;
  readonly size: number;
  readonly uploaded: Date;
  readonly contentType?: string;
  readonly customMetadata?: Readonly<Record<string, string>>;
}

export interface BlobListResult {
  readonly objects: readonly BlobListedObject[];
}

/**
 * Platform object storage — local filesystem in Node dev; key layout matches
 * former R2 paths (`workflows/…`, `executions/…`, `objects/…`).
 */
export interface BlobStore {
  get(key: string): Promise<BlobGetResult | null>;
  put(
    key: string,
    body: Uint8Array | string,
    options?: BlobPutOptions
  ): Promise<void>;
  delete(key: string | readonly string[]): Promise<void>;
  list(prefix: string): Promise<BlobListResult>;
}
