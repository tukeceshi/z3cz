export type MediaResourceKind = "cloud" | "local" | "ephemeral";

export interface MediaResourceRecord {
  readonly id: string;
  readonly organizationId: string;
  readonly kind: MediaResourceKind;
  readonly mimeType: string;
  readonly storageKey: string | null;
  readonly upstreamUrl: string | null;
  readonly expiresAt: string | null;
  readonly contentSha256: string | null;
  readonly createdAt: string;
}

export interface RegisterMediaResourceRequest {
  readonly id: string;
  readonly kind: MediaResourceKind;
  readonly mimeType: string;
  readonly storageKey?: string;
  readonly upstreamUrl?: string;
  readonly expiresAt?: string;
  readonly contentSha256?: string;
  /** When set, updates an existing row (e.g. ephemeral/local → cloud) instead of creating a duplicate. */
  readonly replacesResourceId?: string;
}

export interface RekeyMediaResourceRequest {
  readonly fromResourceId: string;
  readonly toResourceId: string;
  readonly kind: MediaResourceKind;
  readonly mimeType: string;
  readonly storageKey?: string;
}

export interface RegisterMediaResourcesRequest {
  readonly resources: readonly RegisterMediaResourceRequest[];
}

export interface RegisterMediaResourcesResponse {
  readonly registered: readonly string[];
}

export interface ResolveMediaResourcesRequest {
  readonly resourceIds: readonly string[];
}

export interface ResolvedMediaResourceEntry {
  readonly resourceId: string;
  readonly kind: MediaResourceKind;
  readonly mimeType: string;
  /** Presigned or upstream URL for server-side generation. */
  readonly url?: string;
  /** Cloud object storage key — browser builds same-origin fetch URL. */
  readonly storageKey?: string;
  /** Ephemeral upstream URL — browser builds media proxy fetch URL. */
  readonly upstreamUrl?: string;
  readonly expiresAt?: string;
  readonly contentSha256?: string;
}

export interface ResolveMediaResourcesResponse {
  readonly resolved: readonly ResolvedMediaResourceEntry[];
  readonly unresolved: readonly string[];
}
