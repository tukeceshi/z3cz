export type CloudStorageErrorSource = "api" | "cors_upload";

type CloudStorageErrorReporter = (source: CloudStorageErrorSource) => void;

let activeReporter: CloudStorageErrorReporter | null = null;

export function registerCloudStorageErrorReporter(
  reporter: CloudStorageErrorReporter
): void {
  activeReporter = reporter;
}

export function unregisterCloudStorageErrorReporter(): void {
  activeReporter = null;
}

export function reportCloudStorageError(source: CloudStorageErrorSource): void {
  activeReporter?.(source);
}

export function isCloudStorageApiErrorCode(code: string | undefined): boolean {
  return code === "cloud_storage_unhealthy";
}

export function isCloudStorageApiErrorMessage(message: string): boolean {
  return /cloud_storage_unhealthy|cloud storage is unavailable|bucket cors does not allow/i.test(
    message
  );
}
