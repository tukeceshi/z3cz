import { describe, expect, it } from "vitest";

import {
  isNearScrollBottom,
  resetScrollContainer,
  scrollContainerToBottom,
  scrollContainerToTop,
} from "./ai-text-preview-scroll";

function mockScrollElement(params: {
  scrollTop: number;
  clientHeight: number;
  scrollHeight: number;
}) {
  const element = {
    scrollTop: params.scrollTop,
    clientHeight: params.clientHeight,
    scrollHeight: params.scrollHeight,
  } as HTMLElement;

  Object.defineProperty(element, "scrollTop", {
    get: () => params.scrollTop,
    set: (value: number) => {
      params.scrollTop = value;
    },
  });

  return { element, params };
}

describe("ai-text-preview-scroll", () => {
  it("detects when the viewport is near the bottom", () => {
    const { element } = mockScrollElement({
      scrollTop: 100,
      clientHeight: 100,
      scrollHeight: 220,
    });

    expect(isNearScrollBottom(element, 48)).toBe(true);
    expect(isNearScrollBottom(element, 10)).toBe(false);
  });

  it("scrolls to the top and bottom", () => {
    const top = mockScrollElement({
      scrollTop: 80,
      clientHeight: 100,
      scrollHeight: 300,
    });
    scrollContainerToTop(top.element);
    expect(top.params.scrollTop).toBe(0);

    const bottom = mockScrollElement({
      scrollTop: 0,
      clientHeight: 100,
      scrollHeight: 300,
    });
    scrollContainerToBottom(bottom.element);
    expect(bottom.params.scrollTop).toBe(300);
  });

  it("resets scroll position to the top", () => {
    const { element, params } = mockScrollElement({
      scrollTop: 120,
      clientHeight: 100,
      scrollHeight: 300,
    });
    resetScrollContainer(element);
    expect(params.scrollTop).toBe(0);
    resetScrollContainer(null);
  });
});
