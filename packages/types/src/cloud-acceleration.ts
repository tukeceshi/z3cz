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

export interface CloudAccelerationResourceSnapshot {
  readonly kind: string;
  readonly upstreamUrl?: string;
  readonly generating?: boolean;
  readonly expiresAt?: string;
}

/** Catalog row already in org cloud storage. */
export function isCloudStoredResource(
  entry: Pick<CloudAccelerationResourceSnapshot, "kind">
): boolean {
  return entry.kind === "cloud";
}

/** Ephemeral catalog row — temporary upstream connection, not yet in cloud storage. */
export function isEphemeralTemporaryConnection(
  entry: CloudAccelerationResourceSnapshot
): boolean {
  if (isCloudStoredResource(entry) || entry.kind !== "ephemeral") {
    return false;
  }
  if (entry.expiresAt && Date.parse(entry.expiresAt) <= Date.now()) {
    return false;
  }
  return Boolean(entry.upstreamUrl?.trim()) || entry.generating === true;
}

export function shouldCloudAccelerate(params: {
  readonly resourceEntry: CloudAccelerationResourceSnapshot;
  readonly cloudConfigured: boolean;
  readonly interfaceInAccelList: boolean;
  readonly userTriggered?: boolean;
}): boolean {
  if (!params.cloudConfigured) {
    return false;
  }
  if (!params.interfaceInAccelList && !params.userTriggered) {
    return false;
  }
  return isEphemeralTemporaryConnection(params.resourceEntry);
}
