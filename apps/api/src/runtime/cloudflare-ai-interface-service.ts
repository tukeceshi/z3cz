import type { AiInterfaceService } from "@dafthunk/runtime";
import { buildBuiltinAiInterfaceArtifact } from "@dafthunk/runtime/ai-interface/builtin-artifact";
import { mergeResolvedAiInterface } from "@dafthunk/runtime/ai-interface/execute-sync";
import type {
  AiInterfaceProvider,
  ResolvedOrgAiInterface,
} from "@dafthunk/types";

import type { Bindings } from "../context";
import { createDatabase } from "../db";
import {
  resolveOrganizationAiInterfaceRow,
  updateOrganizationAiInterface,
} from "../db/ai-interface-queries";
import { ensureVolcanoApiKey } from "../integrations/volcengine/ensure-api-key";
import {
  isVolcanoMetadata,
  parseInterfaceMetadata,
} from "../integrations/volcengine/metadata";
import { readSingleModelPresetId } from "@dafthunk/types";
import { decryptSecret } from "../utils/encryption";

export class CloudflareAiInterfaceService implements AiInterfaceService {
  constructor(private readonly env: Bindings) {}

  async resolveOrgInterface(params: {
    organizationId: string;
    interfaceId?: string;
    templateId?: string;
  }): Promise<ResolvedOrgAiInterface | undefined> {
    const db = createDatabase(this.env);
    const row = await resolveOrganizationAiInterfaceRow(
      db,
      params.organizationId,
      {
        interfaceId: params.interfaceId,
        templateId: params.templateId,
      }
    );

    if (!row?.enabled) {
      return undefined;
    }

    const provider = row.provider as AiInterfaceProvider;
    const singleModelPresetId = readSingleModelPresetId(row.metadata);
    let artifact;
    try {
      artifact = buildBuiltinAiInterfaceArtifact(provider, {
        baseUrl: row.baseUrl,
        defaultModel: row.selectedModel,
        singleModelPresetId,
      });
    } catch (error) {
      console.error(
        `Failed to build AI interface artifact for ${row.id}:`,
        error instanceof Error ? error.message : error
      );
      return undefined;
    }

    try {
      if (isVolcanoMetadata(parseInterfaceMetadata(row.metadata))) {
        const ensured = await ensureVolcanoApiKey({
          env: this.env,
          organizationId: params.organizationId,
          metadataRaw: row.metadata,
          apiKeyEncrypted: row.apiKeyEncrypted,
        });

        if (ensured.renewed || ensured.metadataChanged) {
          await updateOrganizationAiInterface(
            db,
            params.organizationId,
            row.id,
            {
              metadata: ensured.metadataRaw,
              ...(ensured.renewed
                ? { apiKeyEncrypted: ensured.apiKeyEncrypted }
                : {}),
            }
          );
        }

        if (!ensured.apiKey) {
          return undefined;
        }

        return mergeResolvedAiInterface({
          artifact,
          interfaceId: row.id,
          baseUrl: row.baseUrl,
          selectedModel: row.selectedModel,
          apiKey: ensured.apiKey,
        });
      }

      const apiKey = await decryptSecret(
        row.apiKeyEncrypted,
        this.env,
        params.organizationId
      );
      return mergeResolvedAiInterface({
        artifact,
        interfaceId: row.id,
        baseUrl: row.baseUrl,
        selectedModel: row.selectedModel,
        apiKey,
      });
    } catch (error) {
      console.error(
        `Failed to decrypt AI interface ${row.id}:`,
        error instanceof Error ? error.message : error
      );
      return undefined;
    }
  }
}
