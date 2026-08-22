import { AwsClient } from "aws4fetch";

export const BOOTSTRAP_REMOTE_MANIFEST_KEY = "bootstrap-manifest.json";

export interface BootstrapR2Credentials {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
}

export function buildR2Endpoint(credentials: BootstrapR2Credentials): string {
  return `https://${credentials.accountId.trim()}.r2.cloudflarestorage.com`;
}

function buildR2ObjectUrl(
  credentials: BootstrapR2Credentials,
  key: string
): string {
  const encodedKey = key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${buildR2Endpoint(credentials)}/${credentials.bucketName.trim()}/${encodedKey}`;
}

export function createAwsClient(
  credentials: BootstrapR2Credentials
): AwsClient {
  return new AwsClient({
    accessKeyId: credentials.accessKeyId.trim(),
    secretAccessKey: credentials.secretAccessKey,
    service: "s3",
    region: "auto",
  });
}

export async function testBootstrapR2Connection(
  credentials: BootstrapR2Credentials
): Promise<void> {
  const client = createAwsClient(credentials);
  const url = `${buildR2Endpoint(credentials)}/${credentials.bucketName.trim()}?max-keys=1`;
  const response = await client.fetch(url, { method: "GET" });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      body.trim().length > 0
        ? `R2 connection failed (${response.status}): ${body}`
        : `R2 connection failed (${response.status})`
    );
  }
}

export function bootstrapR2ObjectName(assetPath: string): string {
  return assetPath.replace(/^\/assets\//, "").replace(/^\/+/, "");
}

export function contentTypeForBootstrapAsset(assetPath: string): string {
  if (assetPath.endsWith(".gz")) {
    return "application/gzip";
  }
  if (assetPath.endsWith(".js")) {
    return "application/javascript";
  }
  if (assetPath.endsWith(".css")) {
    return "text/css";
  }
  if (assetPath.endsWith(".jpg") || assetPath.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (assetPath.endsWith(".mp4")) {
    return "video/mp4";
  }
  return "application/octet-stream";
}

export async function uploadBootstrapShellToR2(params: {
  credentials: BootstrapR2Credentials;
  key: string;
  body: Uint8Array;
  contentType?: string;
}): Promise<void> {
  const client = createAwsClient(params.credentials);
  const url = buildR2ObjectUrl(params.credentials, params.key);
  const response = await client.fetch(url, {
    method: "PUT",
    body: params.body,
    headers: {
      "Content-Type": params.contentType ?? "application/gzip",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      body.trim().length > 0
        ? `R2 upload failed (${response.status}): ${body}`
        : `R2 upload failed (${response.status})`
    );
  }
}

export function buildBootstrapR2PublicUrl(
  publicBaseUrl: string,
  assetPath: string
): string {
  const base = publicBaseUrl.trim().replace(/\/$/, "");
  return `${base}/${bootstrapR2ObjectName(assetPath)}`;
}

export function buildBootstrapR2ObjectKey(assetPath: string): string {
  return bootstrapR2ObjectName(assetPath);
}

export function isBootstrapAccelerationObjectKey(key: string): boolean {
  if (key === BOOTSTRAP_REMOTE_MANIFEST_KEY) {
    return true;
  }
  if (/^shell-[a-f0-9]+\.gz$/.test(key)) {
    return true;
  }
  if (/^prefetch-[a-z0-9-]+-[a-f0-9]+\.gz$/.test(key)) {
    return true;
  }
  return key.startsWith("landing/");
}

function parseListObjectsXml(payload: string): readonly string[] {
  const keys: string[] = [];
  const regex = /<Key>([^<]+)<\/Key>/g;
  let match = regex.exec(payload);
  while (match) {
    keys.push(match[1]!);
    match = regex.exec(payload);
  }
  return keys;
}

export async function getBootstrapObjectFromR2(params: {
  credentials: BootstrapR2Credentials;
  key: string;
}): Promise<Uint8Array | null> {
  const client = createAwsClient(params.credentials);
  const url = buildR2ObjectUrl(params.credentials, params.key);
  const response = await client.fetch(url, { method: "GET" });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      body.trim().length > 0
        ? `R2 read failed (${response.status}): ${body}`
        : `R2 read failed (${response.status})`
    );
  }
  return new Uint8Array(await response.arrayBuffer());
}

export async function deleteBootstrapObjectFromR2(params: {
  credentials: BootstrapR2Credentials;
  key: string;
}): Promise<void> {
  const client = createAwsClient(params.credentials);
  const url = buildR2ObjectUrl(params.credentials, params.key);
  const response = await client.fetch(url, { method: "DELETE" });
  if (!response.ok && response.status !== 404) {
    const body = await response.text().catch(() => "");
    throw new Error(
      body.trim().length > 0
        ? `R2 delete failed (${response.status}): ${body}`
        : `R2 delete failed (${response.status})`
    );
  }
}

export async function listBootstrapBucketObjectKeys(
  credentials: BootstrapR2Credentials
): Promise<readonly string[]> {
  const client = createAwsClient(credentials);
  const url = `${buildR2Endpoint(credentials)}/${credentials.bucketName.trim()}?list-type=2`;
  const response = await client.fetch(url, { method: "GET" });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      body.trim().length > 0
        ? `R2 list failed (${response.status}): ${body}`
        : `R2 list failed (${response.status})`
    );
  }
  const payload = await response.text();
  return parseListObjectsXml(payload);
}

export function findNonBootstrapAccelerationObjectKeys(
  keys: readonly string[]
): readonly string[] {
  return keys.filter((key) => !isBootstrapAccelerationObjectKey(key));
}
