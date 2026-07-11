import type { Bindings } from "../../context";
import { decryptSecret, encryptSecret } from "../../utils/encryption";
import type { VolcengineCredentials } from "./client";
import { VOLCANO_API_KEY_RENEW_THRESHOLD_MS } from "./constants";
import { getVolcanoArkApiKey } from "./get-api-key";
import {
  isVolcanoMetadata,
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
}> {
  const metadata = parseInterfaceMetadata(params.metadataRaw);
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

  if (!apiKeyEncrypted || shouldRenewVolcanoApiKey(expiresAt)) {
    const issued = await getVolcanoArkApiKey(credentials);
    apiKey = issued.apiKey;
    expiresAt = issued.expiresAt;
    apiKeyEncrypted = await encryptSecret(
      issued.apiKey,
      params.env,
      params.organizationId
    );
    renewed = true;
  } else {
    apiKey = await decryptSecret(
      apiKeyEncrypted,
      params.env,
      params.organizationId
    );
  }

  const nextMetadata = {
    ...metadata,
    arkApiKeyExpiresAt: expiresAt ?? undefined,
  };

  return {
    metadataRaw: serializeInterfaceMetadata(nextMetadata),
    apiKeyEncrypted,
    apiKey,
    expiresAt,
    renewed,
  };
}

export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) return "****";
  return `${apiKey.slice(0, 4)}…${apiKey.slice(-4)}`;
}
