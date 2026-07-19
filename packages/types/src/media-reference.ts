import type { ObjectReference } from "./workflow";

/** Temporary upstream URL — used when org cloud storage is not configured. */
export interface EphemeralMediaReference {
  readonly kind: "ephemeral";
  readonly url: string;
  readonly mimeType: string;
  readonly mediaId: string;
  readonly expiresAt?: string;
}

export type MediaReference = ObjectReference | EphemeralMediaReference;

export const AI_MEDIA_CACHE_DEFAULT_LIMIT_MB = 1024 as const;
export const AI_MEDIA_CACHE_MIN_LIMIT_MB = 500 as const;
export const AI_MEDIA_CACHE_MAX_LIMIT_MB = 4096 as const;

export interface AiMediaCacheSettings {
  readonly enabled: boolean;
  readonly limitMb: number;
}

export interface OrgCloudStorageStatus {
  readonly configured: boolean;
  readonly interfaceId?: string;
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
    !("kind" in value && (value as EphemeralMediaReference).kind === "ephemeral")
  );
}

export function isMediaReference(value: unknown): value is MediaReference {
  return isObjectReference(value) || isEphemeralMediaReference(value);
}

export function getMediaReferenceKey(ref: MediaReference): string {
  if (isEphemeralMediaReference(ref)) {
    return ref.mediaId;
  }
  return ref.storageKey ?? ref.id;
}
