export type VolcanoSetupStatus =
  | "pending"
  | "running"
  | "ready"
  | "failed"
  | "enqueue_failed";

export const VOLCANO_SETUP_IN_PROGRESS_STATUSES: readonly VolcanoSetupStatus[] = [
  "pending",
  "running",
  "enqueue_failed",
] as const;

export function isVolcanoSetupInProgress(
  status: VolcanoSetupStatus | null | undefined
): boolean {
  return (
    status !== null &&
    status !== undefined &&
    (VOLCANO_SETUP_IN_PROGRESS_STATUSES as readonly string[]).includes(status)
  );
}

export interface VolcanoInterfaceSetupQueueMessage {
  readonly kind: "volcano_interface_setup";
  readonly organizationId: string;
  readonly interfaceId: string;
  readonly idempotencyKey: string;
  readonly tosSetup?: {
    readonly enabled: boolean;
    readonly region: string;
    readonly bucket: string;
    readonly createBucket?: boolean;
  };
}

export function isVolcanoInterfaceSetupQueueMessage(
  value: unknown
): value is VolcanoInterfaceSetupQueueMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as VolcanoInterfaceSetupQueueMessage).kind ===
      "volcano_interface_setup"
  );
}
