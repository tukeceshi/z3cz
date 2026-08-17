import { describe, expect, it } from "vitest";

import {
  applyVideoPricePromoFold,
  formatVideoPricePromoFold,
  isVideoPricePromoActive,
  isVideoPricePromoFold,
  matchLibtvPricePromo,
  matchVideoModelPricePromo,
  normalizeVideoPricePromoFold,
  readLibtvPricePromos,
  readVideoModelPricePromos,
} from "./video-price-promo";

const NOW = new Date(2026, 7, 17);

describe("normalizeVideoPricePromoFold", () => {
  it("keeps one decimal place", () => {
    expect(normalizeVideoPricePromoFold(8.5)).toBe(8.5);
    expect(normalizeVideoPricePromoFold(8.55)).toBe(8.6);
    expect(isVideoPricePromoFold(8.5)).toBe(true);
    expect(formatVideoPricePromoFold(8.5)).toBe("8.5");
    expect(formatVideoPricePromoFold(8)).toBe("8");
  });
});

describe("isVideoPricePromoActive", () => {
  it("includes the start and end dates", () => {
    expect(
      isVideoPricePromoActive(
        { startsAt: "2026-08-17", endsAt: "2026-08-17" },
        NOW
      )
    ).toBe(true);
    expect(
      isVideoPricePromoActive(
        { startsAt: "2026-08-18", endsAt: "2026-08-20" },
        NOW
      )
    ).toBe(false);
  });
});

describe("applyVideoPricePromoFold", () => {
  it("treats 8 as 80 percent of the original", () => {
    expect(applyVideoPricePromoFold(100, 8)).toBe(80);
  });

  it("supports one decimal fold", () => {
    expect(applyVideoPricePromoFold(100, 8.5)).toBe(85);
  });
});

describe("matchVideoModelPricePromo", () => {
  it("picks the lowest fold among active matching resolutions", () => {
    const matched = matchVideoModelPricePromo(
      [
        {
          id: "a",
          resolution: "720p",
          startsAt: "2026-08-01",
          endsAt: "2026-08-31",
          discountFold: 8,
        },
        {
          id: "b",
          resolution: "720p",
          startsAt: "2026-08-01",
          endsAt: "2026-08-31",
          discountFold: 7,
        },
        {
          id: "c",
          resolution: "1080p",
          startsAt: "2026-08-01",
          endsAt: "2026-08-31",
          discountFold: 5,
        },
      ],
      "720p",
      NOW
    );
    expect(matched?.id).toBe("b");
  });

  it("matches any-resolution promos for every resolution", () => {
    const matched = matchVideoModelPricePromo(
      [
        {
          id: "any",
          resolution: "any",
          startsAt: "2026-08-01",
          endsAt: "2026-08-31",
          discountFold: 8,
        },
      ],
      "4k",
      NOW
    );
    expect(matched?.id).toBe("any");
  });
});

describe("matchLibtvPricePromo", () => {
  it("requires model, resolution, and reference flag", () => {
    const promos = [
      {
        id: "with-ref",
        canonicalId: "doubao-seedance-2",
        resolution: "720p",
        withReference: true,
        startsAt: "2026-08-01",
        endsAt: "2026-08-31",
        discountFold: 8,
      },
      {
        id: "without-ref",
        canonicalId: "doubao-seedance-2",
        resolution: "720p",
        withReference: false,
        startsAt: "2026-08-01",
        endsAt: "2026-08-31",
        discountFold: 7,
      },
    ];
    expect(
      matchLibtvPricePromo(promos, {
        canonicalId: "doubao-seedance-2",
        resolution: "720p",
        withReference: false,
        now: NOW,
      })?.id
    ).toBe("without-ref");
    expect(
      matchLibtvPricePromo(promos, {
        canonicalId: "doubao-seedance-2-mini",
        resolution: "720p",
        withReference: false,
        now: NOW,
      })
    ).toBeNull();
  });

  it("matches any-resolution promos", () => {
    expect(
      matchLibtvPricePromo(
        [
          {
            id: "any",
            canonicalId: "doubao-seedance-2",
            resolution: "any",
            withReference: false,
            startsAt: "2026-08-01",
            endsAt: "2026-08-31",
            discountFold: 8,
          },
        ],
        {
          canonicalId: "doubao-seedance-2",
          resolution: "480p",
          withReference: false,
          now: NOW,
        }
      )?.id
    ).toBe("any");
  });
});

describe("readVideoModelPricePromos", () => {
  it("drops incomplete rows", () => {
    expect(
      readVideoModelPricePromos([
        {
          id: "ok",
          resolution: "720p",
          startsAt: "2026-08-01",
          endsAt: "2026-08-31",
          discountFold: 8,
        },
        { resolution: "720p", startsAt: "bad", endsAt: "2026-08-31", discountFold: 8 },
      ])
    ).toEqual([
      {
        id: "ok",
        resolution: "720p",
        startsAt: "2026-08-01",
        endsAt: "2026-08-31",
        discountFold: 8,
      },
    ]);
  });
});

describe("readLibtvPricePromos", () => {
  it("requires withReference", () => {
    expect(
      readLibtvPricePromos([
        {
          id: "ok",
          canonicalId: "doubao-seedance-2",
          resolution: "480p",
          withReference: false,
          startsAt: "2026-08-01",
          endsAt: "2026-08-31",
          discountFold: 9,
        },
        {
          canonicalId: "doubao-seedance-2",
          resolution: "480p",
          startsAt: "2026-08-01",
          endsAt: "2026-08-31",
          discountFold: 9,
        },
      ])
    ).toHaveLength(1);
  });
});
