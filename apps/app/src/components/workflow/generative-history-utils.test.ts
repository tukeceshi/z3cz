import { describe, expect, it } from "vitest";

import {
  collectHistoryParamParts,
  collectImageHistoryParamParts,
  formatHistoryCreatedAt,
  readDisplayHistoryMedia,
  readGenerativeCardCoverFromHistory,
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

describe("readDisplayHistoryMedia", () => {
  it("falls back to the previous ready row while selected is generating", () => {
    const media = readDisplayHistoryMedia(
      {
        selectedId: "gen-2",
        items: [
          {
            id: "gen-2",
            images: [{ resourceId: "pending", generating: true }],
          },
          {
            id: "gen-1",
            images: [{ resourceId: "done", mimeType: "image/jpeg" }],
          },
        ],
      },
      (item) => item.images
    );
    expect(media).toEqual([{ resourceId: "done", mimeType: "image/jpeg" }]);
  });

  it("does not fall back when the selected row failed", () => {
    const failed = [{ resourceId: "failed", failed: true }];
    expect(
      readDisplayHistoryMedia(
        {
          selectedId: "gen-2",
          items: [
            { id: "gen-2", images: failed },
            { id: "gen-1", images: [{ resourceId: "done" }] },
          ],
        },
        (item) => item.images
      )
    ).toEqual(failed);
  });

  it("keeps the generating row when there is no ready media", () => {
    const generating = [{ resourceId: "pending", generating: true }];
    expect(
      readDisplayHistoryMedia(
        {
          selectedId: "gen-1",
          items: [{ id: "gen-1", images: generating }],
        },
        (item) => item.images
      )
    ).toEqual(generating);
  });

  it("holds the previous ready cover while download/upload is still pending", () => {
    expect(
      readDisplayHistoryMedia(
        {
          selectedId: "gen-2",
          items: [
            {
              id: "gen-2",
              images: [{ resourceId: "pending", mimeType: "image/png" }],
            },
            {
              id: "gen-1",
              images: [{ resourceId: "done", mimeType: "image/jpeg" }],
            },
          ],
        },
        (item) => item.images,
        { holdUnreadyCover: true }
      )
    ).toEqual([{ resourceId: "done", mimeType: "image/jpeg" }]);
  });

  it("does not expose an unready cover when there is no previous media", () => {
    expect(
      readDisplayHistoryMedia(
        {
          selectedId: "gen-1",
          items: [
            {
              id: "gen-1",
              images: [{ resourceId: "pending", mimeType: "image/png" }],
            },
          ],
        },
        (item) => item.images,
        { holdUnreadyCover: true }
      )
    ).toEqual([]);
  });

  it("still shows local staging media while download/upload is pending", () => {
    const local = [{ kind: "local" as const, mediaId: "blob-1", mimeType: "image/png" }];
    expect(
      readDisplayHistoryMedia(
        {
          selectedId: "gen-1",
          items: [{ id: "gen-1", images: local }],
        },
        (item) => item.images,
        { holdUnreadyCover: true }
      )
    ).toEqual(local);
  });
});

describe("readGenerativeCardCoverFromHistory", () => {
  it("reports busy with a fallback cover while generating", () => {
    expect(
      readGenerativeCardCoverFromHistory(
        {
          selectedId: "gen-2",
          items: [
            {
              id: "gen-2",
              images: [{ resourceId: "pending", generating: true }],
            },
            {
              id: "gen-1",
              images: [{ resourceId: "done", mimeType: "image/jpeg" }],
            },
          ],
        },
        (item) => item.images,
        { isModalityGenerating: true }
      )
    ).toEqual({
      coverMedia: [{ resourceId: "done", mimeType: "image/jpeg" }],
      isBusy: true,
      hasCover: true,
    });
  });

  it("reports busy without cover on first generate", () => {
    expect(
      readGenerativeCardCoverFromHistory(
        {
          selectedId: "gen-1",
          items: [
            {
              id: "gen-1",
              images: [{ resourceId: "pending", generating: true }],
            },
          ],
        },
        (item) => item.images,
        { isModalityGenerating: true }
      )
    ).toEqual({
      coverMedia: [{ resourceId: "pending", generating: true }],
      isBusy: true,
      hasCover: false,
    });
  });

  it("does not fall back cover for failed rows", () => {
    const failed = [{ resourceId: "failed", failed: true }];
    expect(
      readGenerativeCardCoverFromHistory(
        {
          selectedId: "gen-2",
          items: [
            { id: "gen-2", images: failed },
            { id: "gen-1", images: [{ resourceId: "done" }] },
          ],
        },
        (item) => item.images,
        { isModalityGenerating: false }
      )
    ).toEqual({
      coverMedia: failed,
      isBusy: false,
      hasCover: false,
    });
  });

  it("keeps failed cover even while generate metadata is still busy", () => {
    const failed = [{ resourceId: "failed", failed: true }];
    expect(
      readGenerativeCardCoverFromHistory(
        {
          selectedId: "gen-2",
          items: [
            { id: "gen-2", images: failed },
            { id: "gen-1", images: [{ resourceId: "done", mimeType: "image/jpeg" }] },
          ],
        },
        (item) => item.images,
        { isModalityGenerating: true }
      )
    ).toEqual({
      coverMedia: failed,
      isBusy: false,
      hasCover: false,
    });
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
