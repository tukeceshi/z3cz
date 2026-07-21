import { describe, expect, it } from "vitest";

import {
  collectOccupiedRects,
  findFallbackNodePosition,
  findOpenNodePositionFromCenter,
  findOpenNodePositionInBounds,
  findSnugAdjacencyPositionInBounds,
  getViewportCenterFromBounds,
  WORKFLOW_NODE_ADD_GAP_PX,
} from "./workflow-node-placement";

const AI_IMAGE_SIZE = { width: 360, height: 360 } as const;

const WIDE_BOUNDS = { minX: 0, minY: 0, maxX: 2000, maxY: 1200 } as const;

function centeredTopLeft(bounds: {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}): { x: number; y: number } {
  const center = getViewportCenterFromBounds(bounds);
  return {
    x: center.x - AI_IMAGE_SIZE.width / 2,
    y: center.y - AI_IMAGE_SIZE.height / 2,
  };
}

describe("findOpenNodePositionFromCenter", () => {
  it("places the first node at the viewport center", () => {
    const bounds = { minX: 0, minY: 0, maxX: 1000, maxY: 800 };
    const center = getViewportCenterFromBounds(bounds);
    const result = findOpenNodePositionFromCenter(
      bounds,
      center,
      AI_IMAGE_SIZE,
      []
    );
    expect(result?.position).toEqual(centeredTopLeft(bounds));
  });

  it("finds open space at the center when only a far corner cluster is occupied", () => {
    const bounds = { minX: 0, minY: 0, maxX: 2000, maxY: 1200 };
    const center = getViewportCenterFromBounds(bounds);
    const occupied = [
      { x: 0, y: 0, width: 360, height: 360 },
      { x: 0, y: 430, width: 360, height: 360 },
      { x: 390, y: 0, width: 360, height: 360 },
    ];
    const result = findOpenNodePositionFromCenter(
      bounds,
      center,
      AI_IMAGE_SIZE,
      occupied
    );
    expect(result?.position).toEqual(centeredTopLeft(bounds));
  });

  it("returns immediately on an empty canvas even with large flow bounds", () => {
    const bounds = { minX: -10000, minY: -10000, maxX: 10000, maxY: 10000 };
    const center = getViewportCenterFromBounds(bounds);
    const start = performance.now();
    const result = findOpenNodePositionFromCenter(
      bounds,
      center,
      AI_IMAGE_SIZE,
      []
    );
    const elapsed = performance.now() - start;
    expect(result?.position).toEqual(centeredTopLeft(bounds));
    expect(elapsed).toBeLessThan(50);
  });
});

describe("findSnugAdjacencyPositionInBounds", () => {
  it("places to the right with exact add gap (not ~400px grid gap)", () => {
    const occupied = [{ x: 100, y: 0, width: 360, height: 360 }];
    const center = getViewportCenterFromBounds(WIDE_BOUNDS);
    const result = findSnugAdjacencyPositionInBounds(
      WIDE_BOUNDS,
      center,
      AI_IMAGE_SIZE,
      occupied,
      WORKFLOW_NODE_ADD_GAP_PX
    );
    expect(result?.position).toEqual({
      x: 100 + 360 + WORKFLOW_NODE_ADD_GAP_PX,
      y: 0,
    });
  });

  it("prefers adjacency candidates closer to the viewport center", () => {
    const occupied = [
      { x: 0, y: 0, width: 360, height: 360 },
      { x: 900, y: 0, width: 360, height: 360 },
    ];
    const bounds = { minX: 0, minY: 0, maxX: 1400, maxY: 800 };
    const center = getViewportCenterFromBounds(bounds);
    const result = findSnugAdjacencyPositionInBounds(
      bounds,
      center,
      AI_IMAGE_SIZE,
      occupied
    );
    expect(result?.position.x).toBe(360 + WORKFLOW_NODE_ADD_GAP_PX);
  });
});

describe("findOpenNodePositionInBounds", () => {
  it("uses center-first search on an empty canvas", () => {
    const bounds = { minX: 0, minY: 0, maxX: 1000, maxY: 800 };
    const result = findOpenNodePositionInBounds(bounds, AI_IMAGE_SIZE, []);
    expect(result?.position).toEqual(centeredTopLeft(bounds));
  });

  it("does not use the old top-left grid that produced ~400px gaps", () => {
    const occupied = [{ x: 100, y: 0, width: 360, height: 360 }];
    const result = findOpenNodePositionInBounds(
      WIDE_BOUNDS,
      AI_IMAGE_SIZE,
      occupied
    );
    const oldGridX = 860;
    expect(result?.position.x).not.toBe(oldGridX);
  });
});

describe("findFallbackNodePosition", () => {
  it("prefers placing to the right of existing nodes on the same row", () => {
    const occupied = [{ x: 100, y: 50, width: 360, height: 360 }];
    const result = findFallbackNodePosition(
      occupied,
      AI_IMAGE_SIZE,
      WORKFLOW_NODE_ADD_GAP_PX
    );
    expect(result).toEqual({
      x: 100 + 360 + WORKFLOW_NODE_ADD_GAP_PX,
      y: 50,
    });
  });
});

describe("collectOccupiedRects", () => {
  it("uses generative card dimensions for ai-image nodes", () => {
    const rects = collectOccupiedRects([
      {
        id: "n1",
        position: { x: 10, y: 20 },
        data: { nodeType: "ai-image" } as never,
      },
    ]);
    expect(rects[0]).toEqual({ x: 10, y: 20, width: 360, height: 360 });
  });

  it("ignores measured size for generative nodes", () => {
    const rects = collectOccupiedRects([
      {
        id: "n1",
        position: { x: 0, y: 0 },
        measured: { width: 420, height: 400 },
        data: { nodeType: "ai-text" } as never,
      },
    ]);
    expect(rects[0]?.width).toBe(360);
    expect(rects[0]?.height).toBe(196);
  });
});
