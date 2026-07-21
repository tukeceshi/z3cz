import { describe, expect, it } from "vitest";

import { isValidWorkflowEditorViewport } from "./workflow-viewport-utils";

describe("isValidWorkflowEditorViewport", () => {
  it("accepts finite x/y/zoom", () => {
    expect(isValidWorkflowEditorViewport({ x: 0, y: 0, zoom: 1 })).toBe(true);
  });

  it("rejects invalid zoom", () => {
    expect(isValidWorkflowEditorViewport({ x: 0, y: 0, zoom: 0 })).toBe(false);
    expect(isValidWorkflowEditorViewport(null)).toBe(false);
  });
});
