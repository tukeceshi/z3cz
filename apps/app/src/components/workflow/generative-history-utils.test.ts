import { describe, expect, it } from "vitest";

import {
  collectHistoryParamParts,
  collectImageHistoryParamParts,
  formatHistoryCreatedAt,
  resolveHistoryModelLabel,
  splitHistoryMediaRows,
} from "./generative-history-utils";
describe("splitHistoryMediaRows", () => {
  it("expands multi-media rows and keeps single rows", () => {
    const items = splitHistoryMediaRows({
      items: [
        { id: "a", createdAt: "t", images: ["1", "2"] },
        { id: "b", createdAt: "t", images: ["3"] },
      ],
      getMedia: (item) => item.images,
      withMedia: (item, images) => ({ ...item, images }),
    });

    expect(items).toEqual([
      { id: "a", createdAt: "t", images: ["1"] },
      { id: "a-1", createdAt: "t", images: ["2"] },
      { id: "b", createdAt: "t", images: ["3"] },
    ]);
  });
});

describe("history display helpers", () => {
  it("formats createdAt", () => {
    expect(formatHistoryCreatedAt("2026-08-01T10:05:00.000Z")).toMatch(
      /2026-08-01 \d{2}:\d{2}/
    );
  });

  it("prefers model display name", () => {
    expect(
      resolveHistoryModelLabel({
        modelDisplayName: "Seedream",
        platformModelId: "seedream-5",
      })
    ).toBe("Seedream");
  });

  it("collects compact param parts", () => {
    expect(
      collectHistoryParamParts({
        size: "2K",
        ratio: "16:9",
        generate_count: 2,
        watermark: true,
      })
    ).toEqual(["2K", "16:9", "×2", "watermark"]);
  });

  it("falls back to request snapshot when params omit auto size", () => {
    expect(
      collectImageHistoryParamParts({
        params: { ratio: "auto" },
        requestSnapshot: {
          size: "auto",
          maxImages: 2,
          watermark: true,
        },
      })
    ).toEqual(["auto", "×2", "watermark"]);
  });
});
