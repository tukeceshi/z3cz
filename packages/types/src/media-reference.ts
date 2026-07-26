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
  readonly enabled: boolean;
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

export function getMediaReferenceKey(ref: MediaReference): string {
  if (isEphemeralMediaReference(ref) || isLocalMediaReference(ref)) {
    return ref.mediaId;
  }
  return ref.storageKey ?? ref.id;
}

export function isEphemeralMediaExpired(ref: EphemeralMediaReference): boolean {
  if (!ref.expiresAt) return false;
  return Date.parse(ref.expiresAt) <= Date.now();
}
