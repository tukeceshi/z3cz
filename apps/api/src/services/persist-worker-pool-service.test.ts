import { describe, expect, it } from "vitest";

import type { GenerationJobRecord } from "@dafthunk/types";
import { GENERATION_JOB_WORKER_CLAIM_TIMEOUT_MS } from "@dafthunk/types";

import { shouldFallbackWorkerPersistToApi } from "./persist-worker-pool-service";

function baseJob(
  overrides: Partial<GenerationJobRecord> = {}
): GenerationJobRecord {
  return {
    id: "job-1",
    organizationId: "org-1",
    userId: null,
    workflowId: null,
    nodeId: null,
    modality: "image",
    status: "uploading",
    upstreamTaskId: null,
    modelCanonicalId: "model",
    interfaceId: "iface",
    failureReason: null,
    healthReason: null,
    readyAt: new Date().toISOString(),
    resultJson: {
      persistOwner: "server",
      persistDispatch: "worker",
      workerDispatchedAt: new Date().toISOString(),
    },
    clientRequestId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    ...overrides,
  };
}

describe("shouldFallbackWorkerPersistToApi", () => {
  it("returns false for inline api dispatch", () => {
    const job = baseJob({
      resultJson: {
        persistOwner: "server",
        persistDispatch: "api",
        workerDispatchedAt: new Date(0).toISOString(),
      },
    });

    expect(shouldFallbackWorkerPersistToApi(job)).toBe(false);
  });

  it("returns true after worker claim timeout", () => {
    const stale = new Date(
      Date.now() - GENERATION_JOB_WORKER_CLAIM_TIMEOUT_MS - 1_000
    ).toISOString();
    const job = baseJob({
      resultJson: {
        persistOwner: "server",
        persistDispatch: "worker",
        workerClaimedAt: stale,
        workerDispatchedAt: stale,
      },
    });

    expect(shouldFallbackWorkerPersistToApi(job)).toBe(true);
  });
});
