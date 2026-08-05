import { describe, expect, it } from "vitest";

import {
  isValidWorkflowEditorViewport,
  viewportNearlyEqual,
} from "./workflow-viewport-utils";

describe("isValidWorkflowEditorViewport", () => {
  it("accepts finite x/y/zoom", () => {
    expect(isValidWorkflowEditorViewport({ x: 0, y: 0, zoom: 1 })).toBe(true);
  });

  it("rejects invalid zoom", () => {
    expect(isValidWorkflowEditorViewport({ x: 0, y: 0, zoom: 0 })).toBe(false);
    expect(isValidWorkflowEditorViewport(null)).toBe(false);
  });
});

describe("viewportNearlyEqual", () => {
  it("treats matching viewports as equal", () => {
    expect(
      viewportNearlyEqual({ x: 10, y: 20, zoom: 1.5 }, { x: 10, y: 20, zoom: 1.5 })
    ).toBe(true);
  });

  it("treats small deltas as equal", () => {
    expect(
      viewportNearlyEqual({ x: 10, y: 20, zoom: 1.5 }, { x: 11, y: 21, zoom: 1.505 })
    ).toBe(true);
  });

  it("treats large deltas as different", () => {
    expect(
      viewportNearlyEqual({ x: 10, y: 20, zoom: 1.5 }, { x: 20, y: 30, zoom: 2 })
    ).toBe(false);
  });
});
