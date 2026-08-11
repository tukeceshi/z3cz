import type { WorkflowMediaValue } from "@dafthunk/types";



import {

  uploadGenerativeMediaFile,

  uploadGenerativeMediaFromLocalStaging,

} from "@/services/stage-generative-media";



export { uploadGenerativeMediaFromLocalStaging };



export async function uploadGenerativeMedia(params: {

  readonly organizationId: string;

  readonly workflowId?: string;

  readonly file: File;

  readonly cloudConfigured: boolean;

  readonly mediaKind?: "ai-image" | "ai-video" | "ai-audio" | "reference";

}): Promise<WorkflowMediaValue> {

  return uploadGenerativeMediaFile({

    organizationId: params.organizationId,

    workflowId: params.workflowId,

    file: params.file,

    cloudConfigured: params.cloudConfigured,

    mediaKind: params.mediaKind ?? "reference",

  });

}


