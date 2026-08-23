import { describe, expect, it } from "vitest";

import {
  CANVAS_GENERATIVE_FILE_DROP_GAP_PX,
  CANVAS_GENERATIVE_FILE_DROP_HORIZONTAL_STEP_PX,
  resolveCanvasFileDropCenterPoint,
  resolveCanvasFileDropDropCenters,
  resolveCanvasFileDropNodePosition,
} from "./generative-card-upload-utils";

describe("resolveCanvasFileDropCenterPoint", () => {
  it("returns the base center for the first preview slot", () => {
    expect(
      resolveCanvasFileDropCenterPoint({
        baseCenter: { x: 120, y: 340 },
        fileIndex: 0,
      })
    ).toEqual({ x: 120, y: 340 });
  });

  it("offsets later preview slots by the fixed step", () => {
    expect(
      resolveCanvasFileDropCenterPoint({
        baseCenter: { x: 120, y: 340 },
        fileIndex: 2,
      })
    ).toEqual({
      x: 120 + CANVAS_GENERATIVE_FILE_DROP_HORIZONTAL_STEP_PX * 2,
      y: 340,
    });
  });
});

describe("resolveCanvasFileDropDropCenters", () => {
  it("accumulates drop centers with a 20px edge gap", () => {
    expect(
      resolveCanvasFileDropDropCenters({ x: 100, y: 200 }, [
        { width: 270, height: 270 },
        { width: 270, height: 270 },
      ])
    ).toEqual([
      { x: 100, y: 200 },
      {
        x: 100 + 270 + CANVAS_GENERATIVE_FILE_DROP_GAP_PX,
        y: 200,
      },
    ]);
  });

  it("uses each card width when accumulating drop centers", () => {
    expect(
      resolveCanvasFileDropDropCenters({ x: 50, y: 80 }, [
        { width: 270, height: 270 },
        { width: 480, height: 270 },
      ])
    ).toEqual([
      { x: 50, y: 80 },
      {
        x: 50 + 270 / 2 + CANVAS_GENERATIVE_FILE_DROP_GAP_PX + 480 / 2,
        y: 80,
      },
    ]);
  });
});

describe("resolveCanvasFileDropNodePosition", () => {
  it("converts a center point to a top-left node position", () => {
    expect(
      resolveCanvasFileDropNodePosition(
        { x: 200, y: 150 },
        { width: 100, height: 60 }
      )
    ).toEqual({ x: 150, y: 120 });
  });
});
