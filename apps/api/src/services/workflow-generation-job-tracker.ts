import { ACTIVE_GENERATION_JOB_STATUSES } from "@dafthunk/types";
import type { WorkflowGenerationJobTracker } from "@dafthunk/runtime";

import type { Bindings } from "../context";
import { createDatabase } from "../db";
import {
  createGenerationJob,
  getGenerationJobByClientRequestId,
  updateGenerationJobStatus,
} from "../db/generation-job-queries";
import { resolveOrgCloudStorage } from "./resolve-org-cloud-storage";

export function buildWorkflowClientRequestId(params: {
  readonly executionId?: string;
  readonly workflowId: string;
  readonly nodeId: string;
  readonly modality: "image" | "video";
}): string {
  if (params.executionId?.trim()) {
    return `workflow:${params.executionId.trim()}:${params.nodeId}:${params.modality}`;
  }
  return `workflow:${params.workflowId}:${params.nodeId}:${params.modality}`;
}

export function createWorkflowGenerationJobTracker(
  env: Bindings
): WorkflowGenerationJobTracker {
  return {
    async begin(params) {
      const db = createDatabase(env);
      const cloud = await resolveOrgCloudStorage(db, params.organizationId);
      if (!cloud) {
        return null;
      }

      const clientRequestId = buildWorkflowClientRequestId(params);
      const existing = await getGenerationJobByClientRequestId(db, {
        organizationId: params.organizationId,
        clientRequestId,
      });
      if (
        existing &&
        (ACTIVE_GENERATION_JOB_STATUSES as readonly string[]).includes(
          existing.status
        )
      ) {
        return existing.id;
      }

      const jobId = crypto.randomUUID();
      await createGenerationJob(db, {
        id: jobId,
        organizationId: params.organizationId,
        workflowId: params.workflowId,
        nodeId: params.nodeId,
        modality: params.modality,
        status: params.modality === "video" ? "generating" : "uploading",
        upstreamTaskId: params.upstreamTaskId ?? null,
        modelCanonicalId: params.modelCanonicalId,
        interfaceId: params.interfaceId,
        clientRequestId,
        resultJson: params.upstreamTaskId
          ? {
              upstreamTaskId: params.upstreamTaskId,
              videoPollUrl: params.videoPollUrl,
              aiInterfaceId: params.interfaceId,
            }
          : { aiInterfaceId: params.interfaceId },
      });

      return jobId;
    },

    async complete(params) {
      const db = createDatabase(env);
      await updateGenerationJobStatus(db, {
        id: params.jobId,
        organizationId: params.organizationId,
        status: params.status,
        failureReason: params.failureReason ?? null,
      });
    },
  };
}
