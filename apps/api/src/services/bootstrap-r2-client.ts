import { AwsClient } from "aws4fetch";

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

export function createAwsClient(credentials: BootstrapR2Credentials): AwsClient {
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

export async function uploadBootstrapShellToR2(params: {
  credentials: BootstrapR2Credentials;
  key: string;
  body: Uint8Array;
}): Promise<void> {
  const client = createAwsClient(params.credentials);
  const url = buildR2ObjectUrl(params.credentials, params.key);
  const response = await client.fetch(url, {
    method: "PUT",
    body: params.body,
    headers: {
      "Content-Type": "application/gzip",
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
  shellPath: string
): string {
  const base = publicBaseUrl.trim().replace(/\/$/, "");
  const fileName = shellPath.replace(/^\/assets\//, "");
  return `${base}/${fileName}`;
}

export function buildBootstrapR2ObjectKey(shellPath: string): string {
  return shellPath.replace(/^\/assets\//, "");
}
