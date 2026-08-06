import { describe, expect, it } from "vitest";

import type { GenerationJobRecord } from "@dafthunk/types";
import {
  GENERATION_JOB_SERVER_PERSIST_AFTER_MS,
  isGenerationJobReadyAtExpired,
  isVideoUpstreamPollDue,
  nextVideoUpstreamPollAt,
  shouldDeferClientPersistToServer,
} from "@dafthunk/types";

import { resolveGenerationJobDisplayPhase } from "./generation-job-service";

function makeJob(
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
    modelCanonicalId: "model-1",
    interfaceId: "iface-1",
    failureReason: null,
    healthReason: null,
    readyAt: new Date().toISOString(),
    resultJson: null,
    clientRequestId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    ...overrides,
  };
}

describe("resolveGenerationJobDisplayPhase", () => {
  it("maps generating statuses", () => {
    expect(
      resolveGenerationJobDisplayPhase(makeJob({ status: "generating" }))
    ).toBe("generating");
  });

  it("maps queued upstream video status", () => {
    expect(
      resolveGenerationJobDisplayPhase(
        makeJob({
          modality: "video",
          status: "generating",
          resultJson: { upstreamVideoStatus: "queued" },
        })
      )
    ).toBe("queued");
  });

  it("maps client uploading separately from server persist", () => {
    expect(
      resolveGenerationJobDisplayPhase(
        makeJob({
          status: "uploading",
          resultJson: { persistOwner: "client" },
        })
      )
    ).toBe("uploading");

    expect(
      resolveGenerationJobDisplayPhase(
        makeJob({
          status: "uploading",
          resultJson: { persistOwner: "server" },
        })
      )
    ).toBe("server_persisting");
  });
});

describe("shouldDeferClientPersistToServer", () => {
  it("defers only when server is persisting or job succeeded", () => {
    const readyAt = new Date(
      Date.now() - GENERATION_JOB_SERVER_PERSIST_AFTER_MS - 1_000
    ).toISOString();

    expect(isGenerationJobReadyAtExpired(readyAt)).toBe(true);
    expect(
      shouldDeferClientPersistToServer(
        makeJob({ status: "ready_to_persist", readyAt })
      )
    ).toBe(false);
    expect(
      shouldDeferClientPersistToServer(
        makeJob({
          status: "uploading",
          readyAt,
          resultJson: { persistOwner: "server" },
        })
      )
    ).toBe(true);
  });

  it("allows client persist while server has not taken over", () => {
    expect(
      shouldDeferClientPersistToServer(makeJob({ status: "ready_to_persist" }))
    ).toBe(false);
  });
});

describe("video upstream poll scheduling", () => {
  it("treats missing nextUpstreamPollAt as due", () => {
    expect(isVideoUpstreamPollDue(null)).toBe(true);
    expect(isVideoUpstreamPollDue(undefined)).toBe(true);
    expect(isVideoUpstreamPollDue({})).toBe(true);
  });

  it("respects nextUpstreamPollAt", () => {
    const nowMs = Date.parse("2026-01-01T00:00:00.000Z");
    expect(
      isVideoUpstreamPollDue(
        { nextUpstreamPollAt: "2026-01-01T00:00:10.000Z" },
        nowMs
      )
    ).toBe(false);
    expect(
      isVideoUpstreamPollDue(
        { nextUpstreamPollAt: "2026-01-01T00:00:00.000Z" },
        nowMs
      )
    ).toBe(true);
  });

  it("uses longer interval for queued upstream phase", () => {
    const nowMs = Date.parse("2026-01-01T00:00:00.000Z");
    expect(nextVideoUpstreamPollAt("running", nowMs)).toBe(
      "2026-01-01T00:00:10.000Z"
    );
    expect(nextVideoUpstreamPollAt("queued", nowMs)).toBe(
      "2026-01-01T00:00:15.000Z"
    );
  });
});
