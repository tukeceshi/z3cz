export type AiModelModality = "text" | "image" | "video";

export interface AiModelCatalogEntry {
  readonly canonicalId: string;
  readonly alias: string;
  readonly modality: AiModelModality;
  readonly providerModelId: string;
}

export const VOLCANO_AI_MODEL_CATALOG: readonly AiModelCatalogEntry[] = [
  {
    canonicalId: "doubao-seed-evolving",
    alias: "Doubao Seed Evolving",
    modality: "text",
    providerModelId: "doubao-seed-evolving",
  },
  {
    canonicalId: "deepseek-v4-pro",
    alias: "DeepSeek V4 Pro",
    modality: "text",
    providerModelId: "deepseek-v4-pro-260425",
  },
  {
    canonicalId: "deepseek-v4-flash",
    alias: "DeepSeek V4 Flash",
    modality: "text",
    providerModelId: "deepseek-v4-flash-260425",
  },
  {
    canonicalId: "doubao-seedance-2",
    alias: "Seedance 2.0",
    modality: "video",
    providerModelId: "doubao-seedance-2-0-260128",
  },
  {
    canonicalId: "doubao-seedance-2-fast",
    alias: "Seedance 2.0 Fast",
    modality: "video",
    providerModelId: "doubao-seedance-2-0-fast-260128",
  },
  {
    canonicalId: "doubao-seedance-2-mini",
    alias: "Seedance 2.0 Mini",
    modality: "video",
    providerModelId: "doubao-seedance-2-0-mini-260615",
  },
  {
    canonicalId: "doubao-seedream-5-pro",
    alias: "Seedream 5.0 Pro",
    modality: "image",
    providerModelId: "doubao-seedream-5-0-pro-260628",
  },
  {
    canonicalId: "doubao-seedream-5",
    alias: "Seedream 5.0",
    modality: "image",
    providerModelId: "doubao-seedream-5-0-260128",
  },
] as const;

export const VOLCANO_TEMPLATE_ID = "doubao-volcano-chat-v1" as const;

export const VOLCANO_ARK_API_KEY_DURATION_SECONDS = 2_592_000 as const;
