import type { ResolvedRuntimeTextModel } from "@dafthunk/runtime";

import type { Bindings } from "../context";
import { createDatabase } from "../db";
import { resolveTextModelInterface } from "../services/resolve-text-model-interface";

export class CloudflareTextModelService {
  constructor(private readonly env: Bindings) {}

  async resolveTextModel(params: {
    organizationId: string;
    canonicalId: string;
  }): Promise<ResolvedRuntimeTextModel | undefined> {
    const db = createDatabase(this.env);
    const resolved = await resolveTextModelInterface(
      db,
      params.organizationId,
      params.canonicalId
    );

    if (!resolved) {
      return undefined;
    }

    return {
      interfaceId: resolved.interfaceId,
      providerModelId: resolved.providerModelId,
    };
  }
}
