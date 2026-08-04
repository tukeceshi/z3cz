import type { ImageModelParameterRules } from "@dafthunk/types";

export interface ResolvedRuntimeImageModel {
  readonly interfaceId: string;
  readonly providerModelId: string;
  readonly parameterRules: ImageModelParameterRules;
}

export interface ImageModelService {
  resolveImageModel(params: {
    organizationId: string;
    canonicalId: string;
    interfaceId: string;
  }): Promise<ResolvedRuntimeImageModel | undefined>;
  inferImageModelInterfaceId(params: {
    organizationId: string;
    canonicalId: string;
  }): Promise<string | undefined>;
}
