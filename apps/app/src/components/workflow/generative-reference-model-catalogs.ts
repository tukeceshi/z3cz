import type {
  OrgImageModelOption,
  OrgVideoModelOption,
} from "@dafthunk/types";

import type { AiImageReferenceModelOption } from "./ai-image-reference-policy";
import type { AiVideoReferenceModelOption } from "./ai-video-reference-policy";

export interface GenerativeReferenceModelCatalogs {
  readonly imageModels: readonly AiImageReferenceModelOption[];
  readonly videoModels: readonly AiVideoReferenceModelOption[];
}

export const EMPTY_GENERATIVE_REFERENCE_MODEL_CATALOGS: GenerativeReferenceModelCatalogs =
  {
    imageModels: [],
    videoModels: [],
  };

export function buildGenerativeReferenceModelCatalogs(params: {
  readonly imageModels: readonly Pick<
    OrgImageModelOption,
    "canonicalId" | "parameterRules"
  >[];
  readonly videoModels: readonly Pick<
    OrgVideoModelOption,
    "canonicalId" | "parameterRules"
  >[];
}): GenerativeReferenceModelCatalogs {
  return {
    imageModels: params.imageModels.map((entry) => ({
      canonicalId: entry.canonicalId,
      parameterRules: entry.parameterRules,
    })),
    videoModels: params.videoModels.map((entry) => ({
      canonicalId: entry.canonicalId,
      parameterRules: entry.parameterRules,
    })),
  };
}
