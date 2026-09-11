import { createHmac } from "node:crypto";
import http from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import type {
  MediaReference,
  PersistWorkerClaimJobResponse,
  PersistWorkerPresignUploadsResponse,
} from "@dafthunk/types";
import { PERSIST_WORKER_FORWARD_PORT } from "@dafthunk/types";

interface WorkerConfig {
  readonly apiBaseUrl: string;
  readonly workerId: string;
  readonly workerSecret: string;
  readonly pollIntervalMs: number;
  readonly forwardPort: number;
  readonly forwardHmacKey: string | null;
}

const FORWARD_MAX_SKEW_MS = 5 * 60 * 1000;
const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
  "x-forward-url",
  "x-forward-method",
  "x-forward-ts",
  "x-forward-sig",
]);

function readConfig(): WorkerConfig {
  const apiBaseUrl = process.env.API_BASE_URL?.trim().replace(/\/$/, "");
  const workerId = process.env.WORKER_ID?.trim();
  const workerSecret = process.env.WORKER_SECRET?.trim();
  const pollIntervalMs = Number(process.env.POLL_INTERVAL_MS ?? "5000");
  const forwardPort = Number(
    process.env.FORWARD_PORT ?? String(PERSIST_WORKER_FORWARD_PORT)
  );
  const forwardHmacKey = process.env.FORWARD_HMAC_KEY?.trim() || null;

  if (!apiBaseUrl || !workerId || !workerSecret) {
    throw new Error(
      "API_BASE_URL, WORKER_ID, and WORKER_SECRET environment variables are required"
    );
  }

  return {
    apiBaseUrl,
    workerId,
    workerSecret,
    pollIntervalMs,
    forwardPort,
    forwardHmacKey,
  };
}

function workerHeaders(config: WorkerConfig): HeadersInit {
  return {
    "Content-Type": "application/json",
    "X-Worker-Id": config.workerId,
    "X-Worker-Secret": config.workerSecret,
  };
}

function signForward(params: {
  readonly hmacKey: string;
  readonly timestampMs: number;
  readonly method: string;
  readonly url: string;
}): string {
  return createHmac("sha256", params.hmacKey)
    .update(`${params.timestampMs}\n${params.method}\n${params.url}`)
    .digest("hex");
}

function isForwardSignatureValid(params: {
  readonly hmacKey: string;
  readonly timestampMs: number;
  readonly method: string;
  readonly url: string;
  readonly signature: string;
}): boolean {
  if (
    !Number.isFinite(params.timestampMs) ||
    Math.abs(Date.now() - params.timestampMs) > FORWARD_MAX_SKEW_MS
  ) {
    return false;
  }
  return (
    signForward({
      hmacKey: params.hmacKey,
      timestampMs: params.timestampMs,
      method: params.method,
      url: params.url,
    }) === params.signature
  );
}

async function handleForwardRequest(
  config: WorkerConfig,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (req.method !== "POST" || req.url?.split("?")[0] !== "/forward") {
    res.writeHead(404);
    res.end();
    return;
  }

  const hmacKey = config.forwardHmacKey;
  const targetUrl = String(req.headers["x-forward-url"] ?? "").trim();
  const method = String(req.headers["x-forward-method"] ?? "GET")
    .trim()
    .toUpperCase();
  const timestampMs = Number(req.headers["x-forward-ts"] ?? "");
  const signature = String(req.headers["x-forward-sig"] ?? "").trim();

  if (
    !hmacKey ||
    !targetUrl ||
    !isForwardSignatureValid({
      hmacKey,
      timestampMs,
      method,
      url: targetUrl,
      signature,
    })
  ) {
    res.writeHead(401);
    res.end("unauthorized");
    return;
  }

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (!value || HOP_BY_HOP.has(key.toLowerCase())) {
      continue;
    }
    headers.set(key, Array.isArray(value) ? value.join(",") : value);
  }

  const hasBody = method !== "GET" && method !== "HEAD";
  const upstream = await fetch(targetUrl, {
    method,
    headers,
    body: hasBody ? Readable.toWeb(req) : undefined,
    duplex: hasBody ? "half" : undefined,
  } as RequestInit);

  const responseHeaders: Record<string, string> = {};
  upstream.headers.forEach((value, key) => {
    if (key === "transfer-encoding") {
      return;
    }
    responseHeaders[key] = value;
  });
  res.writeHead(upstream.status, responseHeaders);
  if (!upstream.body) {
    res.end();
    return;
  }
  Readable.fromWeb(upstream.body as import("node:stream/web").ReadableStream).pipe(
    res
  );
}

function startForwardServer(config: WorkerConfig): void {
  if (!config.forwardHmacKey) {
    console.warn("FORWARD_HMAC_KEY missing; API forward disabled");
    return;
  }

  const server = http.createServer((req, res) => {
    void handleForwardRequest(config, req, res).catch((error) => {
      console.error(
        error instanceof Error ? error.message : "Forward request failed"
      );
      if (!res.headersSent) {
        res.writeHead(502);
      }
      res.end();
    });
  });

  server.listen(config.forwardPort, "0.0.0.0", () => {
    console.info(`API forward listening on ${config.forwardPort}`);
  });
}

async function sendHeartbeat(config: WorkerConfig): Promise<void> {
  const response = await fetch(
    `${config.apiBaseUrl}/internal/persist-workers/heartbeat`,
    {
      method: "POST",
      headers: workerHeaders(config),
    }
  );

  if (!response.ok) {
    throw new Error(`Heartbeat failed (${response.status})`);
  }
}

async function claimJob(
  config: WorkerConfig
): Promise<PersistWorkerClaimJobResponse | null> {
  const response = await fetch(`${config.apiBaseUrl}/internal/persist-workers/claim`, {
    method: "POST",
    headers: workerHeaders(config),
  });

  if (!response.ok) {
    throw new Error(`Claim failed (${response.status})`);
  }

  const payload = (await response.json()) as PersistWorkerClaimJobResponse & {
    job?: PersistWorkerClaimJobResponse["job"] | null;
  };

  if (!payload.job) {
    return null;
  }

  return payload;
}

async function presignUploads(
  config: WorkerConfig,
  jobId: string,
  items: Array<{ index: number; contentLength: number; mimeType: string }>
): Promise<PersistWorkerPresignUploadsResponse> {
  const response = await fetch(
    `${config.apiBaseUrl}/internal/persist-workers/jobs/${jobId}/presign-uploads`,
    {
      method: "POST",
      headers: workerHeaders(config),
      body: JSON.stringify({ items }),
    }
  );

  if (!response.ok) {
    throw new Error(`Presign failed (${response.status})`);
  }

  return (await response.json()) as PersistWorkerPresignUploadsResponse;
}

async function completeJob(
  config: WorkerConfig,
  jobId: string,
  finalMedia: readonly MediaReference[]
): Promise<void> {
  const response = await fetch(
    `${config.apiBaseUrl}/internal/persist-workers/jobs/${jobId}/complete`,
    {
      method: "POST",
      headers: workerHeaders(config),
      body: JSON.stringify({ finalMedia }),
    }
  );

  if (!response.ok) {
    throw new Error(`Complete failed (${response.status})`);
  }
}

async function failJob(
  config: WorkerConfig,
  jobId: string,
  reason: string
): Promise<void> {
  await fetch(`${config.apiBaseUrl}/internal/persist-workers/jobs/${jobId}/fail`, {
    method: "POST",
    headers: workerHeaders(config),
    body: JSON.stringify({ reason }),
  });
}

async function processClaimedJob(
  config: WorkerConfig,
  claim: PersistWorkerClaimJobResponse
): Promise<void> {
  const { job, pendingMedia } = claim;
  const finalMedia: MediaReference[] = [];
  const presignItems: Array<{
    index: number;
    contentLength: number;
    mimeType: string;
  }> = [];
  const blobs: Blob[] = [];

  for (let index = 0; index < pendingMedia.length; index += 1) {
    const item = pendingMedia[index];
    const response = await fetch(item.sourceUrl);
    if (!response.ok) {
      throw new Error(`Download failed (${response.status}) for ${item.sourceUrl}`);
    }

    const blob = await response.blob();
    blobs[index] = blob;
    presignItems.push({
      index,
      contentLength: blob.size,
      mimeType:
        blob.type ||
        response.headers.get("content-type")?.split(";")[0]?.trim() ||
        item.mimeType,
    });
  }

  const presigned = await presignUploads(config, job.id, presignItems);

  for (const slot of presigned.slots) {
    const blob = blobs[slot.index];
    if (!blob) {
      throw new Error(`Missing blob for upload slot ${slot.index}`);
    }

    const uploadResponse = await fetch(slot.uploadUrl, {
      method: "PUT",
      headers: slot.uploadHeaders,
      body: blob,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed (${uploadResponse.status})`);
    }

    finalMedia[slot.index] = slot.reference;
  }

  await completeJob(config, job.id, finalMedia);
}

async function runLoop(config: WorkerConfig): Promise<void> {
  await sendHeartbeat(config);

  const claim = await claimJob(config);
  if (!claim) {
    return;
  }

  try {
    await processClaimedJob(config, claim);
    console.info(`Completed persist job ${claim.job.id}`);
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "Worker persist failed";
    console.error(`Persist job ${claim.job.id} failed:`, reason);
    await failJob(config, claim.job.id, reason);
  }
}

async function main(): Promise<void> {
  const config = readConfig();
  console.info(`Persist worker ${config.workerId} starting`);
  startForwardServer(config);

  for (;;) {
    try {
      await runLoop(config);
    } catch (error) {
      console.error(
        error instanceof Error ? error.message : "Worker loop error"
      );
    }

    await new Promise((resolve) => setTimeout(resolve, config.pollIntervalMs));
  }
}

void main();
