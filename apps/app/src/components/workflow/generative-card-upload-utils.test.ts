import { describe, expect, it } from "vitest";

import { resolveGenerativeCardUploadError } from "./generative-card-upload-utils";

const t = (key: string) => key;

describe("resolveGenerativeCardUploadError", () => {
  it("returns an error when cloud upload failed locally", () => {
    const error = resolveGenerativeCardUploadError({
      value: {
        resourceId: "res-1",
        mimeType: "image/png",
        cloudUploadFailed: true,
      },
      cloudConfigured: true,
      t,
    });

    expect(error).not.toBeNull();
    expect(error?.summary).toBe(
      "workflow.generativeErrors.cloudUploadFailedSavedLocally"
    );
  });

  it("returns null for successful cloud uploads", () => {
    expect(
      resolveGenerativeCardUploadError({
        value: { resourceId: "res-1", mimeType: "image/png" },
        cloudConfigured: true,
        t,
      })
    ).toBeNull();
  });
});
