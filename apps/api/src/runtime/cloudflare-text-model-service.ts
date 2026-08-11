import type {
  ExecuteRuntimeTextModelResult,
  ResolvedRuntimeTextModel,
} from "@dafthunk/runtime";

import type { Bindings } from "../context";
import { createDatabase } from "../db";
import { executeTextModel } from "../services/execute-text-model";
import { resolveVolcanoInferenceModelIdAfterEnsure } from "../integrations/volcengine/resolve-inference-model-id";
import {
  inferOrgModelInterfaceId,
  listOrgTextModelOptions,
  resolveTextModelInterface,
} from "../services/resolve-text-model-interface";

export class CloudflareTextModelService {
  constructor(private readonly env: Bindings) {}

  async resolveTextModel(params: {
    organizationId: string;
    canonicalId: string;
    interfaceId: string;
  }): Promise<ResolvedRuntimeTextModel | undefined> {
    const db = createDatabase(this.env);
    const resolved = await resolveTextModelInterface(
      db,
      params.organizationId,
      params.canonicalId,
      params.interfaceId
    );

    if (!resolved) {
      return undefined;
    }

    return {
      interfaceId: resolved.interfaceId,
      providerModelId: resolved.providerModelId,
    };
  }

  async inferTextModelInterfaceId(params: {
    organizationId: string;
    canonicalId: string;
  }): Promise<string | undefined> {
    const db = createDatabase(this.env);
    return inferOrgModelInterfaceId(
      db,
      params.organizationId,
      params.canonicalId,
      listOrgTextModelOptions
    );
  }

  async executeTextModel(params: {
    organizationId: string;
    canonicalId: string;
    interfaceId: string;
    effectivePrompt: string;
    referenceImageUrls?: readonly string[];
    referenceImageInline?: readonly {
      readonly mimeType: string;
      readonly data: string;
    }[];
    referenceVideoUrls?: readonly string[];
  }): Promise<ExecuteRuntimeTextModelResult> {
    const db = createDatabase(this.env);
    return executeTextModel({
      env: this.env,
      db,
      organizationId: params.organizationId,
      canonicalId: params.canonicalId,
      interfaceId: params.interfaceId,
      effectivePrompt: params.effectivePrompt,
      referenceImageUrls: params.referenceImageUrls,
      referenceImageInline: params.referenceImageInline,
      referenceVideoUrls: params.referenceVideoUrls,
    });
  }

  async resolveTextModelInferenceId(params: {
    organizationId: string;
    interfaceId: string;
    canonicalId: string;
  }): Promise<string | undefined> {
    const db = createDatabase(this.env);
    const inferenceModelId = await resolveVolcanoInferenceModelIdAfterEnsure({
      db,
      organizationId: params.organizationId,
      interfaceId: params.interfaceId,
      canonicalId: params.canonicalId,
    });

    return inferenceModelId ?? undefined;
  }
}
