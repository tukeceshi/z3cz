import type {
  MediaReference,
  PersistWorkerClaimJobResponse,
  PersistWorkerPresignUploadsResponse,
} from "@dafthunk/types";

interface WorkerConfig {
  readonly apiBaseUrl: string;
  readonly workerId: string;
  readonly workerSecret: string;
  readonly pollIntervalMs: number;
}

function readConfig(): WorkerConfig {
  const apiBaseUrl = process.env.API_BASE_URL?.trim().replace(/\/$/, "");
  const workerId = process.env.WORKER_ID?.trim();
  const workerSecret = process.env.WORKER_SECRET?.trim();
  const pollIntervalMs = Number(process.env.POLL_INTERVAL_MS ?? "5000");

  if (!apiBaseUrl || !workerId || !workerSecret) {
    throw new Error(
      "API_BASE_URL, WORKER_ID, and WORKER_SECRET environment variables are required"
    );
  }

  return { apiBaseUrl, workerId, workerSecret, pollIntervalMs };
}

function workerHeaders(config: WorkerConfig): HeadersInit {
  return {
    "Content-Type": "application/json",
    "X-Worker-Id": config.workerId,
    "X-Worker-Secret": config.workerSecret,
  };
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
