import { describe, expect, it } from "vitest";

import {
  GENERATIVE_EDGE_PLUS_BORDER_GAP_PX,
  GENERATIVE_EDGE_PLUS_OUTER_PX,
  GENERATIVE_EDGE_PLUS_PX,
  GENERATIVE_EDGE_SHELL_W_PX,
  generativeEdgeColumnStyle,
  generativeEdgePlusLeft,
} from "./generative-edge-connection-config";

describe("generative edge side layout", () => {
  it("keeps the connection shell outside the card", () => {
    expect(GENERATIVE_EDGE_SHELL_W_PX).toBe(GENERATIVE_EDGE_PLUS_OUTER_PX);

    const left = generativeEdgeColumnStyle("left");
    expect(left.left).toBe(-GENERATIVE_EDGE_PLUS_OUTER_PX);
    expect(left.width).toBe(GENERATIVE_EDGE_PLUS_OUTER_PX);
    expect((left.left ?? 0) + left.width).toBe(0);

    const right = generativeEdgeColumnStyle("right");
    expect(right.right).toBe(-GENERATIVE_EDGE_PLUS_OUTER_PX);
    expect(right.width).toBe(GENERATIVE_EDGE_PLUS_OUTER_PX);
  });

  it("places the plus in the outer band, not inside the card", () => {
    expect(generativeEdgePlusLeft("left")).toBe(0);
    expect(generativeEdgePlusLeft("right")).toBe(
      GENERATIVE_EDGE_PLUS_BORDER_GAP_PX
    );
    expect(
      generativeEdgePlusLeft("left") + GENERATIVE_EDGE_PLUS_PX
    ).toBeLessThanOrEqual(GENERATIVE_EDGE_PLUS_OUTER_PX);
    expect(
      generativeEdgePlusLeft("right") + GENERATIVE_EDGE_PLUS_PX
    ).toBe(GENERATIVE_EDGE_SHELL_W_PX);
  });
});
