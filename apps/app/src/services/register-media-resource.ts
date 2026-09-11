import type {
  MediaResourceKind,
  RegisterMediaResourcesResponse,
} from "@dafthunk/types";

import { makeRequest } from "@/services/utils";

export async function registerMediaResource(params: {
  readonly organizationId: string;
  readonly id: string;
  readonly kind: MediaResourceKind;
  readonly mimeType: string;
  readonly storageKey?: string;
  readonly upstreamUrl?: string;
  readonly expiresAt?: string;
}): Promise<void> {
  await makeRequest<RegisterMediaResourcesResponse>(
    `/${params.organizationId}/resources`,
    {
      method: "POST",
      body: JSON.stringify({
        id: params.id,
        kind: params.kind,
        mimeType: params.mimeType,
        ...(params.storageKey ? { storageKey: params.storageKey } : {}),
        ...(params.upstreamUrl ? { upstreamUrl: params.upstreamUrl } : {}),
        ...(params.expiresAt ? { expiresAt: params.expiresAt } : {}),
      }),
    }
  );
}
