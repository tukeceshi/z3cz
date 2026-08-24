import { describe, expect, it } from "vitest";

import {
  applyResourceKind,
  mapMediaResourceKinds,
  markResourceRefFailed,
  stripGeneratingFlag,
} from "./generative-resource-ref-utils";

describe("generative-resource-ref-utils", () => {
  it("marks resource refs as failed and keeps kind", () => {
    expect(
      markResourceRefFailed({
        resourceId: "res-1",
        mimeType: "video/mp4",
        generating: true,
        kind: "ephemeral",
      })
    ).toEqual({
      resourceId: "res-1",
      mimeType: "video/mp4",
      failed: true,
      kind: "ephemeral",
    });
  });

  it("strips generating flag and keeps kind", () => {
    expect(
      stripGeneratingFlag({
        resourceId: "res-1",
        mimeType: "video/mp4",
        generating: true,
        kind: "ephemeral",
      })
    ).toEqual({
      resourceId: "res-1",
      mimeType: "video/mp4",
      kind: "ephemeral",
    });
  });

  it("writes catalog kind onto matching refs", () => {
    const media = [
      {
        resourceId: "res-1",
        mimeType: "image/png",
        kind: "ephemeral" as const,
      },
      {
        resourceId: "res-2",
        mimeType: "image/png",
        kind: "local" as const,
      },
    ];
    expect(
      mapMediaResourceKinds(media, new Map([["res-1", "cloud"]]))
    ).toEqual([
      {
        resourceId: "res-1",
        mimeType: "image/png",
        kind: "cloud",
      },
      media[1],
    ]);
    expect(applyResourceKind(media[0]!, "cloud").kind).toBe("cloud");
  });
});
