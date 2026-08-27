import type { CloudAccelerationStatus } from "./cloud-acceleration";
import { isCloudAccelerationInProgress } from "./cloud-acceleration";
import type { MediaResourceKind } from "./media-resource-catalog";
import { isMediaResourceKind } from "./media-resource-catalog";
import type { ObjectReference } from "./workflow";

/** Temporary upstream URL — used when org cloud storage is not configured. */
export interface EphemeralMediaReference {
  readonly kind: "ephemeral";
  readonly url: string;
  readonly mimeType: string;
  readonly mediaId: string;
  readonly expiresAt?: string;
}

/** Workflow JSON — cloud/ephemeral resolved via media_resources catalog. */
export interface ResourceIdReference {
  readonly resourceId: string;
  /** Catalog storage kind. Missing kind is treated as unusable. */
  readonly kind?: MediaResourceKind;
  readonly mimeType?: string;
  /** Full-text SHA-256 (hex) — pending or stable. */
  readonly contentSha256?: string;
  /** Upstream still generating. Not a download/upload state. */
  readonly generating?: boolean;
  /** User requested cancel; upstream task may still be running. */
  readonly cancelling?: boolean;
  /** Generate failed. No media to load; look up error via history jobId. */
  readonly failed?: boolean;
  /** Cloud upload failed; media is available in this browser only. */
  readonly cloudUploadFailed?: boolean;
  /** Platform cloud acceleration in progress or recently failed. */
  readonly cloudAccelerationStatus?: CloudAccelerationStatus;
}

export type WorkflowMediaValue = ResourceIdReference;

export type MediaReference = ObjectReference | EphemeralMediaReference;

/** Upstream ephemeral media links remain valid for about one hour. */
export const EPHEMERAL_MEDIA_TTL_MS = 3_600_000 as const;

export function createEphemeralMediaExpiresAt(
  nowMs: number = Date.now()
): string {
  return new Date(nowMs + EPHEMERAL_MEDIA_TTL_MS).toISOString();
}

export const AI_MEDIA_CACHE_DEFAULT_LIMIT_MB = 1024 as const;
export const AI_MEDIA_CACHE_MIN_LIMIT_MB = 500 as const;
export const AI_MEDIA_CACHE_MAX_LIMIT_MB = 4096 as const;

export interface AiMediaCacheSettings {
  readonly limitMb: number;
}

import type { CloudStorageHealthSnapshot } from "./cloud-storage-health";
import { blocksGenerativeMediaForHealth } from "./cloud-storage-health";

export interface OrgCloudStorageConfiguredStatus {
  readonly configured: boolean;
  readonly interfaceId?: string;
}

export interface OrgCloudStorageStatus extends OrgCloudStorageConfiguredStatus {
  readonly health?: CloudStorageHealthSnapshot | null;
  readonly blocksGenerativeMedia: boolean;
}

export function buildOrgCloudStorageConfiguredStatus(params: {
  readonly configured: boolean;
  readonly interfaceId?: string;
}): OrgCloudStorageConfiguredStatus {
  return {
    configured: params.configured,
    interfaceId: params.interfaceId,
  };
}

export function buildOrgCloudStorageStatus(params: {
  readonly configured: boolean;
  readonly interfaceId?: string;
  readonly health?: CloudStorageHealthSnapshot | null;
}): OrgCloudStorageStatus {
  return {
    configured: params.configured,
    interfaceId: params.interfaceId,
    health: params.health ?? null,
    blocksGenerativeMedia: blocksGenerativeMediaForHealth(
      params.configured,
      params.health
    ),
  };
}

export function isEphemeralMediaReference(
  value: unknown
): value is EphemeralMediaReference {
  return (
    value !== null &&
    typeof value === "object" &&
    (value as EphemeralMediaReference).kind === "ephemeral" &&
    typeof (value as EphemeralMediaReference).url === "string" &&
    typeof (value as EphemeralMediaReference).mimeType === "string" &&
    typeof (value as EphemeralMediaReference).mediaId === "string"
  );
}

export function isObjectReference(value: unknown): value is ObjectReference {
  return (
    value !== null &&
    typeof value === "object" &&
    "id" in value &&
    typeof (value as ObjectReference).id === "string" &&
    "mimeType" in value &&
    typeof (value as ObjectReference).mimeType === "string" &&
    !(
      "kind" in value &&
      (value as unknown as EphemeralMediaReference).kind === "ephemeral"
    )
  );
}

export function isResourceIdReference(
  value: unknown
): value is ResourceIdReference {
  if (isEphemeralMediaReference(value)) {
    return false;
  }
  if (value === null || typeof value !== "object") {
    return false;
  }
  const record = value as ResourceIdReference;
  if (typeof record.resourceId !== "string" || record.resourceId.length === 0) {
    return false;
  }
  if (record.kind !== undefined && !isMediaResourceKind(record.kind)) {
    return false;
  }
  return true;
}

export function isGeneratingResourceRef(value: unknown): boolean {
  return isResourceIdReference(value) && value.generating === true;
}

export function isCancellingResourceRef(value: unknown): boolean {
  return isResourceIdReference(value) && value.cancelling === true;
}

export function isFailedResourceRef(value: unknown): boolean {
  return isResourceIdReference(value) && value.failed === true;
}

export function isCloudAcceleratingResourceRef(value: unknown): boolean {
  return (
    isResourceIdReference(value) &&
    isCloudAccelerationInProgress(value.cloudAccelerationStatus)
  );
}

/** Generating, cloud-accelerating, or failed — do not fetch or render as media. */
export function isUnloadedResourceRef(value: unknown): boolean {
  return (
    isGeneratingResourceRef(value) ||
    isCancellingResourceRef(value) ||
    isFailedResourceRef(value) ||
    isCloudAcceleratingResourceRef(value)
  );
}

export function hasGeneratingResource(
  values: readonly unknown[] | undefined
): boolean {
  return Boolean(values?.some(isGeneratingResourceRef));
}

export function hasCancellingResource(
  values: readonly unknown[] | undefined
): boolean {
  return Boolean(values?.some(isCancellingResourceRef));
}

export function hasCloudAcceleratingResource(
  values: readonly unknown[] | undefined
): boolean {
  return Boolean(values?.some(isCloudAcceleratingResourceRef));
}

export function hasFailedResource(
  values: readonly unknown[] | undefined
): boolean {
  return Boolean(values?.some(isFailedResourceRef));
}

export function isWorkflowMediaValue(
  value: unknown
): value is WorkflowMediaValue {
  return isResourceIdReference(value);
}

/** Ready to show on the card — not generating or failed. */
export function isDisplayableWorkflowMedia(value: unknown): boolean {
  return isWorkflowMediaValue(value) && !isUnloadedResourceRef(value);
}

export function hasDisplayableWorkflowMedia(
  values: readonly unknown[] | undefined
): boolean {
  return Boolean(values?.some(isDisplayableWorkflowMedia));
}

/** Any stored or API media ref — resourceId, ephemeral mediaId, then object id. */
export function getResourceIdFromValue(value: unknown): string | null {
  if (isResourceIdReference(value)) {
    return value.resourceId;
  }
  if (isEphemeralMediaReference(value)) {
    return value.mediaId;
  }
  if (isObjectReference(value)) {
    return value.id;
  }
  return null;
}

/** API/job MediaReference → workflow JSON (resourceId only). */
export function mediaReferenceToWorkflowValue(
  ref: MediaReference
): WorkflowMediaValue {
  return {
    resourceId: getResourceId(ref),
    mimeType: ref.mimeType,
    kind:
      isObjectReference(ref) && isCloudObjectReference(ref)
        ? "cloud"
        : isEphemeralMediaReference(ref)
          ? "ephemeral"
          : "local",
  };
}

export function workflowMediaMimeType(
  value: WorkflowMediaValue
): string | undefined {
  return value.mimeType;
}

export function isMediaReference(value: unknown): value is MediaReference {
  return isObjectReference(value) || isEphemeralMediaReference(value);
}

export function isCloudObjectReference(
  ref: ObjectReference
): ref is ObjectReference & {
  readonly storageBackend: "volcengine_tos";
  readonly storageKey: string;
} {
  return (
    ref.storageBackend === "volcengine_tos" &&
    typeof ref.storageKey === "string" &&
    ref.storageKey.length > 0
  );
}

/** Stable id for an API/job media ref. */
export function getResourceId(ref: MediaReference): string {
  const id = getResourceIdFromValue(ref);
  if (!id) {
    throw new Error("Media reference has no id");
  }
  return id;
}

export function isEphemeralMediaExpired(ref: EphemeralMediaReference): boolean {
  if (!ref.expiresAt) return false;
  return Date.parse(ref.expiresAt) <= Date.now();
}
