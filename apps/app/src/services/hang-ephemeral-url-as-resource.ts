import {
  createEphemeralMediaExpiresAt,
  type ResourceIdReference,
} from "@dafthunk/types";

import { allocateGenerativeMediaResourceId } from "@/services/allocate-generative-media-resource-id";
import { registerMediaResource } from "@/services/register-media-resource";

export async function hangEphemeralUrlAsResource(params: {
  readonly organizationId: string;
  readonly sourceUrl: string;
  readonly mimeType: string;
}): Promise<ResourceIdReference> {
  const mimeType = params.mimeType.trim() || "image/png";
  const resourceId = allocateGenerativeMediaResourceId();
  await registerMediaResource({
    organizationId: params.organizationId,
    id: resourceId,
    kind: "ephemeral",
    mimeType,
    upstreamUrl: params.sourceUrl,
    expiresAt: createEphemeralMediaExpiresAt(),
  });
  return { resourceId, mimeType, kind: "ephemeral" };
}
