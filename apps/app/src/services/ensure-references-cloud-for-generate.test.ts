import { beforeEach, describe, expect, it, vi } from "vitest";

import { ensureReferencesCloudForGenerate } from "./ensure-references-cloud-for-generate";

vi.mock("sonner", () => ({
  toast: {
    loading: vi.fn(() => "toast-id"),
    dismiss: vi.fn(),
  },
}));

vi.mock("@/services/generative-media-staging", () => ({
  readGenerativeStagingBlob: vi.fn(),
}));

vi.mock("@/services/resolve-resource-ids-on-server", () => ({
  isResourceIdCloudResolvable: vi.fn(),
}));

vi.mock("@/services/stage-generative-media", () => ({
  uploadGenerativeMediaFromLocalStaging: vi.fn(),
}));

import { readGenerativeStagingBlob } from "@/services/generative-media-staging";
import { isResourceIdCloudResolvable } from "@/services/resolve-resource-ids-on-server";
import { uploadGenerativeMediaFromLocalStaging } from "@/services/stage-generative-media";

const readStagingMock = vi.mocked(readGenerativeStagingBlob);
const cloudResolvableMock = vi.mocked(isResourceIdCloudResolvable);
const uploadFromStagingMock = vi.mocked(uploadGenerativeMediaFromLocalStaging);

describe("ensureReferencesCloudForGenerate", () => {
  beforeEach(() => {
    readStagingMock.mockReset();
    cloudResolvableMock.mockReset();
    uploadFromStagingMock.mockReset();
  });

  it("returns media unchanged when cloud is not configured", async () => {
    const media = [{ resourceId: "res-1", mimeType: "image/jpeg" }] as const;

    const result = await ensureReferencesCloudForGenerate({
      organizationId: "org-1",
      workflowId: "wf-1",
      media,
      cloudConfigured: false,
    });

    expect(result).toEqual(media);
    expect(cloudResolvableMock).not.toHaveBeenCalled();
  });

  it("retries upload and clears cloudUploadFailed when cloud resolves", async () => {
    const resourceId = "res-retry";
    cloudResolvableMock
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    readStagingMock.mockResolvedValue({
      blob: new Blob(["x"], { type: "image/jpeg" }),
      mimeType: "image/jpeg",
    });
    uploadFromStagingMock.mockResolvedValue({
      id: resourceId,
      mimeType: "image/jpeg",
      storageBackend: "volcengine_tos",
      storageKey: "key",
    });

    const result = await ensureReferencesCloudForGenerate({
      organizationId: "org-1",
      workflowId: "wf-1",
      media: [
        {
          resourceId,
          mimeType: "image/jpeg",
          cloudUploadFailed: true,
        },
      ],
      cloudConfigured: true,
    });

    expect(uploadFromStagingMock).toHaveBeenCalledWith({
      organizationId: "org-1",
      workflowId: "wf-1",
      mediaId: resourceId,
      mimeType: "image/jpeg",
      objectId: resourceId,
    });
    expect(result).toEqual([{ resourceId, mimeType: "image/jpeg" }]);
  });

  it("throws when staging is missing for an unresolved reference", async () => {
    cloudResolvableMock.mockResolvedValue(false);
    readStagingMock.mockResolvedValue(null);

    await expect(
      ensureReferencesCloudForGenerate({
        organizationId: "org-1",
        workflowId: "wf-1",
        media: [{ resourceId: "missing", mimeType: "image/jpeg" }],
        cloudConfigured: true,
      })
    ).rejects.toThrow(/upload reference media to cloud|参考资源未能上传/i);
  });
});
