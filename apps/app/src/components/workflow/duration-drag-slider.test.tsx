import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DurationDragSlider } from "./duration-drag-slider";

describe("DurationDragSlider", () => {
  afterEach(() => {
    cleanup();
  });

  it("commits the clicked mark value", () => {
    const onPreview = vi.fn();
    const onCommit = vi.fn();
    const { getByTestId } = render(
      <DurationDragSlider
        min={20}
        max={120}
        value={24}
        marks={[30, 60, 120]}
        onPreview={onPreview}
        onCommit={onCommit}
      />
    );

    fireEvent.mouseDown(getByTestId("duration-drag-mark-60"));

    expect(onPreview).toHaveBeenCalledWith(60);
    expect(onCommit).toHaveBeenCalledWith(60);
  });

  it("hides marks when none are provided", () => {
    const { queryByTestId } = render(
      <DurationDragSlider
        min={1}
        max={10}
        value={5}
        onPreview={() => undefined}
        onCommit={() => undefined}
      />
    );

    expect(queryByTestId("duration-drag-mark-30")).toBeNull();
  });
});
