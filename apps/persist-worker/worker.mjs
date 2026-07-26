function readConfig() {
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

function workerHeaders(config) {
  return {
    "Content-Type": "application/json",
    "X-Worker-Id": config.workerId,
    "X-Worker-Secret": config.workerSecret,
  };
}

async function sendHeartbeat(config) {
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

async function claimJob(config) {
  const response = await fetch(`${config.apiBaseUrl}/internal/persist-workers/claim`, {
    method: "POST",
    headers: workerHeaders(config),
  });

  if (!response.ok) {
    throw new Error(`Claim failed (${response.status})`);
  }

  const payload = await response.json();
  if (!payload.job) {
    return null;
  }

  return payload;
}

async function presignUploads(config, jobId, items) {
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

  return response.json();
}

async function completeJob(config, jobId, finalMedia) {
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

async function failJob(config, jobId, reason) {
  await fetch(`${config.apiBaseUrl}/internal/persist-workers/jobs/${jobId}/fail`, {
    method: "POST",
    headers: workerHeaders(config),
    body: JSON.stringify({ reason }),
  });
}

async function processClaimedJob(config, claim) {
  const { job, pendingMedia } = claim;
  const finalMedia = [];
  const presignItems = [];
  const blobs = [];

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

async function runLoop(config) {
  await sendHeartbeat(config);

  const claim = await claimJob(config);
  if (!claim) {
    return;
  }

  try {
    await processClaimedJob(config, claim);
    console.info(`Completed persist job ${claim.job.id}`);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Worker persist failed";
    console.error(`Persist job ${claim.job.id} failed:`, reason);
    await failJob(config, claim.job.id, reason);
  }
}

async function main() {
  const config = readConfig();
  console.info(`Persist worker ${config.workerId} starting`);

  for (;;) {
    try {
      await runLoop(config);
    } catch (error) {
      console.error(error instanceof Error ? error.message : "Worker loop error");
    }

    await new Promise((resolve) => setTimeout(resolve, config.pollIntervalMs));
  }
}

void main();
