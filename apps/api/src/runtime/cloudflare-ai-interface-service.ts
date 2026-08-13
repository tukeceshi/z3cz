import type { FormatTransformConfig } from "@dafthunk/types";
import {
  isSingleModelProviderMetadata,
  readSingleModelCapabilityLimits,
  readSingleModelFormatTemplateId,
  readSingleModelFormatTransform,
  resolveEffectiveVideoSupportsTaskCancel,
  resolveSingleModelVideoEndpoints,
  singleModelFormatTransformFromTemplate,
  singleModelFormatTransformToConfig,
} from "@dafthunk/types";

import type { Bindings } from "../context";
import { createDatabase } from "../db";
import { getFormatTransformTemplateById } from "../db/format-transform-template-queries";
import {
  getVideoParameterRules,
  listPlatformAiModels,
} from "../db/platform-ai-model-queries";
import {
  resolveOrganizationAiInterfaceRow,
  updateOrganizationAiInterface,
} from "../db/ai-interface-queries";
import { ensureVolcanoApiKey } from "../integrations/volcengine/ensure-api-key";
import {
  isVolcanoMetadata,
  parseInterfaceMetadata,
} from "../integrations/volcengine/metadata";
import { decryptSecret } from "../utils/encryption";
import type { AiInterfaceService } from "@dafthunk/runtime";
import { buildBuiltinAiInterfaceArtifact } from "@dafthunk/runtime/ai-interface/builtin-artifact";
import { mergeResolvedAiInterface } from "@dafthunk/runtime/ai-interface/execute-sync";
import type {
  AiInterfaceProvider,
  ResolvedOrgAiInterface,
} from "@dafthunk/types";
import { readSingleModelPresetId } from "@dafthunk/types";

function resolveVideoEndpointsFromMetadata(
  metadataRaw: string | null,
  supportsTaskCancel?: boolean
): ReturnType<typeof resolveSingleModelVideoEndpoints> | undefined {
  const metadata = parseInterfaceMetadata(metadataRaw);
  if (!isSingleModelProviderMetadata(metadata)) {
    return undefined;
  }
  if (metadata.singleModelCategory !== "video") {
    return undefined;
  }
  return resolveSingleModelVideoEndpoints({ metadata, supportsTaskCancel });
}

async function resolveSupportsTaskCancelForModel(
  env: Bindings,
  metadataRaw: string | null,
  modelCanonicalId?: string
): Promise<boolean | undefined> {
  if (!modelCanonicalId) {
    return undefined;
  }

  const metadata = parseInterfaceMetadata(metadataRaw);
  if (!isSingleModelProviderMetadata(metadata)) {
    return undefined;
  }

  const db = createDatabase(env);
  const platformModels = await listPlatformAiModels(db, "video");
  const platformModel = platformModels.find(
    (model) => model.canonicalId === modelCanonicalId
  );
  if (!platformModel) {
    return undefined;
  }

  const platformRules = getVideoParameterRules(platformModel);
  const capabilityLimits = readSingleModelCapabilityLimits(
    metadata,
    modelCanonicalId
  );

  return resolveEffectiveVideoSupportsTaskCancel({
    platformRules,
    capabilityLimits,
  });
}

async function resolveFormatTransformFromMetadata(
  env: Bindings,
  metadataRaw: string | null,
  modelCanonicalId?: string
): Promise<FormatTransformConfig | undefined> {
  const metadata = parseInterfaceMetadata(metadataRaw);
  if (!isSingleModelProviderMetadata(metadata)) {
    return undefined;
  }

  if (modelCanonicalId) {
    const modelTransform = readSingleModelFormatTransform(
      metadata,
      modelCanonicalId
    );
    if (modelTransform) {
      return singleModelFormatTransformToConfig(modelTransform);
    }
  }

  const templateId = readSingleModelFormatTemplateId(metadata);
  if (!templateId) {
    return undefined;
  }

  const db = createDatabase(env);
  const template = await getFormatTransformTemplateById(db, templateId);
  if (!template?.enabled || template.scope !== "platform") {
    return undefined;
  }

  return singleModelFormatTransformToConfig(
    singleModelFormatTransformFromTemplate(template)
  );
}

export class CloudflareAiInterfaceService implements AiInterfaceService {
  constructor(private readonly env: Bindings) {}

  async resolveOrgInterface(params: {
    organizationId: string;
    interfaceId?: string;
    templateId?: string;
    modelCanonicalId?: string;
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
      let videoEndpoints = resolveVideoEndpointsFromMetadata(row.metadata);
      const formatTransform = await resolveFormatTransformFromMetadata(
        this.env,
        row.metadata,
        params.modelCanonicalId
      );
      const supportsTaskCancel = await resolveSupportsTaskCancelForModel(
        this.env,
        row.metadata,
        params.modelCanonicalId
      );
      if (videoEndpoints && supportsTaskCancel !== undefined) {
        videoEndpoints = {
          ...videoEndpoints,
          supportsTaskCancel,
        };
      }
      return mergeResolvedAiInterface({
        artifact,
        interfaceId: row.id,
        baseUrl: row.baseUrl,
        selectedModel: row.selectedModel,
        apiKey,
        videoEndpoints,
        formatTransform,
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
