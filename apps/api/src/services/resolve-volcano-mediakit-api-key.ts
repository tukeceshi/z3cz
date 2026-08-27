import type { VolcanoInterfaceMetadata } from "@dafthunk/types";

import type { Bindings } from "../context";
import { decryptSecret } from "../utils/encryption";
import {
  isVolcanoMetadata,
  parseInterfaceMetadata,
} from "../integrations/volcengine/metadata";

export async function resolveVolcanoMediaKitApiKey(params: {
  readonly env: Bindings;
  readonly organizationId: string;
  readonly metadataRaw: string | null;
}): Promise<string | null> {
  const metadata = parseInterfaceMetadata(params.metadataRaw);
  if (!isVolcanoMetadata(metadata)) {
    return null;
  }

  const encrypted = metadata.mediaKitApiKeyEncrypted?.trim();
  if (!encrypted) {
    return null;
  }

  return decryptSecret(encrypted, params.env, params.organizationId);
}

export function readVolcanoMediaKitApiKeyFromMetadata(
  metadata: VolcanoInterfaceMetadata | null | undefined
): boolean {
  return Boolean(metadata?.mediaKitApiKeyEncrypted?.trim());
}
