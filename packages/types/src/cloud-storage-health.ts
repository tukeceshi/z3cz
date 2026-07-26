export type CloudStorageHealthStatus = "healthy" | "degraded" | "blocked";

export type CloudStorageBlockReason =
  | "service_not_opened"
  | "auth_invalid"
  | "bucket_missing"
  | "quota_exceeded"
  | "account_suspended"
  | "permission_denied"
  | "cors_not_configured";

export interface CloudStorageHealthSnapshot {
  readonly status: CloudStorageHealthStatus;
  readonly reason: CloudStorageBlockReason | null;
  readonly message: string | null;
  readonly checkedAt: string;
  readonly interfaceId: string;
  readonly bucket: string;
  readonly region: string;
  readonly consecutiveFailureCount?: number;
}

export const CLOUD_STORAGE_UNHEALTHY_ERROR_CODE =
  "cloud_storage_unhealthy" as const;

export const CLOUD_STORAGE_HEALTH_CHECK_TTL_MS = 300_000;

/** Transient upload failures must reach this count before blocking generative media. */
export const CLOUD_STORAGE_DEGRADED_FAILURE_THRESHOLD = 3 as const;

export function blocksGenerativeMediaForHealth(
  configured: boolean,
  health: CloudStorageHealthSnapshot | null | undefined
): boolean {
  if (!configured) return false;
  if (!health) return true;
  if (health.status === "blocked") return true;
  if (health.status === "degraded") {
    return (
      (health.consecutiveFailureCount ?? 0) >=
      CLOUD_STORAGE_DEGRADED_FAILURE_THRESHOLD
    );
  }
  return false;
}
