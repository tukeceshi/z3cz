import type { ResourceIdReference, WorkflowMediaValue } from "@dafthunk/types";

import type { GenerativeProgressPhase } from "@/components/workflow/generative-progress-utils";
import { GenerativeGenerationCancelledError } from "@/components/workflow/generative-generation-cancel";
import { runGenerationJobPersistWorker } from "@/services/generation-job-persist-worker";

export type PersistGenerativeMediaPhase = "downloading" | "uploading";

export async function resolveCloudGenerationJobMedia(params: {
  readonly organizationId: string;
  readonly jobId: string;
  readonly workflowId?: string;
  readonly cloudConfigured: boolean;
  readonly stagingMediaIds?: readonly string[];
  readonly onPhase?: (phase: PersistGenerativeMediaPhase) => void;
  readonly onProgressPhase?: (phase: GenerativeProgressPhase) => void;
  readonly onDownloadProgress?: (percent: number) => void;
  readonly onStaged?: (stagedMedia: readonly ResourceIdReference[]) => void;
  readonly shouldAbortJobPoll?: () => boolean;
  readonly shouldAbortDownload?: () => boolean;
  readonly onDownloadSlow?: () => void;
}): Promise<readonly WorkflowMediaValue[]> {
  return runGenerationJobPersistWorker({
    organizationId: params.organizationId,
    jobId: params.jobId,
    workflowId: params.workflowId,
    cloudConfigured: params.cloudConfigured,
    stagingMediaIds: params.stagingMediaIds,
    onPhase: params.onPhase,
    onProgressPhase: params.onProgressPhase,
    onDownloadProgress: params.onDownloadProgress,
    onStaged: params.onStaged,
    shouldAbortJobPoll: params.shouldAbortJobPoll,
    shouldAbortDownload: params.shouldAbortDownload,
    onDownloadSlow: params.onDownloadSlow,
  });
}
