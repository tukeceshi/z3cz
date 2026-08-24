import { describe, expect, it } from "vitest";

import {
  getResourceIdFromValue,
  hasDisplayableWorkflowMedia,
  isDisplayableWorkflowMedia,
  isResourceIdReference,
} from "./media-reference";

describe("getResourceIdFromValue", () => {
  it("reads resourceId, ephemeral mediaId, then object id", () => {
    expect(
      getResourceIdFromValue({
        resourceId: "res-1",
        mimeType: "image/png",
        generating: true,
      })
    ).toBe("res-1");
    expect(
      getResourceIdFromValue({
        kind: "ephemeral",
        mediaId: "eph-1",
        mimeType: "image/png",
        url: "https://example.com/a.png",
      })
    ).toBe("eph-1");
    expect(
      getResourceIdFromValue({
        id: "obj-1",
        mimeType: "image/png",
      })
    ).toBe("obj-1");
    expect(getResourceIdFromValue(null)).toBeNull();
  });
});

describe("isResourceIdReference", () => {
  it("accepts optional catalog kind and rejects ephemeral media links", () => {
    expect(
      isResourceIdReference({
        resourceId: "res-1",
        mimeType: "image/png",
        kind: "cloud",
      })
    ).toBe(true);
    expect(
      isResourceIdReference({
        kind: "ephemeral",
        mediaId: "eph-1",
        mimeType: "image/png",
        url: "https://example.com/a.png",
      })
    ).toBe(false);
  });
});

describe("isDisplayableWorkflowMedia", () => {
  it("rejects generating and failed refs", () => {
    expect(
      isDisplayableWorkflowMedia({
        resourceId: "pending",
        generating: true,
      })
    ).toBe(false);
    expect(
      isDisplayableWorkflowMedia({
        resourceId: "failed",
        failed: true,
      })
    ).toBe(false);
    expect(
      isDisplayableWorkflowMedia({
        resourceId: "done",
        mimeType: "image/jpeg",
      })
    ).toBe(true);
    expect(
      hasDisplayableWorkflowMedia([
        { resourceId: "pending", generating: true },
        { resourceId: "done", mimeType: "image/jpeg" },
      ])
    ).toBe(true);
  });
});
