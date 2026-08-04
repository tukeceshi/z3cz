import type { VideoModelParameterRules } from "@dafthunk/types";

export interface ResolvedRuntimeVideoModel {
  readonly interfaceId: string;
  readonly providerModelId: string;
  readonly parameterRules: VideoModelParameterRules;
}

export interface VideoModelService {
  resolveVideoModel(params: {
    organizationId: string;
    canonicalId: string;
    interfaceId: string;
  }): Promise<ResolvedRuntimeVideoModel | undefined>;
  inferVideoModelInterfaceId(params: {
    organizationId: string;
    canonicalId: string;
  }): Promise<string | undefined>;
}
