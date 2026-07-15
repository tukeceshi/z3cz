export interface ResolvedRuntimeTextModel {
  readonly interfaceId: string;
  readonly providerModelId: string;
}

export interface TextModelService {
  resolveTextModel(params: {
    organizationId: string;
    canonicalId: string;
  }): Promise<ResolvedRuntimeTextModel | undefined>;
}
