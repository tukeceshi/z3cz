import type { VolcanoInterfaceMetadata } from "@dafthunk/types";

import type { Bindings } from "../../context";
import { decryptSecret, encryptSecret } from "../../utils/encryption";

/** Stored in api_key_encrypted when Ark key issuance is deferred. */
export const VOLCANO_ARK_API_KEY_DEFERRED_PLACEHOLDER =
  "__VOLCANO_ARK_KEY_DEFERRED__" as const;

export function isDeferredVolcanoArkApiKey(apiKey: string): boolean {
  return apiKey === VOLCANO_ARK_API_KEY_DEFERRED_PLACEHOLDER;
}

export function isVolcanoArkApiKeyPending(
  metadata: VolcanoInterfaceMetadata,
  decryptedApiKey?: string | null
): boolean {
  if (metadata.arkApiKeyPending === true) {
    return true;
  }
  if (decryptedApiKey && isDeferredVolcanoArkApiKey(decryptedApiKey)) {
    return true;
  }
  return false;
}

export async function encryptDeferredVolcanoArkApiKey(
  env: Bindings,
  organizationId: string
): Promise<string> {
  return encryptSecret(
    VOLCANO_ARK_API_KEY_DEFERRED_PLACEHOLDER,
    env,
    organizationId
  );
}

export async function decryptVolcanoArkApiKeyIfPresent(
  apiKeyEncrypted: string,
  env: Bindings,
  organizationId: string
): Promise<string | null> {
  if (!apiKeyEncrypted) {
    return null;
  }
  return decryptSecret(apiKeyEncrypted, env, organizationId);
}
