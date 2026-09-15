import type { ResourceIdReference } from "./media-reference";
import type { MediaResourceKind } from "./media-resource-catalog";

export const CHARACTER_LIBRARY_SOURCE = "character_library" as const;
export const CHARACTER_LIBRARY_NODE_META_KEY = "characterLibrary" as const;
export const CHARACTER_LIBRARY_ASSET_ID_META_KEY =
  "characterLibraryAssetId" as const;

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
  /** Asset group id stored on the interface (brand) metadata, if created. */
  readonly groupId?: string | null;
}

export interface AddCharacterLibraryRequest {
  readonly resourceId: string;
  readonly modelCanonicalId?: string;
  readonly interfaceId?: string;
}

export interface CharacterLibraryStatusResponse {
  readonly enabled: boolean;
}

export function normalizeCharacterLibraryAssetId(
  assetId: string | null | undefined
): string | null {
  if (!assetId) {
    return null;
  }
  const id = assetId.replace(/^asset:\/\//, "").trim();
  return id.length > 0 ? id : null;
}

export function toCharacterLibraryAssetUrl(assetId: string): string {
  const id = normalizeCharacterLibraryAssetId(assetId);
  return id ? `asset://${id}` : "";
}

export function readCharacterLibrarySubmitUrl(params: {
  readonly source: string | null | undefined;
  readonly upstreamAssetId: string | null | undefined;
  readonly upstreamAssetStatus: string | null | undefined;
}): string | null {
  if (params.source !== CHARACTER_LIBRARY_SOURCE) {
    return null;
  }
  if (params.upstreamAssetStatus !== "active") {
    return null;
  }
  const id = normalizeCharacterLibraryAssetId(params.upstreamAssetId);
  return id ? toCharacterLibraryAssetUrl(id) : null;
}

export function characterLibraryReferenceFromEntry(
  entry: Pick<
    CharacterLibraryEntry,
    | "resourceId"
    | "kind"
    | "mimeType"
    | "upstreamAssetId"
    | "upstreamAssetStatus"
  >
): ResourceIdReference | null {
  if (entry.upstreamAssetStatus !== "active") {
    return null;
  }
  const assetId = normalizeCharacterLibraryAssetId(entry.upstreamAssetId);
  if (!assetId) {
    return null;
  }
  return {
    resourceId: entry.resourceId,
    kind: entry.kind,
    mimeType: entry.mimeType,
    characterLibrary: true,
    upstreamAssetId: assetId,
  };
}

export function withCharacterLibraryNodeMetadata(
  metadata: Record<string, string> | undefined,
  assetId: string
): Record<string, string> {
  const normalized = normalizeCharacterLibraryAssetId(assetId) ?? assetId;
  return {
    ...(metadata ?? {}),
    [CHARACTER_LIBRARY_NODE_META_KEY]: "true",
    [CHARACTER_LIBRARY_ASSET_ID_META_KEY]: normalized,
  };
}

export function isCharacterLibraryNodeMetadata(
  metadata: Record<string, string> | undefined
): boolean {
  return metadata?.[CHARACTER_LIBRARY_NODE_META_KEY] === "true";
}
