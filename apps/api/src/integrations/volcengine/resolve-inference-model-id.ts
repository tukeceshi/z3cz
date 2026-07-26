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
 */
export async function resolveVolcanoInferenceModelIdAfterEnsure(params: {
  readonly db: Database;
  readonly organizationId: string;
  readonly interfaceId: string;
  readonly canonicalId: string;
  readonly catalogProviderModelId: string;
}): Promise<string> {
  const row = await getOrganizationAiInterfaceRow(
    params.db,
    params.organizationId,
    params.interfaceId
  );
  if (!row) {
    return params.catalogProviderModelId;
  }

  const metadata = parseInterfaceMetadata(row.metadata);
  if (!isVolcanoMetadata(metadata)) {
    const singleModelMetadata = parseSingleModelMetadata(metadata);
    if (singleModelMetadata) {
      const modelConfig = singleModelMetadata.models[params.canonicalId];
      const upstreamModelId = modelConfig?.upstreamModelId?.trim();
      if (upstreamModelId) {
        return upstreamModelId;
      }
    }
    return params.catalogProviderModelId;
  }

  return resolveVolcanoInferenceModelId({
    canonicalId: params.canonicalId,
    providerModelId: params.catalogProviderModelId,
    metadata,
  });
}
