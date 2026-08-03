import type { ResolvedRuntimeImageModel } from "@dafthunk/runtime";

import type { Bindings } from "../context";
import { createDatabase } from "../db";
import { resolveImageModelInterface } from "../services/resolve-image-model-interface";

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
}
