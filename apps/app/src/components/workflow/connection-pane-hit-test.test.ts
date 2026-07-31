import { describe, expect, it, vi } from "vitest";

import {
  nodeIdUnderPanePointer,
  panePointerToClient,
} from "./connection-pane-hit-test";

function mockNodeElement(id: string): Element {
  const el = {
    closest: (selector: string) =>
      selector === ".react-flow__node" ? el : null,
    getAttribute: (name: string) => (name === "data-id" ? id : null),
  };
  return el as unknown as Element;
}

describe("connection-pane-hit-test", () => {
  it("maps pane-local pointer to absolute client coords", () => {
    const domNode = {
      getBoundingClientRect: () =>
        ({
          left: 100,
          top: 50,
          right: 900,
          bottom: 650,
          width: 800,
          height: 600,
          x: 100,
          y: 50,
          toJSON: () => ({}),
        }) as DOMRect,
    } as HTMLElement;

    expect(panePointerToClient({ x: 220, y: 180 }, domNode)).toEqual({
      x: 320,
      y: 230,
    });
  });

  it("does not treat pane coords as flow coords (no zoom/transform multiply)", () => {
    const domNode = {
      getBoundingClientRect: () =>
        ({
          left: 40,
          top: 20,
          right: 1040,
          bottom: 820,
          width: 1000,
          height: 800,
          x: 40,
          y: 20,
          toJSON: () => ({}),
        }) as DOMRect,
    } as HTMLElement;

    // If wrongly treated as flow at zoom 2 + tx=40, client X would be skewed
    const client = panePointerToClient({ x: 200, y: 100 }, domNode);
    expect(client).toEqual({ x: 240, y: 120 });
  });

  it("returns the node under the pane pointer, not a neighbor toNode", () => {
    const imageEl = mockNodeElement("image-mid");
    const videoEl = mockNodeElement("video-right");

    const domNode = {
      getBoundingClientRect: () =>
        ({
          left: 0,
          top: 0,
          right: 1000,
          bottom: 800,
          width: 1000,
          height: 800,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }) as DOMRect,
    } as HTMLElement;

    const elementsFromPoint = vi.fn((x: number, y: number) => {
      if (x === 300 && y === 300) {
        return [imageEl];
      }
      if (x > 500) {
        return [videoEl];
      }
      return [];
    });

    expect(
      nodeIdUnderPanePointer(
        { x: 300, y: 300 },
        { domNode },
        elementsFromPoint
      )
    ).toBe("image-mid");

    expect(elementsFromPoint).toHaveBeenCalledWith(300, 300);
  });
});
