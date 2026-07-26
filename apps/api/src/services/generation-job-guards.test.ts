import { describe, expect, it } from "vitest";

import type { GenerationJobRecord } from "@dafthunk/types";

import {
  ActiveGenerationJobConflictError,
  buildImageGenerateResponseFromJob,
  buildVideoSubmitResponseFromJob,
} from "./generation-job-guards";

function buildJob(
  overrides: Partial<GenerationJobRecord> = {}
): GenerationJobRecord {
  return {
    id: "job-1",
    organizationId: "org-1",
    userId: null,
    workflowId: "wf-1",
    nodeId: "node-1",
    modality: "image",
    status: "ready_to_persist",
    upstreamTaskId: null,
    modelCanonicalId: "seedream",
    interfaceId: "iface-1",
    failureReason: null,
    healthReason: null,
    readyAt: new Date().toISOString(),
    resultJson: {
      pendingMedia: [
        {
          sourceUrl: "https://example.com/a.png",
          mimeType: "image/png",
          mediaKind: "ai-image",
        },
      ],
    },
    clientRequestId: "req-1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    ...overrides,
  };
}

describe("generation job guard helpers", () => {
  it("builds image responses from ready jobs", () => {
    const response = buildImageGenerateResponseFromJob(buildJob());
    expect(response.jobId).toBe("job-1");
    expect(response.phase).toBe("ready_to_persist");
    expect(response.images).toHaveLength(1);
  });

  it("builds video submit responses from tracked jobs", () => {
    const response = buildVideoSubmitResponseFromJob(
      buildJob({
        modality: "video",
        status: "generating",
        upstreamTaskId: "task-1",
      })
    );
    expect(response.taskId).toBe("task-1");
    expect(response.jobId).toBe("job-1");
  });

  it("exposes stable conflict error codes", () => {
    const error = new ActiveGenerationJobConflictError("job-2");
    expect(error.code).toBe("active_generation_job_exists");
    expect(error.jobId).toBe("job-2");
  });
});
