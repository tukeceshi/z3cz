import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  CloudCatalogRegisterFailedError,
  CloudObjectUploadFailedError,
  uploadBlobToCloudWorkflow,
} from "./upload-generative-media-cloud";

vi.mock("@/services/allocate-generative-media-resource-id", () => ({
  allocateGenerativeMediaResourceId: () => "resource-1",
}));

vi.mock("@/services/generative-media-staging", () => ({
  writeGenerativeStaging: vi.fn(async () => true),
}));

vi.mock("@/hooks/use-ai-media-cache", () => ({
  notifyAiMediaCacheChanged: vi.fn(),
}));

vi.mock("@/services/register-media-resource", () => ({
  registerMediaResource: vi.fn(async () => undefined),
}));

vi.mock("@/services/cloud-storage-error-reporter", () => ({
  reportCloudStorageError: vi.fn(),
}));

vi.mock("@/services/utils", () => ({
  makeRequest: vi.fn(async () => ({
    uploadUrl: "https://upload.example/object",
    uploadHeaders: {},
    reference: {
      id: "resource-1",
      mimeType: "image/png",
      storageKey: "org/wf/image/resource-1.png",
      storageBackend: "volcengine_tos",
    },
  })),
}));

const { makeRequest } = await import("@/services/utils");
const { registerMediaResource } = await import("@/services/register-media-resource");

describe("uploadBlobToCloudWorkflow", () => {
  beforeEach(() => {
    vi.mocked(makeRequest).mockClear();
    vi.mocked(registerMediaResource).mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false }))
    );
  });

  it("returns cloudUploadFailed when object upload fails", async () => {
    const result = await uploadBlobToCloudWorkflow({
      organizationId: "org-1",
      workflowId: "wf-1",
      blob: new Blob(["x"], { type: "image/png" }),
      mimeType: "image/png",
      mediaKind: "ai-image",
      nodeType: "ai-image",
    });

    expect(result).toEqual({
      resourceId: "resource-1",
      mimeType: "image/png",
      cloudUploadFailed: true,
    });
    expect(registerMediaResource).toHaveBeenCalledWith({
      organizationId: "org-1",
      id: "resource-1",
      kind: "local",
      mimeType: "image/png",
    });
  });

  it("rethrows when catalog registration fails after a successful upload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true }))
    );
    vi.mocked(registerMediaResource).mockRejectedValueOnce(
      new Error("catalog unavailable")
    );

    await expect(
      uploadBlobToCloudWorkflow({
        organizationId: "org-1",
        workflowId: "wf-1",
        blob: new Blob(["x"], { type: "image/png" }),
        mimeType: "image/png",
        mediaKind: "ai-image",
        nodeType: "ai-image",
      })
    ).rejects.toBeInstanceOf(CloudCatalogRegisterFailedError);
  });
});

describe("cloud upload errors", () => {
  it("names typed upload errors", () => {
    expect(new CloudObjectUploadFailedError().name).toBe(
      "CloudObjectUploadFailedError"
    );
    expect(new CloudCatalogRegisterFailedError().name).toBe(
      "CloudCatalogRegisterFailedError"
    );
  });
});
