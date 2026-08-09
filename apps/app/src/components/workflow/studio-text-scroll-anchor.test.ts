import { describe, expect, it } from "vitest";

import {
  applyStudioTextScrollRestore,
  captureStudioTextScrollRestore,
} from "./studio-text-scroll-anchor";

describe("studio-text-scroll-anchor", () => {
  it("restores scroll relative to a visible anchor", () => {
    const container = document.createElement("div");
    Object.defineProperty(container, "clientHeight", { value: 200 });
    container.scrollTop = 120;

    const anchor = document.createElement("div");
    anchor.dataset.studioScrollAnchor = "seg-1";
    container.append(anchor);

    container.getBoundingClientRect = () =>
      ({
        top: 100,
        bottom: 300,
        height: 200,
      }) as DOMRect;

    anchor.getBoundingClientRect = () =>
      ({
        top: 150,
        bottom: 180,
      }) as DOMRect;

    const restore = captureStudioTextScrollRestore(container);
    expect(restore.anchorKey).toBe("seg-1");
    expect(restore.viewportOffset).toBe(50);

    anchor.getBoundingClientRect = () =>
      ({
        top: 170,
        bottom: 200,
      }) as DOMRect;

    applyStudioTextScrollRestore(container, restore);
    expect(container.scrollTop).toBe(100);
  });
});
