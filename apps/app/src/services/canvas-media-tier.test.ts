import { describe, expect, it } from "vitest";

import { MEDIA_CARD_SHORT_SIDE_PX } from "@/components/workflow/media-card-size";

import {
  CANVAS_TIER_RATIO,
  CANVAS_TIER_SHORT_EDGE,
  computeCanvasScreenShortEdge,
  pickCanvasMediaTier,
  pickCanvasMediaTierWithHysteresis,
} from "./canvas-media-tier";

describe("canvas-media-tier", () => {
  it("uses 80px for the smallest canvas tier", () => {
    expect(CANVAS_TIER_SHORT_EDGE.s).toBe(80);
  });
  it("computes on-screen short edge from zoom", () => {
    expect(computeCanvasScreenShortEdge(1, 1)).toBe(MEDIA_CARD_SHORT_SIDE_PX);
    expect(computeCanvasScreenShortEdge(0.5, 1)).toBe(MEDIA_CARD_SHORT_SIDE_PX / 2);
    expect(computeCanvasScreenShortEdge(0.1, 1)).toBeCloseTo(
      MEDIA_CARD_SHORT_SIDE_PX * 0.1
    );
    expect(computeCanvasScreenShortEdge(1.2, 1)).toBeCloseTo(
      MEDIA_CARD_SHORT_SIDE_PX * 1.2
    );
  });

  it("picks s/m/l from ratio to the card short side", () => {
    const short = MEDIA_CARD_SHORT_SIDE_PX;
    expect(pickCanvasMediaTier(short * CANVAS_TIER_RATIO.s - 1)).toBe("s");
    expect(pickCanvasMediaTier(short * CANVAS_TIER_RATIO.s + 8)).toBe("m");
    expect(pickCanvasMediaTier(short * 0.5)).toBe("m");
    expect(pickCanvasMediaTier(short)).toBe("m");
    expect(pickCanvasMediaTier(short * CANVAS_TIER_RATIO.m - 1)).toBe("m");
    expect(pickCanvasMediaTier(short * CANVAS_TIER_RATIO.m)).toBe("l");
    expect(pickCanvasMediaTier(short * 2)).toBe("l");
  });

  it("applies hysteresis to reduce tier churn", () => {
    expect(pickCanvasMediaTierWithHysteresis(100, "s")).toBe("s");
    expect(pickCanvasMediaTierWithHysteresis(115, "s")).toBe("m");
    expect(pickCanvasMediaTierWithHysteresis(100, "m")).toBe("m");
    expect(pickCanvasMediaTierWithHysteresis(78, "m")).toBe("s");
  });
});
