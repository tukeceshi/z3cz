import { describe, expect, it } from "vitest";

import {
  bindEphemeralImagesToResourceIds,
  buildGeneratingResourceRefs,
} from "./canvas-image-generation-job";

describe("bindEphemeralImagesToResourceIds", () => {
  it("rewrites media ids to the pre-created resource ids", () => {
    const bound = bindEphemeralImagesToResourceIds(
      [
        {
          kind: "ephemeral",
          url: "https://example.com/a.png",
          mimeType: "image/png",
          mediaId: "new-1",
        },
        {
          kind: "ephemeral",
          url: "https://example.com/b.png",
          mimeType: "image/png",
          mediaId: "new-2",
        },
      ],
      ["res-1", "res-2"]
    );

    expect(bound.map((image) => image.mediaId)).toEqual(["res-1", "res-2"]);
    expect(bound[0]?.url).toBe("https://example.com/a.png");
  });
});

describe("buildGeneratingResourceRefs", () => {
  it("marks placeholder resource ids as generating", () => {
    expect(buildGeneratingResourceRefs(["res-1"])).toEqual([
      {
        resourceId: "res-1",
        mimeType: "image/png",
        generating: true,
      },
    ]);
  });
});
