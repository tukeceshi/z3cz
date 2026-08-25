export type CloudAccelerationStatus = "pending" | "active" | "done" | "failed";

const CLOUD_ACCELERATION_STATUSES = new Set<string>([
  "pending",
  "active",
  "done",
  "failed",
]);

export function isCloudAccelerationStatus(
  value: unknown
): value is CloudAccelerationStatus {
  return typeof value === "string" && CLOUD_ACCELERATION_STATUSES.has(value);
}

export function isCloudAccelerationInProgress(
  status: CloudAccelerationStatus | null | undefined
): boolean {
  return status === "pending" || status === "active";
}

export interface AiInterfaceCloudAccelerationEntry {
  readonly id: string;
  readonly organizationId: string;
  readonly aiInterfaceId: string;
  readonly interfaceName: string;
  readonly enabledAt: string;
}

export interface ListAiInterfaceCloudAccelerationResponse {
  readonly entries: readonly AiInterfaceCloudAccelerationEntry[];
}

export interface EnableAlwaysAiInterfaceCloudAccelerationRequest {
  readonly aiInterfaceId: string;
}

export interface EnableAlwaysAiInterfaceCloudAccelerationResponse {
  readonly entry: AiInterfaceCloudAccelerationEntry;
}

export const CLOUD_ACCELERATION_DOWNLOAD_SLOW_MS = 2_000 as const;
