import { resolveVolcanoInferenceModelId } from "@dafthunk/types";

import type { Database } from "../../db";
import { getOrganizationAiInterfaceRow } from "../../db/ai-interface-queries";
import {
  isVolcanoMetadata,
  parseInterfaceMetadata,
} from "./metadata";
import { parseSingleModelMetadata } from "../single-model/metadata";

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
    const upstreamModelId =
      singleModelMetadata.models[params.canonicalId]?.upstreamModelId?.trim();
    return upstreamModelId || null;
  }

  const providerModelId =
    metadata.models[params.canonicalId]?.providerModelId?.trim();
  if (!providerModelId) {
    return null;
  }

  return resolveVolcanoInferenceModelId({
    canonicalId: params.canonicalId,
    providerModelId,
    metadata,
  });
}
