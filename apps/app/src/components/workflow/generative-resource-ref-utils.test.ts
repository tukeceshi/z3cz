import { describe, expect, it } from "vitest";

import {
  markResourceRefFailed,
  stripGeneratingFlag,
} from "./generative-resource-ref-utils";

describe("generative-resource-ref-utils", () => {
  it("marks resource refs as failed", () => {
    expect(
      markResourceRefFailed({
        resourceId: "res-1",
        mimeType: "video/mp4",
        generating: true,
      })
    ).toEqual({
      resourceId: "res-1",
      mimeType: "video/mp4",
      failed: true,
    });
  });

  it("strips generating flag from resource refs", () => {
    expect(
      stripGeneratingFlag({
        resourceId: "res-1",
        mimeType: "video/mp4",
        generating: true,
      })
    ).toEqual({
      resourceId: "res-1",
      mimeType: "video/mp4",
    });
  });
});
