export class CloudAccelerationDownloadAbortError extends Error {
  constructor() {
    super("Cloud acceleration aborted client download");
    this.name = "CloudAccelerationDownloadAbortError";
  }
}

export const CLOUD_ACCELERATION_DOWNLOAD_SLOW_MS = 2_000 as const;
