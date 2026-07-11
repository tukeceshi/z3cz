const encoder = new TextEncoder();

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(data: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  return toHex(new Uint8Array(digest));
}

async function hmacSha256(
  key: string | Uint8Array,
  data: string
): Promise<Uint8Array> {
  const keyBytes = typeof key === "string" ? encoder.encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
  return new Uint8Array(signature);
}

async function deriveSigningKey(
  secretKey: string,
  date: string,
  region: string,
  service: string
): Promise<Uint8Array> {
  const kDate = await hmacSha256(secretKey, date);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  return hmacSha256(kService, "request");
}

function formatVolcengineDate(date = new Date()): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

export function volcengineUriEscape(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function encodeQuery(params: Record<string, string>): string {
  return Object.keys(params)
    .sort()
    .map(
      (key) =>
        `${volcengineUriEscape(key)}=${volcengineUriEscape(params[key]!)}`
    )
    .join("&")
    .replace(/\+/g, "%20");
}

export interface SignedVolcengineRequest {
  readonly url: string;
  readonly headers: Record<string, string>;
  readonly body: string;
}

export async function signVolcengineRequest(params: {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  service: string;
  host: string;
  method: "GET" | "POST";
  action: string;
  version: string;
  body?: Record<string, unknown>;
  queryParams?: Record<string, string>;
}): Promise<SignedVolcengineRequest> {
  const body = JSON.stringify(params.body ?? {});
  const xDate = formatVolcengineDate();
  const shortDate = xDate.slice(0, 8);
  const payloadHash = await sha256Hex(body);
  const query = encodeQuery({
    Action: params.action,
    Version: params.version,
    ...params.queryParams,
  });
  const canonicalHeaders = [
    `content-type:application/json`,
    `host:${params.host}`,
    `x-content-sha256:${payloadHash}`,
    `x-date:${xDate}`,
  ].join("\n");
  const signedHeaders = "content-type;host;x-content-sha256;x-date";
  const canonicalRequest = [
    params.method,
    "/",
    query,
    `${canonicalHeaders}\n`,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const hashedCanonicalRequest = await sha256Hex(canonicalRequest);
  const credentialScope = `${shortDate}/${params.region}/${params.service}/request`;
  const stringToSign = [
    "HMAC-SHA256",
    xDate,
    credentialScope,
    hashedCanonicalRequest,
  ].join("\n");
  const signingKey = await deriveSigningKey(
    params.secretAccessKey,
    shortDate,
    params.region,
    params.service
  );
  const signature = toHex(await hmacSha256(signingKey, stringToSign));
  const authorization = [
    `HMAC-SHA256 Credential=${params.accessKeyId}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`,
  ].join(", ");

  return {
    url: `https://${params.host}/?${query}`,
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
      Host: params.host,
      "X-Content-Sha256": payloadHash,
      "X-Date": xDate,
    },
    body,
  };
}
