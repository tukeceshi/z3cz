import type { ResolvedRuntimeAudioModel } from "@dafthunk/runtime";

import type { Bindings } from "../context";
import { createDatabase } from "../db";
import { resolveAudioModelInterface } from "../services/resolve-audio-model-interface";

export class CloudflareAudioModelService {
  constructor(private readonly env: Bindings) {}

  async resolveAudioModel(params: {
    organizationId: string;
    canonicalId: string;
    interfaceId: string;
  }): Promise<ResolvedRuntimeAudioModel | undefined> {
    const db = createDatabase(this.env);
    const resolved = await resolveAudioModelInterface(
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
