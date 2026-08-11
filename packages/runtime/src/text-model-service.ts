export interface ResolvedRuntimeTextModel {
  readonly interfaceId: string;
  readonly providerModelId: string;
}

export interface ExecuteRuntimeTextModelResult {
  readonly ok: boolean;
  readonly text?: string;
  readonly interfaceId?: string;
  readonly interfaceName?: string;
  readonly error?: string;
}

export interface TextModelService {
  resolveTextModel(params: {
    organizationId: string;
    canonicalId: string;
    interfaceId: string;
  }): Promise<ResolvedRuntimeTextModel | undefined>;
  inferTextModelInterfaceId(params: {
    organizationId: string;
    canonicalId: string;
  }): Promise<string | undefined>;
  executeTextModel(params: {
    organizationId: string;
    canonicalId: string;
    interfaceId: string;
    effectivePrompt: string;
    referenceImageUrls?: readonly string[];
    referenceImageInline?: readonly {
      readonly mimeType: string;
      readonly data: string;
    }[];
    referenceVideoUrls?: readonly string[];
  }): Promise<ExecuteRuntimeTextModelResult>;
  /** Re-read volcano metadata after API key ensure to pick endpoint vs ModelId. */
  resolveTextModelInferenceId(params: {
    organizationId: string;
    interfaceId: string;
    canonicalId: string;
  }): Promise<string | undefined>;
}
