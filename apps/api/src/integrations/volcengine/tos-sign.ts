const ALGORITHM = "TOS4-HMAC-SHA256";
const SERVICE = "tos";
const UNSIGNED_PAYLOAD = "UNSIGNED-PAYLOAD";

export interface TosSignedRequest {
  readonly url: string;
  readonly headers: Record<string, string>;
}

interface SignTosRequestParams {
  readonly method: string;
  readonly endpoint: string;
  readonly path: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly region: string;
  readonly body?: Uint8Array;
  readonly contentType?: string;
  readonly payloadHash?: string;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const buffer =
    typeof data === "string" ? new TextEncoder().encode(data) : data;
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return toHex(new Uint8Array(digest));
}

async function hmacSha256(
  key: Uint8Array | ArrayBuffer,
  message: string
): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(message)
  );
  return new Uint8Array(signature);
}

async function deriveSigningKey(
  secretAccessKey: string,
  dateStamp: string,
  region: string
): Promise<Uint8Array> {
  const secretKeyBytes = new TextEncoder().encode(secretAccessKey);
  const kDate = await hmacSha256(secretKeyBytes, dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, SERVICE);
  return hmacSha256(kService, "request");
}

function buildCanonicalQueryString(
  queryEntries?: readonly (readonly [string, string])[]
): string {
  if (!queryEntries || queryEntries.length === 0) {
    return "";
  }

  return queryEntries
    .slice()
    .sort(([left], [right]) => left.localeCompare(right))
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
    )
    .join("&");
}

/** Presigned GET URL for anonymous download (e.g. upstream model fetch). */
export async function presignTosGetUrl(params: {
  readonly endpoint: string;
  readonly path: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly region: string;
  readonly expiresInSeconds: number;
}): Promise<string> {
  const host = new URL(params.endpoint).host;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${params.region}/${SERVICE}/request`;
  const credential = `${params.accessKeyId}/${credentialScope}`;
  const signedHeaders = "host";
  const payloadHash = UNSIGNED_PAYLOAD;

  const queryEntries: (readonly [string, string])[] = [
    ["X-Tos-Algorithm", ALGORITHM],
    ["X-Tos-Credential", credential],
    ["X-Tos-Date", amzDate],
    ["X-Tos-Expires", String(params.expiresInSeconds)],
    ["X-Tos-SignedHeaders", signedHeaders],
  ];

  const canonicalQueryString = buildCanonicalQueryString(queryEntries);
  const canonicalRequest = [
    "GET",
    params.path,
    canonicalQueryString,
    `host:${host}\n`,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const stringToSign = [
    ALGORITHM,
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  const signingKey = await deriveSigningKey(
    params.secretAccessKey,
    dateStamp,
    params.region
  );
  const signature = toHex(await hmacSha256(signingKey, stringToSign));

  const url = new URL(`${params.endpoint}${params.path}`);
  for (const [key, value] of queryEntries) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("X-Tos-Signature", signature);
  return url.toString();
}

/** Signed PUT request for browser-direct upload (returns URL + headers). */
export async function signTosPutObject(params: {
  readonly endpoint: string;
  readonly path: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly region: string;
  readonly mimeType: string;
  readonly contentLength: number;
}): Promise<TosSignedRequest> {
  return signTosRequest({
    method: "PUT",
    endpoint: params.endpoint,
    path: params.path,
    accessKeyId: params.accessKeyId,
    secretAccessKey: params.secretAccessKey,
    region: params.region,
    contentType: params.mimeType,
    payloadHash: UNSIGNED_PAYLOAD,
  });
}

export async function signTosRequest(
  params: SignTosRequestParams
): Promise<TosSignedRequest> {
  const host = new URL(params.endpoint).host;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = params.payloadHash ?? UNSIGNED_PAYLOAD;

  const headerEntries: Record<string, string> = {
    host,
    "x-tos-content-sha256": payloadHash,
    "x-tos-date": amzDate,
  };
  if (params.contentType) {
    headerEntries["content-type"] = params.contentType;
  }

  const sortedHeaderNames = Object.keys(headerEntries).sort();
  const canonicalHeaders = sortedHeaderNames
    .map((name) => `${name}:${headerEntries[name]!.trim()}`)
    .join("\n");
  const signedHeaders = sortedHeaderNames.join(";");
  const canonicalRequest = [
    params.method.toUpperCase(),
    params.path,
    buildCanonicalQueryString(),
    `${canonicalHeaders}\n`,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${params.region}/${SERVICE}/request`;
  const stringToSign = [
    ALGORITHM,
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  const signingKey = await deriveSigningKey(
    params.secretAccessKey,
    dateStamp,
    params.region
  );
  const signature = toHex(await hmacSha256(signingKey, stringToSign));
  const authorization = `${ALGORITHM} Credential=${params.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const headers: Record<string, string> = {
    Authorization: authorization,
    Host: host,
    "x-tos-content-sha256": payloadHash,
    "x-tos-date": amzDate,
  };
  if (params.contentType) {
    headers["Content-Type"] = params.contentType;
  }
  if (params.body) {
    headers["Content-Length"] = String(params.body.byteLength);
  }

  return {
    url: `${params.endpoint}${params.path}`,
    headers,
  };
}
