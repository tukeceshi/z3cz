import { describe, expect, it } from "vitest";

import {
  createDefaultVolcanoMediaKitConfig,
  isVolcanoMediaKitConfigValid,
  listEnabledVolcanoMediaKitSubtitleEraseModes,
  mergeVolcanoMediaKit,
  normalizeVolcanoMediaKitEnhanceConfig,
} from "./volcano-mediakit-enhance";
import {
  formatMediaKitYuanPerSecond,
  VOLCANO_MEDIKIT_PRICING_TABLE,
  VOLCANO_MEDIKIT_SUBTITLE_ERASE_PRICING,
} from "./volcano-mediakit-pricing-catalog";

describe("volcano-mediakit", () => {
  it("defaults to disabled with all modes off", () => {
    const config = createDefaultVolcanoMediaKitConfig();
    expect(config.enabled).toBe(false);
    expect(config.videoEnhance).toEqual({
      fast: false,
      standard: false,
      pro: false,
      llm: false,
    });
    expect(config.videoTrim).toEqual({ enabled: false });
    expect(config.subtitleErase).toEqual({
      standard: false,
      refined: false,
    });
  });

  it("requires at least one feature when enabled", () => {
    expect(
      isVolcanoMediaKitConfigValid({
        enabled: true,
        videoEnhance: {
          fast: false,
          standard: false,
          pro: false,
          llm: false,
        },
        videoTrim: { enabled: false },
        subtitleErase: {
          standard: false,
          refined: false,
        },
      })
    ).toBe(false);

    expect(
      isVolcanoMediaKitConfigValid({
        enabled: true,
        videoEnhance: {
          fast: false,
          standard: false,
          pro: false,
          llm: false,
        },
        videoTrim: { enabled: false },
        subtitleErase: {
          standard: true,
          refined: false,
        },
      })
    ).toBe(true);

    expect(
      isVolcanoMediaKitConfigValid({
        enabled: true,
        videoEnhance: {
          fast: false,
          standard: false,
          pro: false,
          llm: false,
        },
        videoTrim: { enabled: true },
        subtitleErase: {
          standard: false,
          refined: false,
        },
      })
    ).toBe(true);
  });

  it("migrates legacy enhance config", () => {
    const config = normalizeVolcanoMediaKitEnhanceConfig({
      enabled: true,
      modes: {
        fast: true,
        standard: false,
        pro: false,
        llm: false,
      },
    });

    expect(config.videoEnhance.fast).toBe(true);
    expect(config.videoTrim).toEqual({ enabled: false });
    expect(config.subtitleErase).toEqual({
      standard: false,
      refined: false,
    });
  });

  it("lists enabled subtitle erase modes", () => {
    expect(
      listEnabledVolcanoMediaKitSubtitleEraseModes({
        enabled: true,
        videoEnhance: {
          fast: false,
          standard: false,
          pro: false,
          llm: false,
        },
        videoTrim: { enabled: false },
        subtitleErase: {
          standard: true,
          refined: true,
        },
      })
    ).toEqual(["standard", "refined"]);
  });

  it("merges into volcano metadata as mediaKit", () => {
    const metadata = mergeVolcanoMediaKit(
      {
        credentialMode: "volcengine_iam",
        accessKeyId: "ak",
        secretAccessKeyEncrypted: "enc",
        arkApiKeyDurationSeconds: 3600,
        region: "cn-beijing",
        models: {},
      },
      {
        enabled: true,
        videoEnhance: {
          fast: true,
          standard: false,
          pro: false,
          llm: false,
        },
        videoTrim: { enabled: false },
        subtitleErase: {
          standard: false,
          refined: true,
        },
      }
    );

    expect(metadata.mediaKit).toEqual({
      enabled: true,
      videoEnhance: {
        fast: true,
        standard: false,
        pro: false,
        llm: false,
      },
      videoTrim: { enabled: false },
      subtitleErase: {
        standard: false,
        refined: true,
      },
    });
    expect(metadata.mediaKitEnhance).toBeUndefined();
  });
});

describe("volcano-mediakit-pricing-catalog", () => {
  it("converts yuan per minute to display value", () => {
    expect(formatMediaKitYuanPerSecond(0.2)).toBe("0.0033");
    expect(formatMediaKitYuanPerSecond(240)).toBe("4");
  });

  it("marks unavailable 8K tiers", () => {
    expect(VOLCANO_MEDIKIT_PRICING_TABLE.fast["8K"]).toBeNull();
    expect(VOLCANO_MEDIKIT_PRICING_TABLE.llm["4K"]).toBeNull();
    expect(VOLCANO_MEDIKIT_PRICING_TABLE.standard["8K"]).toBe(24);
  });

  it("includes subtitle erase pricing", () => {
    expect(formatMediaKitYuanPerSecond(VOLCANO_MEDIKIT_SUBTITLE_ERASE_PRICING.standard)).toBe(
      "0.0067"
    );
    expect(formatMediaKitYuanPerSecond(VOLCANO_MEDIKIT_SUBTITLE_ERASE_PRICING.refined)).toBe(
      "0.0167"
    );
  });
});
