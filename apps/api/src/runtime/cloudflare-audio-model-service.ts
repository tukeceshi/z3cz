import type { ResolvedRuntimeAudioModel } from "@dafthunk/runtime";

import type { Bindings } from "../context";
import { createDatabase } from "../db";
import { resolveAudioModelInterface } from "../services/resolve-audio-model-interface";
import { listOrgAudioModelOptions } from "../services/resolve-audio-model-interface";
import { inferOrgModelInterfaceId } from "../services/resolve-text-model-interface";

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

  async inferAudioModelInterfaceId(params: {
    organizationId: string;
    canonicalId: string;
  }): Promise<string | undefined> {
    const db = createDatabase(this.env);
    return inferOrgModelInterfaceId(
      db,
      params.organizationId,
      params.canonicalId,
      listOrgAudioModelOptions
    );
  }
}
