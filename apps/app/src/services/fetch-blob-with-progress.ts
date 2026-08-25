import { CloudAccelerationDownloadAbortError } from "@/services/cloud-acceleration-download";

const PROGRESS_MIN_STEP = 5;
const PROGRESS_MIN_INTERVAL_MS = 300;
const ABORT_POLL_INTERVAL_MS = 100;

export { CloudAccelerationDownloadAbortError };

function throwIfShouldAbort(
  shouldAbort: (() => boolean) | undefined
): void {
  if (shouldAbort?.()) {
    throw new CloudAccelerationDownloadAbortError();
  }
}

async function readBlobWithAbortPolling(
  response: Response,
  options?: {
    readonly shouldAbort?: () => boolean;
    readonly onSlowDownload?: () => void;
    readonly slowDownloadMs?: number;
  }
): Promise<Blob> {
  const slowDownloadMs = options?.slowDownloadMs ?? 2_000;
  const downloadStartedAt = Date.now();
  let slowDownloadNotified = false;

  throwIfShouldAbort(options?.shouldAbort);

  const blobPromise = response.blob();

  while (true) {
    const raced = await Promise.race([
      blobPromise.then((blob) => ({ done: true as const, blob })),
      sleep(ABORT_POLL_INTERVAL_MS).then(() => ({ done: false as const })),
    ]);

    if (raced.done) {
      return raced.blob;
    }

    if (options?.shouldAbort?.()) {
      throw new CloudAccelerationDownloadAbortError();
    }

    if (
      !slowDownloadNotified &&
      options?.onSlowDownload &&
      Date.now() - downloadStartedAt >= slowDownloadMs
    ) {
      slowDownloadNotified = true;
      options.onSlowDownload();
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function readStreamToBlob(
  response: Response,
  body: ReadableStream<Uint8Array>,
  options?: {
    readonly shouldAbort?: () => boolean;
    readonly onSlowDownload?: () => void;
    readonly slowDownloadMs?: number;
  },
  onProgress?: (percent: number) => void,
  totalBytes?: number
): Promise<Blob> {
  const reader = body.getReader();
  const chunks: BlobPart[] = [];
  let loadedBytes = 0;
  let lastReportedPercent = -1;
  let lastReportMs = 0;
  const slowDownloadMs = options?.slowDownloadMs ?? 2_000;
  const downloadStartedAt = Date.now();
  let slowDownloadNotified = false;
  const hasKnownTotal =
    totalBytes !== undefined && Number.isFinite(totalBytes) && totalBytes > 0;

  while (true) {
    if (options?.shouldAbort?.()) {
      await reader.cancel();
      throw new CloudAccelerationDownloadAbortError();
    }

    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    if (
      !slowDownloadNotified &&
      options?.onSlowDownload &&
      Date.now() - downloadStartedAt >= slowDownloadMs
    ) {
      slowDownloadNotified = true;
      options.onSlowDownload();
    }

    chunks.push(value);
    loadedBytes += value.byteLength;

    if (!onProgress || !hasKnownTotal) {
      continue;
    }

    const percent = Math.min(
      100,
      Math.floor((loadedBytes / totalBytes!) * 100)
    );
    const now = Date.now();
    const shouldReport =
      lastReportedPercent < 0 ||
      percent === 100 ||
      percent - lastReportedPercent >= PROGRESS_MIN_STEP ||
      now - lastReportMs >= PROGRESS_MIN_INTERVAL_MS;

    if (shouldReport) {
      lastReportedPercent = percent;
      lastReportMs = now;
      onProgress(percent);
    }
  }

  const mimeType = response.headers.get("Content-Type") ?? undefined;
  return new Blob(chunks, mimeType ? { type: mimeType } : undefined);
}

export async function fetchBlobWithProgress(
  url: string,
  init: RequestInit,
  onProgress?: (percent: number) => void,
  options?: {
    readonly shouldAbort?: () => boolean;
    readonly onSlowDownload?: () => void;
    readonly slowDownloadMs?: number;
  }
): Promise<Blob> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Failed to fetch (${response.status})`);
  }

  const contentLength = response.headers.get("Content-Length");
  const parsedTotalBytes = contentLength ? Number(contentLength) : 0;
  const totalBytes =
    Number.isFinite(parsedTotalBytes) && parsedTotalBytes > 0
      ? parsedTotalBytes
      : undefined;
  const body = response.body;

  if (!body) {
    return readBlobWithAbortPolling(response, options);
  }

  return readStreamToBlob(response, body, options, onProgress, totalBytes);
}
