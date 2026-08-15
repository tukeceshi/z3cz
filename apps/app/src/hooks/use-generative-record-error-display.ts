import type { GenerativeModelKind } from "@dafthunk/types";
import { useEffect } from "react";

import { withGenerativeCardGenerateError } from "@/components/workflow/generative-card-error-utils";
import { prepareGenerativeCardError } from "@/components/workflow/prepare-generative-card-error";
import type { WorkflowNodeType } from "@/components/workflow/workflow-types";
import { useTranslation } from "@/components/locale-provider";
import {
  fetchModelCallDetail,
  getGenerationJob,
} from "@/services/platform-ai-model-service";

export function useGenerativeRecordErrorDisplay(params: {
  readonly orgId: string | undefined;
  readonly nodeId: string;
  readonly jobId?: string;
  readonly invocationId?: string;
  readonly modality: GenerativeModelKind;
  readonly enabled: boolean;
  readonly clearError?: boolean;
  readonly updateNodeData?: (
    nodeId: string,
    updater: (current: WorkflowNodeType) => Partial<WorkflowNodeType>
  ) => void;
}): void {
  const { t } = useTranslation();
  const jobId = params.jobId;
  const invocationId = params.invocationId;
  const enabled = params.enabled;
  const clearError = params.clearError === true;
  const orgId = params.orgId;
  const nodeId = params.nodeId;
  const modality = params.modality;
  const updateNodeData = params.updateNodeData;

  useEffect(() => {
    if (!updateNodeData) {
      return;
    }

    if (clearError) {
      updateNodeData(nodeId, (current) => ({
        metadata: withGenerativeCardGenerateError(current.metadata, null),
      }));
      return;
    }

    if (!enabled || !orgId || (!jobId && !invocationId)) {
      return;
    }

    let cancelled = false;

    const run = async (): Promise<void> => {
      let raw: string | undefined;
      if (jobId) {
        const response = await getGenerationJob(orgId, jobId);
        if (response.job.status === "failed") {
          raw = response.job.failureReason ?? "Generation failed";
        }
      } else if (invocationId) {
        const invocation = await fetchModelCallDetail(orgId, invocationId);
        if (invocation.status === "failed" && invocation.error) {
          raw = invocation.error;
        }
      }
      if (cancelled || !raw) {
        return;
      }
      const cardError = prepareGenerativeCardError(raw, t, modality);
      updateNodeData(nodeId, (current) => ({
        metadata: withGenerativeCardGenerateError(current.metadata, cardError),
      }));
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [
    clearError,
    enabled,
    invocationId,
    jobId,
    modality,
    nodeId,
    orgId,
    t,
    updateNodeData,
  ]);
}
