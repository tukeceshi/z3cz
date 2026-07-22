import { signTosRequest } from "./tos-sign";

export interface VolcengineTosCredentials {
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly region: string;
}

function buildTosRegionalEndpoint(region: string): string {
  return `https://tos-${region}.volces.com`;
}

function buildTosBucketEndpoint(region: string, bucket: string): string {
  return `https://${bucket}.tos-${region}.volces.com`;
}

function encodeObjectKeyPath(key: string): string {
  return key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function buildBucketObjectRequestPath(
  region: string,
  bucket: string,
  key: string
): { readonly endpoint: string; readonly path: string } {
  const objectPath = encodeObjectKeyPath(key);
  return {
    endpoint: buildTosBucketEndpoint(region, bucket),
    path: `/${objectPath}`,
  };
}

interface TosBucketEntry {
  readonly Name?: string;
  readonly Location?: string;
}

function parseBucketNamesFromListPayload(
  payload: string,
  region: string
): readonly string[] {
  const trimmed = payload.trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith("{")) {
    const parsed = JSON.parse(trimmed) as { Buckets?: TosBucketEntry[] };
    return (parsed.Buckets ?? [])
      .filter((entry) => !entry.Location || entry.Location === region)
      .map((entry) => entry.Name?.trim())
      .filter((name): name is string => Boolean(name));
  }

  const names: string[] = [];
  const regex = /<Name>([^<]+)<\/Name>/g;
  let match = regex.exec(trimmed);
  while (match) {
    names.push(match[1]!);
    match = regex.exec(trimmed);
  }
  return names;
}

function extensionForMimeType(mimeType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
  };
  return map[mimeType] ?? "";
}

export class VolcengineTosClient {
  private readonly credentials: VolcengineTosCredentials;
  private readonly endpoint: string;
  private readonly bucket: string | undefined;

  constructor(
    config: VolcengineTosCredentials & { readonly bucket?: string }
  ) {
    this.credentials = {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      region: config.region,
    };
    this.endpoint = buildTosRegionalEndpoint(config.region);
    this.bucket = config.bucket;
  }

  static forRegion(credentials: VolcengineTosCredentials): VolcengineTosClient {
    return new VolcengineTosClient(credentials);
  }

  private async signedFetch(params: {
    readonly method: string;
    readonly path: string;
    readonly endpoint?: string;
    readonly body?: Uint8Array;
    readonly contentType?: string;
  }): Promise<Response> {
    const endpoint = params.endpoint ?? this.endpoint;
    const signed = await signTosRequest({
      method: params.method,
      endpoint,
      path: params.path,
      accessKeyId: this.credentials.accessKeyId,
      secretAccessKey: this.credentials.secretAccessKey,
      region: this.credentials.region,
      body: params.body,
      contentType: params.contentType,
    });

    return fetch(signed.url, {
      method: params.method,
      headers: signed.headers,
      body: params.body,
    });
  }

  async listBuckets(): Promise<readonly string[]> {
    const response = await this.signedFetch({
      method: "GET",
      path: "/",
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `TOS list buckets failed (${response.status}): ${text.slice(0, 300)}`
      );
    }
    const payload = await response.text();
    return parseBucketNamesFromListPayload(payload, this.credentials.region);
  }

  async createBucket(bucket: string): Promise<void> {
    const response = await this.signedFetch({
      method: "PUT",
      path: `/${bucket}`,
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `TOS create bucket failed (${response.status}): ${text.slice(0, 300)}`
      );
    }
  }

  private requireBucket(): string {
    if (!this.bucket) {
      throw new Error("TOS bucket is required for this operation");
    }
    return this.bucket;
  }

  async putObject(params: {
    readonly key: string;
    readonly body: Uint8Array;
    readonly mimeType: string;
  }): Promise<void> {
    const bucket = this.requireBucket();
    const { endpoint, path } = buildBucketObjectRequestPath(
      this.credentials.region,
      bucket,
      params.key
    );
    const response = await this.signedFetch({
      method: "PUT",
      endpoint,
      path,
      body: params.body,
      contentType: params.mimeType,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `TOS upload failed (${response.status}): ${text.slice(0, 300)}`
      );
    }
  }

  async getObject(params: {
    readonly key: string;
  }): Promise<{ readonly data: Uint8Array; readonly mimeType: string }> {
    const bucket = this.requireBucket();
    const { endpoint, path } = buildBucketObjectRequestPath(
      this.credentials.region,
      bucket,
      params.key
    );
    const response = await this.signedFetch({
      method: "GET",
      endpoint,
      path,
    });

    if (!response.ok) {
      throw new Error(`TOS read failed (${response.status})`);
    }

    const mimeType =
      response.headers.get("content-type")?.split(";")[0]?.trim() ??
      "application/octet-stream";
    const data = new Uint8Array(await response.arrayBuffer());
    return { data, mimeType };
  }

  buildObjectKey(params: {
    readonly prefix: string;
    readonly workflowId: string;
    readonly mediaKind: "ai-image" | "ai-video";
    readonly objectId: string;
    readonly mimeType: string;
  }): string {
    const ext = extensionForMimeType(params.mimeType);
    const root = params.prefix.replace(/\/$/, "");
    return `${root}/workflows/wf_${params.workflowId}/${params.mediaKind}/${params.objectId}${ext}`;
  }

  async presignGetObjectUrl(params: {
    readonly key: string;
    readonly expiresInSeconds?: number;
  }): Promise<string> {
    const bucket = this.requireBucket();
    const { endpoint, path } = buildBucketObjectRequestPath(
      this.credentials.region,
      bucket,
      params.key
    );
    const { presignTosGetUrl } = await import("./tos-sign");
    return presignTosGetUrl({
      endpoint,
      path,
      accessKeyId: this.credentials.accessKeyId,
      secretAccessKey: this.credentials.secretAccessKey,
      region: this.credentials.region,
      expiresInSeconds: params.expiresInSeconds ?? 3600,
    });
  }

  async signPutObjectUpload(params: {
    readonly key: string;
    readonly mimeType: string;
    readonly contentLength: number;
  }): Promise<{ readonly url: string; readonly headers: Record<string, string> }> {
    const bucket = this.requireBucket();
    const { endpoint, path } = buildBucketObjectRequestPath(
      this.credentials.region,
      bucket,
      params.key
    );
    const { signTosPutObject } = await import("./tos-sign");
    const signed = await signTosPutObject({
      endpoint,
      path,
      accessKeyId: this.credentials.accessKeyId,
      secretAccessKey: this.credentials.secretAccessKey,
      region: this.credentials.region,
      mimeType: params.mimeType,
      contentLength: params.contentLength,
    });
    return { url: signed.url, headers: signed.headers };
  }
}

export {
  buildBucketObjectRequestPath,
  buildTosBucketEndpoint,
  buildTosRegionalEndpoint,
};
