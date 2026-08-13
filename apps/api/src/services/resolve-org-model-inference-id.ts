import type { OrgModelChannelKind } from "@dafthunk/types";

import type { Database } from "../db";
import { resolveVolcanoInferenceModelIdAfterEnsure } from "../integrations/volcengine/resolve-inference-model-id";

/**
 * Resolve the upstream `model` field for generation.
 * API channel uses the binding upstream id directly; aggregate re-reads metadata after ensure.
 */
export async function resolveOrgModelInferenceModelId(params: {
  readonly db: Database;
  readonly organizationId: string;
  readonly interfaceId: string;
  readonly canonicalId: string;
  readonly instanceId?: string;
  readonly channelKind: OrgModelChannelKind;
  readonly upstreamModelId: string;
}): Promise<string | null> {
  const trimmed = params.upstreamModelId.trim();
  if (params.channelKind === "api") {
    return trimmed || null;
  }

  return resolveVolcanoInferenceModelIdAfterEnsure({
    db: params.db,
    organizationId: params.organizationId,
    interfaceId: params.interfaceId,
    canonicalId: params.canonicalId,
    instanceId: params.instanceId,
  });
}
