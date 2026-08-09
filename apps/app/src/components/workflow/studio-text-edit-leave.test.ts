import { describe, expect, it } from "vitest";

import { shouldLeaveStudioTextEditSurface } from "./studio-text-edit-leave";

describe("shouldLeaveStudioTextEditSurface", () => {
  it("returns false when focus stays inside the container", () => {
    const container = document.createElement("div");
    const inner = document.createElement("input");
    container.append(inner);

    expect(shouldLeaveStudioTextEditSurface(container, inner)).toBe(false);
  });

  it("returns true when focus moves outside", () => {
    const container = document.createElement("div");
    const outside = document.createElement("button");
    document.body.append(container, outside);

    expect(shouldLeaveStudioTextEditSurface(container, outside)).toBe(true);

    container.remove();
    outside.remove();
  });
});
