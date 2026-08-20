import { describe, expect, it } from "vitest";

import {
  DEFAULT_HOMEPAGE_VIDEO_SCENARIOS,
  readHomepageVideoScenarios,
} from "./homepage-video-scenario";

describe("readHomepageVideoScenarios", () => {
  it("returns defaults when value is missing", () => {
    expect(readHomepageVideoScenarios(undefined)).toEqual(
      DEFAULT_HOMEPAGE_VIDEO_SCENARIOS
    );
  });

  it("parses a valid scenario list", () => {
    const parsed = readHomepageVideoScenarios([
      {
        id: "custom",
        name: "自定义",
        description: "说明",
        sortOrder: 0,
        params: {
          canonicalId: "doubao-seedance-2",
          ratio: "16:9",
          resolution: "720p",
          durationSec: 30,
          gachaCount: 2,
          referencedClipCount: 1,
          avgReferenceSec: 5,
        },
      },
    ]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.name).toBe("自定义");
  });

  it("seeds seven default scenarios", () => {
    expect(DEFAULT_HOMEPAGE_VIDEO_SCENARIOS).toHaveLength(7);
    expect(DEFAULT_HOMEPAGE_VIDEO_SCENARIOS.map((entry) => entry.id)).toEqual([
      "clip",
      "learn",
      "personal",
      "pipeline",
      "restyle",
      "premium4k",
      "drama25",
    ]);
    expect(
      DEFAULT_HOMEPAGE_VIDEO_SCENARIOS[4]?.params.referencedClipCount
    ).toBe(240);
    expect(DEFAULT_HOMEPAGE_VIDEO_SCENARIOS[6]?.params.durationSec).toBe(2700);
  });
});
