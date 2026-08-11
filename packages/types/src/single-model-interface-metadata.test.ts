import { describe, expect, it } from "vitest";



import {
  buildSingleModelProviderMetadata,
  defaultUpstreamModelIdForCanonical,
  mergeSingleModelModelEnabled,
  mergeSingleModelUpstreamModelIds,
  readSingleModelCanonicalId,
} from "./single-model-interface-metadata";



describe("single-model-interface-metadata", () => {

  it("builds provider metadata with models map", () => {

    const metadata = buildSingleModelProviderMetadata({

      singleModelPresetId: "provider:deepseek",

      singleModelCategory: "text",

      models: [

        {

          canonicalId: "deepseek-v4-pro",

          upstreamModelId: "deepseek-chat",

          enabled: true,

        },

        {

          canonicalId: "deepseek-v4-flash",

          upstreamModelId: "deepseek-reasoner",

          enabled: false,

        },

      ],

    });



    expect(metadata.models["deepseek-v4-pro"]).toEqual({

      enabled: true,

      upstreamModelId: "deepseek-chat",

      modality: "text",

    });

    expect(readSingleModelCanonicalId(metadata)).toBe("deepseek-v4-pro");

  });



  it("merges model enabled toggles", () => {

    const metadata = buildSingleModelProviderMetadata({

      singleModelPresetId: "provider:deepseek",

      models: [

        {

          canonicalId: "deepseek-v4-pro",

          upstreamModelId: "deepseek-chat",

          enabled: false,

        },

      ],

    });



    const merged = mergeSingleModelModelEnabled(metadata, {

      "deepseek-v4-pro": true,

    });



    expect(merged.models["deepseek-v4-pro"]?.enabled).toBe(true);

  });

  it("merges upstream model ids", () => {

    const metadata = buildSingleModelProviderMetadata({

      singleModelPresetId: "provider:deepseek",

      models: [

        {

          canonicalId: "deepseek-v4-pro",

          upstreamModelId: "deepseek-chat",

          enabled: true,

        },

        {

          canonicalId: "deepseek-v4-flash",

          upstreamModelId: "deepseek-reasoner",

          enabled: false,

        },

      ],

    });



    const merged = mergeSingleModelUpstreamModelIds(metadata, {

      "deepseek-v4-pro": " custom-chat ",

      "unknown-model": "ignored",

      "deepseek-v4-flash": "",

    });



    expect(merged.models["deepseek-v4-pro"]?.upstreamModelId).toBe("custom-chat");

    expect(merged.models["deepseek-v4-flash"]?.upstreamModelId).toBe(
      "deepseek-reasoner"
    );
  });

  it("returns DeepSeek brand defaults instead of Volcano catalog providerModelId", () => {
    expect(defaultUpstreamModelIdForCanonical("deepseek-v4-pro")).toBe(
      "deepseek-v4-pro"
    );
    expect(defaultUpstreamModelIdForCanonical("deepseek-v4-flash")).toBe(
      "deepseek-v4-flash"
    );
  });

  it("returns Seedance brand defaults instead of Volcano catalog providerModelId", () => {
    expect(defaultUpstreamModelIdForCanonical("doubao-seedance-2-5")).toBe(
      "doubao-seedance-2-5-260628"
    );
  });

  it("returns Volcano catalog providerModelId for non-brand models", () => {
    expect(defaultUpstreamModelIdForCanonical("glm-5-2")).toBe("glm-5-2-260617");
  });
});

