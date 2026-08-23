import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ensureLocalResourcesUploaded,
  LocalReferenceCloudUploadError,
} from "./ensure-resource-cached";

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

describe("ensureLocalResourcesUploaded", () => {
  beforeEach(() => {
    readStagingMock.mockReset();
    cloudResolvableMock.mockReset();
    uploadFromStagingMock.mockReset();
  });

  it("returns media unchanged when cloud is not configured", async () => {
    const media = [{ resourceId: "res-1", mimeType: "image/jpeg" }] as const;

    const result = await ensureLocalResourcesUploaded({
      organizationId: "org-1",
      workflowId: "wf-1",
      media,
      cloudConfigured: false,
    });

    expect(result).toEqual(media);
    expect(cloudResolvableMock).not.toHaveBeenCalled();
  });

  it("skips upload when the resource is already cloud-resolvable", async () => {
    cloudResolvableMock.mockResolvedValue(true);

    const result = await ensureLocalResourcesUploaded({
      organizationId: "org-1",
      workflowId: "wf-1",
      media: [
        {
          resourceId: "res-1",
          mimeType: "image/jpeg",
          cloudUploadFailed: true,
        },
      ],
      cloudConfigured: true,
    });

    expect(result).toEqual([{ resourceId: "res-1", mimeType: "image/jpeg" }]);
    expect(readStagingMock).not.toHaveBeenCalled();
    expect(uploadFromStagingMock).not.toHaveBeenCalled();
  });

  it("throws when staging is missing for a non-cloud resource", async () => {
    cloudResolvableMock.mockResolvedValue(false);
    readStagingMock.mockResolvedValue(null);

    await expect(
      ensureLocalResourcesUploaded({
        organizationId: "org-1",
        workflowId: "wf-1",
        media: [{ resourceId: "missing", mimeType: "image/jpeg" }],
        cloudConfigured: true,
      })
    ).rejects.toBeInstanceOf(LocalReferenceCloudUploadError);
  });

  it("uploads from staging when the resource is not yet cloud-resolvable", async () => {
    cloudResolvableMock
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    readStagingMock.mockResolvedValue({
      blob: new Blob(["x"], { type: "image/jpeg" }),
      mimeType: "image/jpeg",
    });
    uploadFromStagingMock.mockResolvedValue({
      id: "res-1",
      mimeType: "image/jpeg",
      storageBackend: "volcengine_tos",
      storageKey: "key",
    });

    const result = await ensureLocalResourcesUploaded({
      organizationId: "org-1",
      workflowId: "wf-1",
      media: [{ resourceId: "res-1", mimeType: "image/jpeg" }],
      cloudConfigured: true,
    });

    expect(uploadFromStagingMock).toHaveBeenCalledOnce();
    expect(result).toEqual([{ resourceId: "res-1", mimeType: "image/jpeg" }]);
  });
});
