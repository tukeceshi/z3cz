import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeRequest } from "@/services/utils";

import { resolveMediaReferencesForVideoGenerate } from "./resolve-references-for-generate";

const aliases = vi.hoisted(() => new Map<string, string>());

vi.mock("@/services/utils", () => ({
  makeRequest: vi.fn(),
}));

vi.mock("@/services/generative-media-staging", () => ({
  readGenerativeStagingAsInline: vi.fn(async () => {
    throw new Error("Local resource is missing from this browser");
  }),
}));

vi.mock("@/services/media-resource-alias-service", () => ({
  resolveCanonicalResourceId: vi.fn(
    (params: {
      readonly media: {
        readonly kind?: string;
        readonly mediaId?: string;
        readonly resourceId?: string;
      };
    }) => {
      const id =
        params.media.kind === "local"
          ? params.media.mediaId
          : params.media.resourceId;
      if (!id) return "";
      return aliases.get(id) ?? id;
    }
  ),
}));

const makeRequestMock = vi.mocked(makeRequest);

describe("resolveMediaReferencesForVideoGenerate", () => {
  beforeEach(() => {
    aliases.clear();
    makeRequestMock.mockReset();
  });

  it("resolves a local-kind reference by ID from the catalog, without reading staging", async () => {
    const mediaId = "ab4490ab-4bd1-4542-8a13-f1f1277855b8";
    makeRequestMock.mockResolvedValue({
      resolved: [
        {
          resourceId: mediaId,
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
          kind: "local",
          mediaId,
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
        body: JSON.stringify({ resourceIds: [mediaId] }),
      })
    );
  });

  it("looks up an aliased catalog ID without changing the node ID", async () => {
    const localId = "ab4490ab-4bd1-4542-8a13-f1f1277855b8";
    const catalogId = "01a0007e-0187-77ac-aa1b-73e55c4af441";
    aliases.set(localId, catalogId);
    makeRequestMock.mockResolvedValue({
      resolved: [
        {
          resourceId: catalogId,
          url: "https://tos.example/image.jpg",
          mimeType: "image/jpeg",
        },
      ],
      unresolved: [localId],
    });

    const result = await resolveMediaReferencesForVideoGenerate({
      organizationId: "org-1",
      workflowId: "wf-1",
      cloudConfigured: true,
      references: [
        {
          kind: "local",
          mediaId: localId,
          mimeType: "image/jpeg",
        },
      ],
    });

    expect(result.referenceImageUrls).toEqual([
      "https://tos.example/image.jpg",
    ]);
    expect(makeRequestMock).toHaveBeenCalledWith(
      "/org-1/platform-ai/resolve-resource-refs",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ resourceIds: [localId, catalogId] }),
      })
    );
  });

  it("does not throw local-missing when cloud is configured", async () => {
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
            kind: "local",
            mediaId: "missing-id",
            mimeType: "image/jpeg",
          },
        ],
      })
    ).rejects.toThrow("Unable to resolve resource references: missing-id");
  });
});
