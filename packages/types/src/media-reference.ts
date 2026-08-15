import type { ObjectReference } from "./workflow";

/** Temporary upstream URL — used when org cloud storage is not configured. */
export interface EphemeralMediaReference {
  readonly kind: "ephemeral";
  readonly url: string;
  readonly mimeType: string;
  readonly mediaId: string;
  readonly expiresAt?: string;
}

/** Browser-local staging — IndexedDB only, not on server. */
export interface LocalMediaReference {
  readonly kind: "local";
  readonly mediaId: string;
  readonly mimeType: string;
}

/** Workflow JSON — cloud/ephemeral resolved via media_resources catalog. */
export interface ResourceIdReference {
  readonly resourceId: string;
  readonly mimeType?: string;
  /** Full-text SHA-256 (hex) — pending or stable. */
  readonly contentSha256?: string;
  /** Upstream still generating. Not a download/upload state. */
  readonly generating?: boolean;
  /** Generate failed. No media to load; look up error via history jobId. */
  readonly failed?: boolean;
}

export type WorkflowMediaValue = ResourceIdReference | LocalMediaReference;

export type MediaReference =
  | ObjectReference
  | EphemeralMediaReference
  | LocalMediaReference;

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

export function isLocalMediaReference(
  value: unknown
): value is LocalMediaReference {
  return (
    value !== null &&
    typeof value === "object" &&
    (value as LocalMediaReference).kind === "local" &&
    typeof (value as LocalMediaReference).mediaId === "string" &&
    typeof (value as LocalMediaReference).mimeType === "string"
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
      ((value as unknown as EphemeralMediaReference).kind === "ephemeral" ||
        (value as unknown as LocalMediaReference).kind === "local")
    )
  );
}

export function isResourceIdReference(
  value: unknown
): value is ResourceIdReference {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as ResourceIdReference).resourceId === "string" &&
    (value as ResourceIdReference).resourceId.length > 0 &&
    !("kind" in value)
  );
}

export function isGeneratingResourceRef(value: unknown): boolean {
  return isResourceIdReference(value) && value.generating === true;
}

export function isFailedResourceRef(value: unknown): boolean {
  return isResourceIdReference(value) && value.failed === true;
}

/** Generating or failed — do not fetch or render as media. */
export function isUnloadedResourceRef(value: unknown): boolean {
  return isGeneratingResourceRef(value) || isFailedResourceRef(value);
}

export function hasGeneratingResource(
  values: readonly unknown[] | undefined
): boolean {
  return Boolean(values?.some(isGeneratingResourceRef));
}

export function hasFailedResource(
  values: readonly unknown[] | undefined
): boolean {
  return Boolean(values?.some(isFailedResourceRef));
}

export function isWorkflowMediaValue(
  value: unknown
): value is WorkflowMediaValue {
  return isResourceIdReference(value) || isLocalMediaReference(value);
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

/** Any stored or API media ref — resourceId, local/ephemeral mediaId, then object id. */
export function getResourceIdFromValue(value: unknown): string | null {
  if (isResourceIdReference(value)) {
    return value.resourceId;
  }
  if (isLocalMediaReference(value) || isEphemeralMediaReference(value)) {
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
  if (isLocalMediaReference(ref)) {
    return ref;
  }
  return {
    resourceId: getResourceId(ref),
    mimeType: ref.mimeType,
  };
}

export function workflowMediaMimeType(
  value: WorkflowMediaValue
): string | undefined {
  return value.mimeType;
}

export function isMediaReference(value: unknown): value is MediaReference {
  return (
    isObjectReference(value) ||
    isEphemeralMediaReference(value) ||
    isLocalMediaReference(value)
  );
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
