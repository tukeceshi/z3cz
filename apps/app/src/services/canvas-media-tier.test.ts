import { describe, expect, it } from "vitest";

import {
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
    expect(computeCanvasScreenShortEdge(1, 1)).toBe(270);
    expect(computeCanvasScreenShortEdge(0.5, 1)).toBe(135);
    expect(computeCanvasScreenShortEdge(0.1, 1)).toBe(27);
    expect(computeCanvasScreenShortEdge(1.2, 1)).toBeCloseTo(324);
  });

  it("picks s/m/l from ratio to 270", () => {
    expect(pickCanvasMediaTier(93)).toBe("s"); // ~34%
    expect(pickCanvasMediaTier(100)).toBe("m"); // ~37%
    expect(pickCanvasMediaTier(134)).toBe("m"); // ~49%
    expect(pickCanvasMediaTier(135)).toBe("m"); // 50%
    expect(pickCanvasMediaTier(270)).toBe("m"); // 100%
    expect(pickCanvasMediaTier(296)).toBe("m"); // ~110%
    expect(pickCanvasMediaTier(297)).toBe("l"); // >110%
    expect(pickCanvasMediaTier(540)).toBe("l");
  });

  it("applies hysteresis to reduce tier churn", () => {
    expect(pickCanvasMediaTierWithHysteresis(100, "s")).toBe("s");
    expect(pickCanvasMediaTierWithHysteresis(115, "s")).toBe("m");
    expect(pickCanvasMediaTierWithHysteresis(100, "m")).toBe("m");
    expect(pickCanvasMediaTierWithHysteresis(78, "m")).toBe("s");
  });
});
