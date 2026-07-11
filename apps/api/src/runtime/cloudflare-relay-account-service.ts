import type { RelayAccountProvider } from "@dafthunk/types";
import type { RelayAccountService, ResolvedRelayAccount } from "@dafthunk/runtime";

import type { Bindings } from "../context";
import { createDatabase } from "../db";
import {
  getDefaultPlatformRelayAccountRow,
  getPlatformRelayAccountRowById,
} from "../db/platform-relay-account-queries";
import {
  decryptSecret,
  PLATFORM_ENCRYPTION_SCOPE,
} from "../utils/encryption";

function resolveEnvFallback(
  env: Bindings,
  provider: RelayAccountProvider
): ResolvedRelayAccount | undefined {
  if (provider !== "newapi") {
    return undefined;
  }

  const baseUrl = env.NEWAPI_BASE_URL?.trim().replace(/\/$/, "");
  const apiKey = env.NEWAPI_API_KEY;
  if (!baseUrl || !apiKey) {
    return undefined;
  }

  return {
    id: "env-fallback",
    name: "Environment fallback",
    provider,
    baseUrl,
    apiKey,
  };
}

export class CloudflareRelayAccountService implements RelayAccountService {
  constructor(private readonly env: Bindings) {}

  async resolve(
    accountId?: string,
    provider: RelayAccountProvider = "newapi"
  ): Promise<ResolvedRelayAccount | undefined> {
    const db = createDatabase(this.env);

    const row = accountId
      ? await getPlatformRelayAccountRowById(db, accountId)
      : await getDefaultPlatformRelayAccountRow(db, provider);

    if (row?.enabled) {
      try {
        const apiKey = await decryptSecret(
          row.apiKeyEncrypted,
          this.env,
          PLATFORM_ENCRYPTION_SCOPE
        );

        return {
          id: row.id,
          name: row.name,
          provider: row.provider as RelayAccountProvider,
          baseUrl: row.baseUrl.replace(/\/$/, ""),
          apiKey,
        };
      } catch (error) {
        console.error(
          `Failed to decrypt relay account ${row.id}:`,
          error instanceof Error ? error.message : error
        );
      }
    }

    return resolveEnvFallback(this.env, provider);
  }
}
