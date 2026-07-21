import { describe, expect, it } from "vitest";

import {
  isWorkflowBottomPanelVisible,
  WORKFLOW_BOTTOM_PANEL_MIN_ZOOM,
} from "./ai-generative-panel-utils";

describe("isWorkflowBottomPanelVisible", () => {
  it("shows the panel at and above the minimum zoom", () => {
    expect(isWorkflowBottomPanelVisible(WORKFLOW_BOTTOM_PANEL_MIN_ZOOM)).toBe(
      true
    );
    expect(isWorkflowBottomPanelVisible(1)).toBe(true);
  });

  it("hides the panel below the minimum zoom", () => {
    expect(isWorkflowBottomPanelVisible(0.29)).toBe(false);
    expect(isWorkflowBottomPanelVisible(0.05)).toBe(false);
  });

  it("hides the panel for invalid zoom values", () => {
    expect(isWorkflowBottomPanelVisible(Number.NaN)).toBe(false);
    expect(isWorkflowBottomPanelVisible(Number.POSITIVE_INFINITY)).toBe(false);
  });
});
