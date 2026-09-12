import type { MediaResourceKind } from "./media-resource-catalog";

/** A character library entry — only a resource ID reference, no copied media. */
export interface CharacterLibraryEntry {
  readonly resourceId: string;
  readonly kind: MediaResourceKind;
  readonly mimeType: string;
  readonly modelCanonicalId: string | null;
  readonly interfaceId: string | null;
  readonly createdAt: string;
  /** Volcano private asset library import ("asset://<id>" when active). */
  readonly upstreamAssetId?: string | null;
  /** Import status: pending | active | failed. Absent = not imported. */
  readonly upstreamAssetStatus?: "pending" | "active" | "failed" | null;
}

export interface ListCharacterLibraryResponse {
  readonly entries: readonly CharacterLibraryEntry[];
}

export interface AddCharacterLibraryRequest {
  readonly resourceId: string;
  readonly modelCanonicalId?: string;
  readonly interfaceId?: string;
}

export interface CharacterLibraryStatusResponse {
  readonly enabled: boolean;
}
