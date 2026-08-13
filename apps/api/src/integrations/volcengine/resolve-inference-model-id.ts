import {
  findEnabledOrgModelInstanceByCanonicalId,
  findEnabledSingleModelInstanceByCanonicalId,
  listOrgModelEntries,
  readOrgModelUpstreamId,
  resolveVolcanoInferenceModelId,
} from "@dafthunk/types";

import type { Database } from "../../db";
import { getOrganizationAiInterfaceRow } from "../../db/ai-interface-queries";
import { parseSingleModelMetadata } from "../single-model/metadata";
import {
  isVolcanoMetadata,
  parseInterfaceMetadata,
} from "./metadata";

/**
 * Resolve the chat/inference `model` field after `ensureVolcanoApiKey` may have
 * updated interface metadata (arkEndpoints, arkApiKeyScope).
 *
 * Upstream IDs come only from interface metadata — never from platform defaults.
 */
export async function resolveVolcanoInferenceModelIdAfterEnsure(params: {
  readonly db: Database;
  readonly organizationId: string;
  readonly interfaceId: string;
  readonly canonicalId: string;
  readonly instanceId?: string;
}): Promise<string | null> {
  const row = await getOrganizationAiInterfaceRow(
    params.db,
    params.organizationId,
    params.interfaceId
  );
  if (!row) {
    return null;
  }

  const metadata = parseInterfaceMetadata(row.metadata);
  if (!isVolcanoMetadata(metadata)) {
    const singleModelMetadata = parseSingleModelMetadata(metadata);
    if (!singleModelMetadata) {
      return null;
    }
    const found = params.instanceId
      ? singleModelMetadata.models[params.instanceId]?.enabled
        ? {
            instanceId: params.instanceId,
            config: singleModelMetadata.models[params.instanceId]!,
          }
        : null
      : findEnabledSingleModelInstanceByCanonicalId(
          singleModelMetadata,
          params.canonicalId
        );
    const upstreamModelId = found?.config.upstreamModelId?.trim();
    return upstreamModelId || null;
  }

  const volcanoEntries = listOrgModelEntries(metadata.models);
  const found = params.instanceId
    ? volcanoEntries.find(
        (entry) =>
          entry.instanceId === params.instanceId && entry.config.enabled
      )
    : findEnabledOrgModelInstanceByCanonicalId(volcanoEntries, params.canonicalId);
  const providerModelId = readOrgModelUpstreamId(found?.config);
  if (!providerModelId || !found) {
    return null;
  }

  return resolveVolcanoInferenceModelId({
    canonicalId: found.config.canonicalId,
    providerModelId,
    metadata: {
      arkEndpoints: metadata.arkEndpoints,
      arkApiKeyScope: metadata.arkApiKeyScope,
    },
  });
}
