import type {
  CloudImageUploadTarget,
  VolcanoImageStorageMode,
} from "./ai-interface/execute-volcano-image";

export interface AiImageStorageResolution {
  readonly storageMode: VolcanoImageStorageMode;
  readonly cloudUpload?: CloudImageUploadTarget;
}

export type ResolveAiImageStorage = (params: {
  readonly organizationId: string;
  readonly workflowId?: string;
}) => Promise<AiImageStorageResolution>;
