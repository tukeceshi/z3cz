import type {
  PublicCharacterLibraryGroup,
  PublicCharacterLibraryItem,
} from "@dafthunk/types";
import { normalizeCharacterLibraryAssetId } from "@dafthunk/types";

import { VOLCANO_DEFAULT_PROJECT_NAME } from "./constants";

export const PUBLIC_PORTRAIT_TYPE_FILTER = {
  Field: "metadata.type",
  Op: "must",
  Conds: { StrValues: ["portrait"] },
} as const;

export const LIST_MEDIA_ASSET_GROUP_ACTION = "ListMediaAssetGroup" as const;
export const GET_MEDIA_ASSET_ACTION = "GetMediaAsset" as const;
export const GET_MEDIA_ASSET_GROUP_ACTION = "GetMediaAssetGroup" as const;
export const PUBLIC_PORTRAIT_PAGE_SIZE = 30;

export interface ListMediaAssetGroupRequest {
  readonly Query?: { readonly Text?: string };
  readonly Filters?: readonly Record<string, unknown>[];
  readonly PageNum: number;
  readonly PageSize: number;
  readonly ProjectName?: string;
  readonly SortBy?: string;
  readonly SortOrder?: string;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readHttpUrl(value: unknown): string | null {
  const url = readString(value);
  if (!url) {
    return null;
  }
  return /^https?:\/\//i.test(url) ? url : null;
}

function readMetadata(group: Record<string, unknown>): {
  readonly gender: string | null;
  readonly age: number | null;
  readonly country: string | null;
} {
  const metadata =
    asRecord(group["Metadata"]) ?? asRecord(group["metadata"]) ?? {};
  return {
    gender: readString(metadata["gender"]) ?? readString(metadata["Gender"]),
    age: readNumber(metadata["age"]) ?? readNumber(metadata["Age"]),
    country: readString(metadata["country"]) ?? readString(metadata["Country"]),
  };
}

function readImages(
  group: Record<string, unknown>
): readonly PublicCharacterLibraryItem[] {
  const content = asRecord(group["Content"]);
  const images = content?.["Image"];
  if (!Array.isArray(images)) {
    return [];
  }
  const items: PublicCharacterLibraryItem[] = [];
  const seen = new Set<string>();
  for (const raw of images) {
    const image = asRecord(raw);
    if (!image) {
      continue;
    }
    const assetId = normalizeCharacterLibraryAssetId(
      readString(image["AssetID"]) ?? readString(image["AssetId"])
    );
    const imageUrl =
      readHttpUrl(image["CoverURL"]) ??
      readHttpUrl(image["CoverUrl"]) ??
      readHttpUrl(image["URL"]) ??
      readHttpUrl(image["Url"]);
    if (!assetId || !imageUrl || seen.has(assetId)) {
      continue;
    }
    seen.add(assetId);
    items.push({ assetId, imageUrl });
  }
  return items;
}

export function parsePublicPortraitGroupFromAssetGroup(
  raw: unknown
): PublicCharacterLibraryGroup | null {
  const record = asRecord(raw);
  if (!record) {
    return null;
  }
  const group = asRecord(record["AssetGroup"]) ?? record;
  const items = readImages(group);
  if (items.length === 0) {
    return null;
  }
  const groupId =
    readString(group["SID"]) ?? readString(group["Id"]) ?? items[0]!.assetId;
  const metadata = readMetadata(group);
  return {
    groupId,
    name: readString(group["Title"]) ?? readString(group["Name"]) ?? groupId,
    imageUrl: items[0]!.imageUrl,
    gender: metadata.gender,
    age: metadata.age,
    country: metadata.country,
    items,
  };
}

export function parseListMediaAssetGroupResult(result: unknown): {
  readonly items: readonly PublicCharacterLibraryGroup[];
  readonly total: number;
  readonly pageNum: number;
  readonly pageSize: number;
} {
  const record = asRecord(result) ?? {};
  const rawItems = record["Items"];
  const items = Array.isArray(rawItems)
    ? rawItems
        .map((item) => parsePublicPortraitGroupFromAssetGroup(item))
        .filter((item): item is PublicCharacterLibraryGroup => item !== null)
    : [];
  return {
    items,
    total: readNumber(record["Total"]) ?? items.length,
    pageNum: readNumber(record["PageNum"]) ?? 1,
    pageSize: readNumber(record["PageSize"]) ?? items.length,
  };
}

export function parseMediaAssetGroupId(result: unknown): string | null {
  const record = asRecord(result);
  if (!record) {
    return null;
  }
  const asset = asRecord(record["Asset"]);
  return (
    readString(record["GroupID"]) ??
    readString(record["GroupId"]) ??
    readString(asset?.["GroupID"]) ??
    readString(asset?.["GroupId"])
  );
}

export function buildListPublicPortraitsRequest(params: {
  readonly pageNum: number;
  readonly pageSize?: number;
  readonly query?: string;
  readonly gender?: string | null;
  readonly country?: string | null;
  readonly ageMin?: number | null;
  readonly ageMax?: number | null;
}): ListMediaAssetGroupRequest {
  const query = params.query?.trim() ?? "";
  const filters: Record<string, unknown>[] = [PUBLIC_PORTRAIT_TYPE_FILTER];
  const gender = params.gender?.trim();
  if (gender && gender !== "all") {
    filters.push({
      Field: "metadata.gender",
      Op: "must",
      Conds: { StrValues: [gender] },
    });
  }
  const country = params.country?.trim();
  if (country && country !== "all") {
    filters.push({
      Field: "metadata.country",
      Op: "must",
      Conds: { StrValues: [country] },
    });
  }
  const ageMin = params.ageMin;
  const ageMax = params.ageMax;
  if (
    typeof ageMin === "number" &&
    typeof ageMax === "number" &&
    (ageMin > 0 || ageMax < 100)
  ) {
    filters.push({
      Field: "metadata.age",
      Op: "range",
      Gte: ageMin,
      Lte: ageMax,
    });
  }
  return {
    Query: query ? { Text: query } : {},
    Filters: filters,
    PageNum: params.pageNum,
    PageSize: params.pageSize ?? PUBLIC_PORTRAIT_PAGE_SIZE,
    ProjectName: VOLCANO_DEFAULT_PROJECT_NAME,
    ...(query ? {} : { SortBy: "score", SortOrder: "desc" }),
  };
}
