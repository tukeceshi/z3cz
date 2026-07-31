export interface ResolvedRuntimeTextModel {
  readonly interfaceId: string;
  readonly providerModelId: string;
}

export type RuntimeTextModelChannelKind = "aggregate" | "api";

export interface ResolvedRuntimeTextModelCandidate {
  readonly interfaceId: string;
  readonly interfaceName: string;
  readonly providerModelId: string;
  readonly channelKind: RuntimeTextModelChannelKind;
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
  }): Promise<ResolvedRuntimeTextModel | undefined>;
  executeTextModel(params: {
    organizationId: string;
    canonicalId: string;
    effectivePrompt: string;
    referenceImageUrls?: readonly string[];
    referenceImageInline?: readonly {
      readonly mimeType: string;
      readonly data: string;
    }[];
    referenceVideoUrls?: readonly string[];
  }): Promise<ExecuteRuntimeTextModelResult>;
  listTextModelCandidates(params: {
    organizationId: string;
    canonicalId: string;
  }): Promise<readonly ResolvedRuntimeTextModelCandidate[]>;
  disableTextModelOnInterface(params: {
    organizationId: string;
    interfaceId: string;
    canonicalId: string;
  }): Promise<boolean>;
  /** Re-read volcano metadata after API key ensure to pick endpoint vs ModelId. */
  resolveTextModelInferenceId(params: {
    organizationId: string;
    interfaceId: string;
    canonicalId: string;
  }): Promise<string | undefined>;
}
