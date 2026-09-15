import type { PublicCharacterLibraryGroup } from "@dafthunk/types";
import { isPublicCharacterLibraryAssetQuery } from "@dafthunk/types";
import { desc, eq } from "drizzle-orm";

import type { Bindings } from "../context";
import type { Database } from "../db";
import { organizationAiInterfaces } from "../db/schema";
import {
  callVolcengineArkApi,
  VolcengineApiRequestError,
  type VolcengineCredentials,
} from "../integrations/volcengine/client";
import { VOLCANO_DEFAULT_PROJECT_NAME } from "../integrations/volcengine/constants";
import { getVolcanoCredentials } from "../integrations/volcengine/ensure-api-key";
import {
  isVolcanoMetadata,
  parseInterfaceMetadata,
} from "../integrations/volcengine/metadata";
import {
  buildListPublicPortraitsRequest,
  GET_MEDIA_ASSET_ACTION,
  GET_MEDIA_ASSET_GROUP_ACTION,
  LIST_MEDIA_ASSET_GROUP_ACTION,
  PUBLIC_PORTRAIT_PAGE_SIZE,
  parseListMediaAssetGroupResult,
  parseMediaAssetGroupId,
  parsePublicPortraitGroupFromAssetGroup,
} from "../integrations/volcengine/public-character-library";

export interface FetchPublicCharacterLibraryParams {
  readonly env: Bindings;
  readonly db: Database;
  readonly organizationId: string;
  readonly interfaceId?: string;
  readonly query?: string;
  readonly gender?: string | null;
  readonly country?: string | null;
  readonly ageMin?: number | null;
  readonly ageMax?: number | null;
  readonly pageNum: number;
}

async function findOrgVolcanoCredentials(
  env: Bindings,
  db: Database,
  organizationId: string,
  interfaceId?: string
): Promise<VolcengineCredentials> {
  const rows = await db
    .select()
    .from(organizationAiInterfaces)
    .where(eq(organizationAiInterfaces.organizationId, organizationId))
    .orderBy(desc(organizationAiInterfaces.updatedAt));

  const ordered = interfaceId
    ? [
        ...rows.filter((row) => row.id === interfaceId),
        ...rows.filter((row) => row.id !== interfaceId),
      ]
    : rows;

  for (const row of ordered) {
    const metadata = parseInterfaceMetadata(row.metadata);
    if (!isVolcanoMetadata(metadata)) {
      continue;
    }
    try {
      const credentials = await getVolcanoCredentials(
        env,
        row.organizationId,
        row.metadata
      );
      if (credentials?.accessKeyId && credentials.secretAccessKey) {
        return credentials;
      }
    } catch {
      // Try the next volcano interface.
    }
  }

  throw new Error("未找到可用的火山接口凭证，请先配置火山方舟接口");
}

async function fetchExactPublicGroup(
  credentials: VolcengineCredentials,
  query: string
): Promise<{
  readonly groups: readonly PublicCharacterLibraryGroup[];
  readonly total: number;
}> {
  const assetId = query.trim();
  try {
    const asset = await callVolcengineArkApi<unknown>({
      credentials,
      action: GET_MEDIA_ASSET_ACTION,
      body: {
        SID: assetId,
        ProjectName: VOLCANO_DEFAULT_PROJECT_NAME,
        SkipCheckAgreement: true,
      },
    });
    const groupSid = parseMediaAssetGroupId(asset);
    if (!groupSid) {
      return { groups: [], total: 0 };
    }
    const groupResult = await callVolcengineArkApi<unknown>({
      credentials,
      action: GET_MEDIA_ASSET_GROUP_ACTION,
      body: {
        SID: groupSid,
        ProjectName: VOLCANO_DEFAULT_PROJECT_NAME,
      },
    });
    const group = parsePublicPortraitGroupFromAssetGroup(groupResult);
    return group ? { groups: [group], total: 1 } : { groups: [], total: 0 };
  } catch (error) {
    if (
      error instanceof VolcengineApiRequestError &&
      error.code === "NotFound.asset_id"
    ) {
      return { groups: [], total: 0 };
    }
    throw error;
  }
}

export async function fetchPublicCharacterLibrary(
  params: FetchPublicCharacterLibraryParams
): Promise<{
  readonly groups: readonly PublicCharacterLibraryGroup[];
  readonly total: number;
  readonly pageNum: number;
  readonly pageSize: number;
}> {
  const pageNum = Math.max(1, params.pageNum);
  const credentials = await findOrgVolcanoCredentials(
    params.env,
    params.db,
    params.organizationId,
    params.interfaceId
  );
  const query = params.query?.trim() ?? "";

  try {
    if (isPublicCharacterLibraryAssetQuery(query) && pageNum === 1) {
      const exact = await fetchExactPublicGroup(credentials, query);
      return {
        groups: exact.groups,
        total: exact.total,
        pageNum: 1,
        pageSize: PUBLIC_PORTRAIT_PAGE_SIZE,
      };
    }

    const result = await callVolcengineArkApi<unknown>({
      credentials,
      action: LIST_MEDIA_ASSET_GROUP_ACTION,
      body: {
        ...buildListPublicPortraitsRequest({
          pageNum,
          pageSize: PUBLIC_PORTRAIT_PAGE_SIZE,
          query,
          gender: params.gender,
          country: params.country,
          ageMin: params.ageMin,
          ageMax: params.ageMax,
        }),
      } as Record<string, unknown>,
    });
    const parsed = parseListMediaAssetGroupResult(result);
    return {
      groups: parsed.items,
      total: parsed.total,
      pageNum: parsed.pageNum,
      pageSize: parsed.pageSize,
    };
  } catch (error) {
    const message =
      error instanceof VolcengineApiRequestError
        ? `加载失败：${error.message}`
        : error instanceof Error
          ? error.message
          : "加载失败";
    throw new Error(message);
  }
}
