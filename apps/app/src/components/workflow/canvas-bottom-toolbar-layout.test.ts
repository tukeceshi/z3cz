import { describe, expect, it } from "vitest";

import {
  CANVAS_BOTTOM_TOOLBAR_AGENT_GAP_PX,
  computeCanvasBottomToolbarShiftPx,
} from "./canvas-bottom-toolbar-layout";

describe("computeCanvasBottomToolbarShiftPx", () => {
  it("returns 0 when centered toolbar clears agent by the minimum gap", () => {
    const toolbarWidth = 200;
    const containerWidth = 1200;
    const centeredLeft = (containerWidth - toolbarWidth) / 2;
    const agentRight = centeredLeft - CANVAS_BOTTOM_TOOLBAR_AGENT_GAP_PX;

    expect(
      computeCanvasBottomToolbarShiftPx({
        containerWidth,
        toolbarWidth,
        agentRightInContainer: agentRight,
      })
    ).toBe(0);
  });

  it("shifts right when centered toolbar would sit within the minimum gap", () => {
    expect(
      computeCanvasBottomToolbarShiftPx({
        containerWidth: 900,
        toolbarWidth: 400,
        agentRightInContainer: 300,
      })
    ).toBe(150);
  });

  it("clamps so the toolbar stays inside the container", () => {
    expect(
      computeCanvasBottomToolbarShiftPx({
        containerWidth: 700,
        toolbarWidth: 400,
        agentRightInContainer: 500,
        rightInsetPx: 16,
      })
    ).toBe(134);
  });
});
