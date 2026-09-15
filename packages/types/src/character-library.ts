import type { ResourceIdReference } from "./media-reference";
import type { MediaResourceKind } from "./media-resource-catalog";

export const CHARACTER_LIBRARY_SOURCE = "character_library" as const;
export const CHARACTER_LIBRARY_NODE_META_KEY = "characterLibrary" as const;
export const CHARACTER_LIBRARY_ASSET_ID_META_KEY =
  "characterLibraryAssetId" as const;
export const CHARACTER_LIBRARY_CATEGORIES = [
  "image",
  "video",
  "audio",
] as const;
export type CharacterLibraryCategory =
  (typeof CHARACTER_LIBRARY_CATEGORIES)[number];
export const CHARACTER_LIBRARY_TABS = [
  "character",
  ...CHARACTER_LIBRARY_CATEGORIES,
] as const;
export type CharacterLibraryTab = (typeof CHARACTER_LIBRARY_TABS)[number];

export function isCharacterLibraryCategory(
  value: string | null | undefined
): value is CharacterLibraryCategory {
  return value === "image" || value === "video" || value === "audio";
}

export function isCharacterLibraryTab(
  value: string | null | undefined
): value is CharacterLibraryTab {
  return value === "character" || isCharacterLibraryCategory(value);
}

export function characterLibraryCategoryFromMime(
  mimeType: string | null | undefined
): CharacterLibraryCategory | null {
  const mime = mimeType?.toLowerCase() ?? "";
  if (mime.startsWith("image/")) {
    return "image";
  }
  if (mime.startsWith("video/")) {
    return "video";
  }
  if (mime.startsWith("audio/")) {
    return "audio";
  }
  return null;
}

export function characterLibraryEntryCategory(
  entry: Pick<CharacterLibraryEntry, "category" | "mimeType">
): CharacterLibraryCategory | null {
  if (isCharacterLibraryCategory(entry.category)) {
    return entry.category;
  }
  return characterLibraryCategoryFromMime(entry.mimeType);
}

/** A character library entry — only a resource ID reference, no copied media. */
export interface CharacterLibraryEntry {
  readonly resourceId: string;
  readonly kind: MediaResourceKind;
  readonly mimeType: string;
  readonly modelCanonicalId: string | null;
  readonly interfaceId: string | null;
  readonly createdAt: string;
  /** Workflow this character was added from. Null = legacy / current canvas. */
  readonly workflowId?: string | null;
  /** image | video | audio. Missing = infer from mimeType. */
  readonly category?: CharacterLibraryCategory | null;
  /** Volcano private asset library import ("asset://<id>" when active). */
  readonly upstreamAssetId?: string | null;
  /** Import status: pending | active | failed. Absent = not imported. */
  readonly upstreamAssetStatus?: "pending" | "active" | "failed" | null;
  /** Original cover URL. Public portraits skip our storage. */
  readonly previewUrl?: string | null;
}

export const PUBLIC_CHARACTER_LIBRARY_RESOURCE_PREFIX = "public:" as const;
export const PUBLIC_CHARACTER_LIBRARY_PAGE_SIZE = 30;
export const PUBLIC_CHARACTER_LIBRARY_AGE_MIN = 0;
export const PUBLIC_CHARACTER_LIBRARY_AGE_MAX = 100;
export const PUBLIC_CHARACTER_LIBRARY_GENDERS = ["男", "女"] as const;
export const PUBLIC_CHARACTER_LIBRARY_COUNTRIES = [
  "中国",
  "美国",
  "加拿大",
  "墨西哥",
  "巴西",
  "阿根廷",
  "智利",
  "哥伦比亚",
  "秘鲁",
  "乌拉圭",
  "巴拉圭",
  "玻利维亚",
  "厄瓜多尔",
  "委内瑞拉",
  "巴拿马",
  "哥斯达黎加",
  "危地马拉",
  "古巴",
  "多米尼加",
  "牙买加",
  "海地",
  "洪都拉斯",
  "尼加拉瓜",
  "萨尔瓦多",
  "特立尼达和多巴哥",
  "巴哈马",
  "巴巴多斯",
  "英国",
  "爱尔兰",
  "法国",
  "德国",
  "西班牙",
  "葡萄牙",
  "意大利",
  "荷兰",
  "比利时",
  "卢森堡",
  "瑞士",
  "奥地利",
  "捷克",
  "波兰",
  "匈牙利",
  "罗马尼亚",
  "保加利亚",
  "希腊",
  "瑞典",
  "挪威",
  "芬兰",
  "丹麦",
  "冰岛",
  "俄罗斯",
  "乌克兰",
  "白俄罗斯",
  "立陶宛",
  "拉脱维亚",
  "爱沙尼亚",
  "土耳其",
  "以色列",
  "沙特阿拉伯",
  "阿联酋",
  "卡塔尔",
  "科威特",
  "巴林",
  "阿曼",
  "约旦",
  "黎巴嫩",
  "叙利亚",
  "伊拉克",
  "伊朗",
  "埃及",
  "南非",
  "尼日利亚",
  "肯尼亚",
  "埃塞俄比亚",
  "加纳",
  "摩洛哥",
  "突尼斯",
  "阿尔及利亚",
  "利比亚",
  "乌干达",
  "坦桑尼亚",
  "塞内加尔",
  "科特迪瓦",
  "澳大利亚",
  "新西兰",
  "印度",
  "巴基斯坦",
  "孟加拉国",
  "斯里兰卡",
  "尼泊尔",
  "不丹",
  "缅甸",
  "泰国",
  "越南",
  "马来西亚",
  "新加坡",
  "印度尼西亚",
  "菲律宾",
  "日本",
  "韩国",
  "朝鲜",
  "蒙古",
] as const;

export function isPublicCharacterLibraryAssetQuery(
  query: string | null | undefined
): boolean {
  return Boolean(query && /^asset-\d+/.test(query.trim()));
}

export interface PublicCharacterLibraryItem {
  readonly assetId: string;
  readonly imageUrl: string;
}

export interface PublicCharacterLibraryGroup {
  readonly groupId: string;
  readonly name: string;
  readonly imageUrl: string;
  readonly gender?: string | null;
  readonly age?: number | null;
  readonly country?: string | null;
  readonly items: readonly PublicCharacterLibraryItem[];
}

export interface ListPublicCharacterLibraryResponse {
  readonly groups: readonly PublicCharacterLibraryGroup[];
  readonly total: number;
  readonly offset: number;
  readonly limit: number;
}

export interface CharacterLibraryCharacter {
  readonly id: string;
  readonly name: string;
  readonly workflowId: string | null;
  readonly createdAt: string;
  readonly items: readonly CharacterLibraryEntry[];
}

export interface ListCharacterLibraryResponse {
  readonly entries: readonly CharacterLibraryEntry[];
  readonly characters?: readonly CharacterLibraryCharacter[];
  /** Asset group id stored on the interface (brand) metadata, if created. */
  readonly groupId?: string | null;
}

export interface CreateCharacterLibraryCharacterRequest {
  readonly name: string;
  readonly workflowId?: string;
}

export interface AddCharacterLibraryCharacterItemRequest {
  readonly resourceId: string;
}

export function characterLibraryCharacterCover(
  items: readonly CharacterLibraryEntry[]
): CharacterLibraryEntry | null {
  for (const item of items) {
    const category = characterLibraryEntryCategory(item);
    if (category === "image" || category === "video") {
      return item;
    }
  }
  return null;
}

export function characterLibraryCharacterWorkflowId(
  character: Pick<CharacterLibraryCharacter, "workflowId">,
  canvasWorkflowId: string | null | undefined
): string | null {
  return characterLibraryEntryWorkflowId(character, canvasWorkflowId);
}

export interface AddCharacterLibraryRequest {
  readonly resourceId: string;
  readonly modelCanonicalId?: string;
  readonly interfaceId?: string;
  readonly workflowId?: string;
  readonly category?: CharacterLibraryCategory;
}

export function characterLibraryEntryWorkflowId(
  entry: Pick<CharacterLibraryEntry, "workflowId">,
  canvasWorkflowId: string | null | undefined
): string | null {
  const stored = entry.workflowId?.trim();
  if (stored) {
    return stored;
  }
  const canvas = canvasWorkflowId?.trim();
  return canvas ? canvas : null;
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

export function publicCharacterLibraryResourceId(assetId: string): string {
  const id = normalizeCharacterLibraryAssetId(assetId);
  return id ? `${PUBLIC_CHARACTER_LIBRARY_RESOURCE_PREFIX}${id}` : "";
}

export function isPublicCharacterLibraryResourceId(
  resourceId: string | null | undefined
): boolean {
  return Boolean(
    resourceId?.startsWith(PUBLIC_CHARACTER_LIBRARY_RESOURCE_PREFIX)
  );
}

/** Public portraits are display/generate-only — never our storage. */
export function readPublicCharacterLibraryAssetId(
  resourceId: string | null | undefined
): string | null {
  if (!isPublicCharacterLibraryResourceId(resourceId) || !resourceId) {
    return null;
  }
  return normalizeCharacterLibraryAssetId(
    resourceId.slice(PUBLIC_CHARACTER_LIBRARY_RESOURCE_PREFIX.length)
  );
}

export function characterLibraryEntryFromPublicPortrait(
  item: Pick<PublicCharacterLibraryItem, "assetId" | "imageUrl">
): CharacterLibraryEntry | null {
  const assetId = normalizeCharacterLibraryAssetId(item.assetId);
  const imageUrl = item.imageUrl.trim();
  if (!assetId || !imageUrl) {
    return null;
  }
  return {
    resourceId: publicCharacterLibraryResourceId(assetId),
    kind: "cloud",
    mimeType: "image/jpeg",
    modelCanonicalId: null,
    interfaceId: null,
    createdAt: "",
    category: "image",
    upstreamAssetId: assetId,
    upstreamAssetStatus: "active",
    previewUrl: imageUrl,
  };
}

export function characterLibraryCharacterFromPublicGroup(
  group: PublicCharacterLibraryGroup
): CharacterLibraryCharacter {
  return {
    id: group.groupId,
    name: group.name,
    workflowId: null,
    createdAt: "",
    items: group.items
      .map((item) => characterLibraryEntryFromPublicPortrait(item))
      .filter((entry): entry is CharacterLibraryEntry => entry !== null),
  };
}

export function characterLibraryReferenceFromEntry(
  entry: Pick<
    CharacterLibraryEntry,
    | "resourceId"
    | "kind"
    | "mimeType"
    | "upstreamAssetId"
    | "upstreamAssetStatus"
    | "previewUrl"
  >
): ResourceIdReference | null {
  if (entry.upstreamAssetStatus !== "active") {
    return null;
  }
  const assetId = normalizeCharacterLibraryAssetId(entry.upstreamAssetId);
  if (!assetId) {
    return null;
  }
  const previewUrl = entry.previewUrl?.trim();
  return {
    resourceId: entry.resourceId,
    kind: entry.kind,
    mimeType: entry.mimeType,
    characterLibrary: true,
    upstreamAssetId: assetId,
    ...(previewUrl ? { previewUrl } : {}),
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
