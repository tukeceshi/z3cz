import type { ResolvedRuntimeVideoModel } from "@dafthunk/runtime";

import type { Bindings } from "../context";
import { createDatabase } from "../db";
import { resolveVideoModelInterface } from "../services/resolve-video-model-interface";

export class CloudflareVideoModelService {
  constructor(private readonly env: Bindings) {}

  async resolveVideoModel(params: {
    organizationId: string;
    canonicalId: string;
  }): Promise<ResolvedRuntimeVideoModel | undefined> {
    const db = createDatabase(this.env);
    const resolved = await resolveVideoModelInterface(
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
      parameterRules: resolved.parameterRules,
    };
  }
}
