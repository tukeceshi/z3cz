import type { AudioModelParameterRules } from "@dafthunk/types";

export interface ResolvedRuntimeAudioModel {
  readonly interfaceId: string;
  readonly providerModelId: string;
  readonly parameterRules: AudioModelParameterRules;
}

export interface AudioModelService {
  resolveAudioModel(params: {
    organizationId: string;
    canonicalId: string;
    interfaceId: string;
  }): Promise<ResolvedRuntimeAudioModel | undefined>;
  inferAudioModelInterfaceId(params: {
    organizationId: string;
    canonicalId: string;
  }): Promise<string | undefined>;
}
