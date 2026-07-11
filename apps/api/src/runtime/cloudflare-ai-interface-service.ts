import type { AiInterfaceService } from "@dafthunk/runtime";
import { mergeResolvedAiInterface } from "@dafthunk/runtime/ai-interface/execute-sync";
import type { ResolvedOrgAiInterface } from "@dafthunk/types";

import type { Bindings } from "../context";
import { createDatabase } from "../db";
import {
  getAiInterfaceTemplateRow,
  resolveOrganizationAiInterfaceRow,
  updateOrganizationAiInterface,
} from "../db/ai-interface-queries";
import { ensureVolcanoApiKey } from "../integrations/volcengine/ensure-api-key";
import { isVolcanoMetadata, parseInterfaceMetadata } from "../integrations/volcengine/metadata";
import { AiInterfaceTemplateStore } from "../stores/ai-interface-template-store";
import { decryptSecret } from "../utils/encryption";

export class CloudflareAiInterfaceService implements AiInterfaceService {
  private readonly store: AiInterfaceTemplateStore;

  constructor(private readonly env: Bindings) {
    this.store = new AiInterfaceTemplateStore(env);
  }

  loadManifest() {
    return this.store.loadManifest();
  }

  loadArtifact(templateId: string, version?: number) {
    return this.store.loadArtifact(templateId, version);
  }

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

    const templateRow = await getAiInterfaceTemplateRow(db, row.templateId);
    if (!templateRow?.enabled) {
      return undefined;
    }

    const artifact = await this.store.loadArtifact(
      row.templateId,
      row.templateVersion ?? undefined
    );
    if (!artifact) {
      return undefined;
    }

    try {
      let apiKeyEncrypted = row.apiKeyEncrypted;

      if (isVolcanoMetadata(parseInterfaceMetadata(row.metadata))) {
        const ensured = await ensureVolcanoApiKey({
          env: this.env,
          organizationId: params.organizationId,
          metadataRaw: row.metadata,
          apiKeyEncrypted: row.apiKeyEncrypted,
        });
        apiKeyEncrypted = ensured.apiKeyEncrypted;

        if (ensured.renewed) {
          await updateOrganizationAiInterface(
            db,
            params.organizationId,
            row.id,
            {
              metadata: ensured.metadataRaw,
              apiKeyEncrypted: ensured.apiKeyEncrypted,
            }
          );
        }
      }

      const apiKey = await decryptSecret(
        apiKeyEncrypted,
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
