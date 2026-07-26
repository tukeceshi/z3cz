import { describe, expect, it } from "vitest";

import type { GenerationJobRecord } from "@dafthunk/types";

import {
  GenerationJobUploadValidationError,
  validateGenerationJobUploadMedia,
} from "./validate-generation-job-upload";

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
    clientRequestId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    ...overrides,
  };
}

describe("validateGenerationJobUploadMedia", () => {
  it("accepts matching Volcano TOS object references", () => {
    const result = validateGenerationJobUploadMedia(buildJob(), [
      {
        id: "obj-1",
        mimeType: "image/png",
        storageKey: "z3cz/wf-1/ai-image/obj-1.png",
        storageBackend: "volcengine_tos",
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.storageBackend).toBe("volcengine_tos");
  });

  it("rejects count mismatches", () => {
    expect(() =>
      validateGenerationJobUploadMedia(buildJob(), [])
    ).toThrow(GenerationJobUploadValidationError);
  });

  it("rejects ephemeral references", () => {
    expect(() =>
      validateGenerationJobUploadMedia(buildJob(), [
        {
          kind: "ephemeral",
          url: "https://example.com/a.png",
          mimeType: "image/png",
          mediaId: "media-1",
        },
      ])
    ).toThrow(/Volcano TOS/);
  });

  it("rejects incompatible MIME types", () => {
    expect(() =>
      validateGenerationJobUploadMedia(buildJob(), [
        {
          id: "obj-1",
          mimeType: "video/mp4",
          storageKey: "z3cz/wf-1/ai-video/obj-1.mp4",
          storageBackend: "volcengine_tos",
        },
      ])
    ).toThrow(/incompatible MIME type/);
  });
});
