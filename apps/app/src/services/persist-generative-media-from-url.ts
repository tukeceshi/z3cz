import type { LocalMediaReference, ResourceIdReference, WorkflowMediaValue } from "@dafthunk/types";

import type { GenerativeProgressPhase } from "@/components/workflow/generative-progress-utils";
import { GenerativeGenerationCancelledError } from "@/components/workflow/generative-generation-cancel";
import { runGenerationJobPersistWorker } from "@/services/generation-job-persist-worker";

export type PersistGenerativeMediaPhase = "downloading" | "uploading";

export async function resolveCloudGenerationJobMedia(params: {
  readonly organizationId: string;
  readonly jobId: string;
  readonly workflowId?: string;
  readonly stagingMediaIds?: readonly string[];
  readonly onPhase?: (phase: PersistGenerativeMediaPhase) => void;
  readonly onProgressPhase?: (phase: GenerativeProgressPhase) => void;
  readonly onStaged?: (localMedia: readonly LocalMediaReference[]) => void;
  readonly shouldAbortJobPoll?: () => boolean;
}): Promise<readonly WorkflowMediaValue[]> {
  params.onProgressPhase?.("generating");

  return runGenerationJobPersistWorker({
    organizationId: params.organizationId,
    jobId: params.jobId,
    workflowId: params.workflowId,
    stagingMediaIds: params.stagingMediaIds,
    onPhase: params.onPhase,
    onProgressPhase: params.onProgressPhase,
    onStaged: params.onStaged,
    shouldAbortJobPoll: params.shouldAbortJobPoll,
  });
}
