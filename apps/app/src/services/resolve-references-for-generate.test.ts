import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeRequest } from "@/services/utils";

import { resolveMediaReferencesForVideoGenerate } from "./resolve-references-for-generate";

vi.mock("@/services/utils", () => ({
  makeRequest: vi.fn(),
}));

vi.mock("@/services/ensure-references-cloud-for-generate", () => ({
  ensureReferencesCloudForGenerate: vi.fn(async ({ media }) => media),
}));

vi.mock("@/services/generative-media-staging", () => ({
  readGenerativeStagingAsInline: vi.fn(async () => {
    throw new Error("Staged resource is missing from this browser");
  }),
}));

const makeRequestMock = vi.mocked(makeRequest);

describe("resolveMediaReferencesForVideoGenerate", () => {
  beforeEach(() => {
    makeRequestMock.mockReset();
  });

  it("resolves a resourceId reference from the catalog without reading staging", async () => {
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
        },
      ],
    });

    expect(result.referenceImageUrls).toEqual([
      "https://tos.example/image.jpg",
    ]);
    expect(result.referenceImageInline).toEqual([]);
    expect(makeRequestMock).toHaveBeenCalledWith(
      "/org-1/platform-ai/resolve-resource-refs",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ resourceIds: [resourceId] }),
      })
    );
  });

  it("throws when cloud is configured and the resource is unresolved", async () => {
    makeRequestMock.mockResolvedValue({
      resolved: [],
      unresolved: ["missing-id"],
    });

    await expect(
      resolveMediaReferencesForVideoGenerate({
        organizationId: "org-1",
        workflowId: "wf-1",
        cloudConfigured: true,
        references: [
          {
            resourceId: "missing-id",
            mimeType: "image/jpeg",
          },
        ],
      })
    ).rejects.toThrow("Unable to resolve resource references: missing-id");
  });
});
