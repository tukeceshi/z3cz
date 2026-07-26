import type { Bindings } from "../../context";
import { decryptSecret, encryptSecret } from "../../utils/encryption";
import { canDeferVolcanoArkApiKey } from "./can-defer-volcano-ark-api-key";
import type { VolcengineCredentials } from "./client";
import { VOLCANO_API_KEY_RENEW_THRESHOLD_MS } from "./constants";
import {
  decryptVolcanoArkApiKeyIfPresent,
  isDeferredVolcanoArkApiKey,
  isVolcanoArkApiKeyPending,
} from "./deferred-api-key";
import {
  applyVolcanoArkKeyScope,
  ensureVolcanoModelEndpoints,
} from "./ensure-volcano-endpoints";
import { isVolcanoArkNotOpenedError } from "./errors";
import { getVolcanoArkApiKey } from "./get-api-key";
import {
  isVolcanoMetadata,
  normalizeVolcanoInterfaceMetadata,
  parseInterfaceMetadata,
  serializeInterfaceMetadata,
} from "./metadata";

export function getVolcanoApiKeyStatus(
  expiresAt: string | null | undefined,
  renewFailed = false
): "active" | "expiring_soon" | "expired" | "renew_failed" {
  if (renewFailed) return "renew_failed";
  if (!expiresAt) return "expired";
  const expiresMs = Date.parse(expiresAt);
  if (Number.isNaN(expiresMs)) return "expired";
  if (expiresMs <= Date.now()) return "expired";
  if (expiresMs - Date.now() < VOLCANO_API_KEY_RENEW_THRESHOLD_MS) {
    return "expiring_soon";
  }
  return "active";
}

export function shouldRenewVolcanoApiKey(
  expiresAt: string | null | undefined
): boolean {
  if (!expiresAt) return true;
  const expiresMs = Date.parse(expiresAt);
  if (Number.isNaN(expiresMs)) return true;
  if (expiresMs <= Date.now()) return true;
  return expiresMs - Date.now() < VOLCANO_API_KEY_RENEW_THRESHOLD_MS;
}

export async function getVolcanoCredentials(
  env: Bindings,
  organizationId: string,
  metadataRaw: string | null
): Promise<VolcengineCredentials | null> {
  const metadata = parseInterfaceMetadata(metadataRaw);
  if (!isVolcanoMetadata(metadata)) return null;

  const secretAccessKey = await decryptSecret(
    metadata.secretAccessKeyEncrypted,
    env,
    organizationId
  );

  return {
    accessKeyId: metadata.accessKeyId,
    secretAccessKey,
    region: metadata.region,
  };
}

/**
 * Unified Volcano Ark access: ensure endpoints, issue one interface-level API key,
 * persist scope + endpoint map on metadata.
 */
export async function ensureVolcanoApiKey(params: {
  env: Bindings;
  organizationId: string;
  metadataRaw: string | null;
  apiKeyEncrypted: string;
}): Promise<{
  metadataRaw: string;
  apiKeyEncrypted: string;
  apiKey: string;
  expiresAt: string | null;
  renewed: boolean;
  metadataChanged: boolean;
}> {
  let metadata = normalizeVolcanoInterfaceMetadata(
    parseInterfaceMetadata(params.metadataRaw)
  );
  if (!isVolcanoMetadata(metadata)) {
    throw new Error("Volcano metadata not configured");
  }

  const credentials = await getVolcanoCredentials(
    params.env,
    params.organizationId,
    params.metadataRaw
  );
  if (!credentials) {
    throw new Error("Volcano credentials not configured");
  }

  let apiKeyEncrypted = params.apiKeyEncrypted;
  let apiKey = "";
  let expiresAt = metadata.arkApiKeyExpiresAt ?? null;
  let renewed = false;
  let metadataChanged = false;

  const endpointEnsure = await ensureVolcanoModelEndpoints({
    credentials,
    metadata,
  });
  if (endpointEnsure.changed) {
    metadata = endpointEnsure.metadata;
    metadataChanged = true;
  }

  const decryptedExisting = await decryptVolcanoArkApiKeyIfPresent(
    apiKeyEncrypted,
    params.env,
    params.organizationId
  );
  const keyPending = isVolcanoArkApiKeyPending(metadata, decryptedExisting);

  if (keyPending || shouldRenewVolcanoApiKey(expiresAt)) {
    try {
      const issued = await getVolcanoArkApiKey(credentials, { metadata });
      apiKey = issued.apiKey;
      expiresAt = issued.expiresAt;
      apiKeyEncrypted = await encryptSecret(
        issued.apiKey,
        params.env,
        params.organizationId
      );
      metadata = applyVolcanoArkKeyScope({
        metadata,
        scope: issued.scope,
      });
      renewed = true;
      metadataChanged = true;
    } catch (error) {
      if (!isVolcanoArkNotOpenedError(error)) {
        throw error;
      }

      if (
        decryptedExisting &&
        !isDeferredVolcanoArkApiKey(decryptedExisting)
      ) {
        apiKey = decryptedExisting;
      } else if (await canDeferVolcanoArkApiKey({ credentials })) {
        apiKey = "";
        expiresAt = null;
      } else {
        throw error;
      }
    }
  } else if (decryptedExisting) {
    apiKey = decryptedExisting;
  }

  const nextMetadata = {
    ...metadata,
    arkApiKeyExpiresAt: expiresAt ?? undefined,
    arkApiKeyPending: apiKey ? undefined : true,
  };

  const nextMetadataRaw = serializeInterfaceMetadata(nextMetadata);
  if (nextMetadataRaw !== params.metadataRaw) {
    metadataChanged = true;
  }

  return {
    metadataRaw: nextMetadataRaw,
    apiKeyEncrypted,
    apiKey,
    expiresAt,
    renewed,
    metadataChanged,
  };
}

export function maskApiKey(apiKey: string): string {
  if (!apiKey) return "—";
  if (isDeferredVolcanoArkApiKey(apiKey)) return "—";
  if (apiKey.length <= 8) return "****";
  return `${apiKey.slice(0, 4)}…${apiKey.slice(-4)}`;
}

export {
  decryptVolcanoArkApiKeyIfPresent,
  encryptDeferredVolcanoArkApiKey,
  isVolcanoArkApiKeyPending,
} from "./deferred-api-key";
