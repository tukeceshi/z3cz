import type { ResolvedRuntimeImageModel } from "@dafthunk/runtime";

import type { Bindings } from "../context";
import { createDatabase } from "../db";
import { resolveImageModelInterface } from "../services/resolve-image-model-interface";
import { listOrgImageModelOptions } from "../services/resolve-image-model-interface";
import { inferOrgModelInterfaceId } from "../services/resolve-text-model-interface";

export class CloudflareImageModelService {
  constructor(private readonly env: Bindings) {}

  async resolveImageModel(params: {
    organizationId: string;
    canonicalId: string;
    interfaceId: string;
  }): Promise<ResolvedRuntimeImageModel | undefined> {
    const db = createDatabase(this.env);
    const resolved = await resolveImageModelInterface(
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
      parameterRules: resolved.parameterRules,
    };
  }

  async inferImageModelInterfaceId(params: {
    organizationId: string;
    canonicalId: string;
  }): Promise<string | undefined> {
    const db = createDatabase(this.env);
    return inferOrgModelInterfaceId(
      db,
      params.organizationId,
      params.canonicalId,
      listOrgImageModelOptions
    );
  }
}
