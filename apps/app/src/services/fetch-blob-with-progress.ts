const PROGRESS_MIN_STEP = 5;
const PROGRESS_MIN_INTERVAL_MS = 300;

export async function fetchBlobWithProgress(
  url: string,
  init: RequestInit,
  onProgress?: (percent: number) => void
): Promise<Blob> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Failed to fetch (${response.status})`);
  }

  const contentLength = response.headers.get("Content-Length");
  const totalBytes = contentLength ? Number(contentLength) : 0;
  const body = response.body;

  if (!body || !Number.isFinite(totalBytes) || totalBytes <= 0) {
    return response.blob();
  }

  const reader = body.getReader();
  const chunks: BlobPart[] = [];
  let loadedBytes = 0;
  let lastReportedPercent = -1;
  let lastReportMs = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    chunks.push(value);
    loadedBytes += value.byteLength;

    if (!onProgress) {
      continue;
    }

    const percent = Math.min(100, Math.floor((loadedBytes / totalBytes) * 100));
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
