import { describe, expect, it } from "vitest";

import {
  buildListPublicPortraitsRequest,
  parseListMediaAssetGroupResult,
  parseMediaAssetGroupId,
  parsePublicPortraitGroupFromAssetGroup,
} from "./public-character-library";

describe("parsePublicPortraitGroupFromAssetGroup", () => {
  it("reads the whole group, not only the first image", () => {
    expect(
      parsePublicPortraitGroupFromAssetGroup({
        AssetGroup: {
          SID: "sid-1",
          Title: "青年",
          Content: {
            Image: [
              {
                AssetID: "asset-20240101-abc",
                CoverURL: "https://tos.example/cover.jpg",
                URL: "https://tos.example/full.jpg",
              },
              {
                AssetID: "asset-20240101-def",
                CoverURL: "https://tos.example/cover-2.jpg",
              },
            ],
          },
          Metadata: { gender: "女", age: 24, country: "中国" },
        },
      })
    ).toEqual({
      groupId: "sid-1",
      name: "青年",
      imageUrl: "https://tos.example/cover.jpg",
      gender: "女",
      age: 24,
      country: "中国",
      items: [
        {
          assetId: "asset-20240101-abc",
          imageUrl: "https://tos.example/cover.jpg",
        },
        {
          assetId: "asset-20240101-def",
          imageUrl: "https://tos.example/cover-2.jpg",
        },
      ],
    });
  });

  it("skips groups with only relative or missing covers", () => {
    expect(
      parsePublicPortraitGroupFromAssetGroup({
        Content: {
          Image: [{ AssetID: "asset-1", CoverURL: "presets/foo.jpg" }],
        },
      })
    ).toBeNull();
  });
});

describe("parseListMediaAssetGroupResult", () => {
  it("maps groups and total", () => {
    const parsed = parseListMediaAssetGroupResult({
      Total: 2,
      PageNum: 1,
      PageSize: 30,
      Items: [
        {
          Title: "A",
          Content: {
            Image: [
              {
                AssetID: "asset-a",
                CoverURL: "https://cdn.example/a.jpg",
              },
            ],
          },
        },
        { Title: "skip" },
      ],
    });
    expect(parsed.total).toBe(2);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]?.groupId).toBe("asset-a");
    expect(parsed.items[0]?.items[0]?.assetId).toBe("asset-a");
  });
});

describe("buildListPublicPortraitsRequest", () => {
  it("adds search text and drops score sort", () => {
    expect(
      buildListPublicPortraitsRequest({
        pageNum: 2,
        query: "青年",
        gender: "女",
        country: "中国",
        ageMin: 18,
        ageMax: 30,
      })
    ).toMatchObject({
      Query: { Text: "青年" },
      PageNum: 2,
      PageSize: 30,
      Filters: [
        {
          Field: "metadata.type",
          Op: "must",
          Conds: { StrValues: ["portrait"] },
        },
        { Field: "metadata.gender", Op: "must", Conds: { StrValues: ["女"] } },
        {
          Field: "metadata.country",
          Op: "must",
          Conds: { StrValues: ["中国"] },
        },
        { Field: "metadata.age", Op: "range", Gte: 18, Lte: 30 },
      ],
    });
  });

  it("keeps score sort when search is empty", () => {
    const request = buildListPublicPortraitsRequest({ pageNum: 1 });
    expect(request.Query).toEqual({});
    expect(request.SortBy).toBe("score");
    expect(request.Filters).toHaveLength(1);
  });
});

describe("parseMediaAssetGroupId", () => {
  it("reads group id from GetMediaAsset", () => {
    expect(parseMediaAssetGroupId({ GroupID: "sid-9" })).toBe("sid-9");
  });
});
