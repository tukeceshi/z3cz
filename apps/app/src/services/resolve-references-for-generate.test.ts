import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeRequest } from "@/services/utils";
import { readGenerativeStagingAsInline } from "@/services/generative-media-staging";

import { resolveMediaReferencesForVideoGenerate } from "./resolve-references-for-generate";

vi.mock("@/services/utils", () => ({
  makeRequest: vi.fn(),
}));

vi.mock("@/services/generative-media-staging", () => ({
  readGenerativeStagingAsInline: vi.fn(async () => null),
}));

const makeRequestMock = vi.mocked(makeRequest);
const readStagingMock = vi.mocked(readGenerativeStagingAsInline);

describe("resolveMediaReferencesForVideoGenerate", () => {
  beforeEach(() => {
    makeRequestMock.mockReset();
    readStagingMock.mockReset();
    readStagingMock.mockResolvedValue(null);
  });

  it("resolves a cloud resourceId from the catalog without reading staging", async () => {
    const resourceId = "ab4490ab-4bd1-4542-8a13-f1f1277855b8";
    makeRequestMock.mockResolvedValue({
      resolved: [
        {
          resourceId,
          url: "https://tos.example/image.jpg",
          mimeType: "image/jpeg",
        },
      ],
      unresolved: [],
    });

    const result = await resolveMediaReferencesForVideoGenerate({
      organizationId: "org-1",
      workflowId: "wf-1",
      cloudConfigured: true,
      references: [
        {
          resourceId,
          mimeType: "image/jpeg",
          kind: "cloud",
        },
      ],
    });

    expect(result.referenceImageUrls).toEqual([
      "https://tos.example/image.jpg",
    ]);
    expect(result.referenceImageInline).toEqual([]);
    expect(readStagingMock).not.toHaveBeenCalled();
    expect(makeRequestMock).toHaveBeenCalledWith(
      "/org-1/platform-ai/resolve-resource-refs",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ resourceIds: [resourceId] }),
      })
    );
  });

  it("uses local staging when kind is local even if cloud storage is configured", async () => {
    readStagingMock.mockResolvedValue({
      mimeType: "image/jpeg",
      data: "abc",
    });

    const result = await resolveMediaReferencesForVideoGenerate({
      organizationId: "org-1",
      workflowId: "wf-1",
      cloudConfigured: true,
      references: [
        {
          resourceId: "local-id",
          mimeType: "image/jpeg",
          kind: "local",
        },
      ],
    });

    expect(makeRequestMock).not.toHaveBeenCalled();
    expect(result.referenceImageInline).toEqual([
      { mimeType: "image/jpeg", data: "abc" },
    ]);
    expect(result.referenceImageUrls).toEqual([]);
  });

  it("throws when the reference has no kind", async () => {
    makeRequestMock.mockResolvedValue({
      resolved: [
        {
          resourceId: "missing-kind",
          url: "https://tos.example/image.jpg",
          mimeType: "image/jpeg",
        },
      ],
      unresolved: [],
    });

    await expect(
      resolveMediaReferencesForVideoGenerate({
        organizationId: "org-1",
        workflowId: "wf-1",
        cloudConfigured: true,
        references: [
          {
            resourceId: "missing-kind",
            mimeType: "image/jpeg",
          },
        ],
      })
    ).rejects.toThrow("Unable to resolve resource references: missing-kind");
    expect(makeRequestMock).not.toHaveBeenCalled();
  });
});
